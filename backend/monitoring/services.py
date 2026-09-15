import json
import ssl
import paho.mqtt.client as mqtt
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from .models import Alert, ActuatorCommand, Cage, Device, SecurityEvent, TelemetryReading, ThresholdConfiguration, Tier
from .serializers import TelemetryReadingSerializer

SENSOR_MAP = {"temperature": "temperature_c", "humidity": "humidity_rh", "lux": "light_lux", "ammonia_ppm": "ammonia_ppm", "co2_ppm": "co2_ppm", "weight_kg": "weight_kg"}

def _parse_timestamp(value):
    parsed = parse_datetime(value) if isinstance(value, str) else None
    if parsed is None: raise ValueError("timestamp must be an ISO-8601 datetime")
    return parsed

def ensure_topology(farm_id, cage_id, tier_number=None):
    from .models import Farm
    farm, _ = Farm.objects.get_or_create(external_id=farm_id, defaults={"name": farm_id})
    cage, _ = Cage.objects.get_or_create(farm=farm, external_id=cage_id, defaults={"name": cage_id})
    ThresholdConfiguration.objects.get_or_create(cage=cage)
    Device.objects.get_or_create(cage=cage, defaults={"device_id": f"{farm_id}-{cage_id}"})
    tier = None
    if tier_number is not None:
        if int(tier_number) not in range(1, 5): raise ValueError("tier must be between 1 and 4")
        tier, _ = Tier.objects.get_or_create(cage=cage, number=int(tier_number), defaults={"name": f"Tier {tier_number}"})
    return cage, tier

def _broadcast(cage, event_type, data):
    async_to_sync(get_channel_layer().group_send)(f"cage_{cage.farm.external_id}_{cage.external_id}", {"type": "cage.event", "event": event_type, "data": data})

def _create_threshold_alerts(reading):
    t = reading.cage.thresholds
    rules = [("temperature_high", reading.temperature_c, t.temperature_high_c, ">", "High temperature"), ("temperature_low", reading.temperature_c, t.temperature_low_c, "<", "Low temperature"), ("humidity_high", reading.humidity_rh, t.humidity_high_rh, ">", "High humidity"), ("humidity_low", reading.humidity_rh, t.humidity_low_rh, "<", "Low humidity"), ("ammonia_high", reading.ammonia_ppm, t.ammonia_high_ppm, ">", "High ammonia"), ("co2_high", reading.co2_ppm, t.co2_high_ppm, ">", "High carbon dioxide")]
    for code, value, limit, op, title in rules:
        breached = value is not None and ((op == ">" and value > limit) or (op == "<" and value < limit))
        if breached and not Alert.objects.filter(cage=reading.cage, tier=reading.tier, code=code, resolved_at__isnull=True).exists():
            Alert.objects.create(cage=reading.cage, tier=reading.tier, code=code, title=title, detail=f"Tier {reading.tier.number}: measured {value}; configured limit {op} {limit}.", severity=Alert.Severity.CRITICAL if code in {"temperature_high", "ammonia_high", "co2_high"} else Alert.Severity.WARNING)

@transaction.atomic
def ingest_telemetry(payload):
    required = {"farm_id", "cage_id", "tier", "timestamp", "sensors", "actuators"}
    missing = required - payload.keys()
    if missing: raise ValueError(f"missing telemetry fields: {', '.join(sorted(missing))}")
    cage, tier = ensure_topology(payload["farm_id"], payload["cage_id"], payload["tier"])
    sensors = payload["sensors"]
    reading = TelemetryReading.objects.create(cage=cage, tier=tier, sampled_at=_parse_timestamp(payload["timestamp"]), source=payload.get("source", TelemetryReading.Source.HARDWARE), actuators=payload["actuators"], field_quality=payload.get("field_quality", {}), raw_payload=payload, **{field: sensors.get(key) for key, field in SENSOR_MAP.items()})
    Device.objects.filter(cage=cage).update(state=Device.State.ONLINE, last_seen_at=timezone.now())
    _create_threshold_alerts(reading)
    _broadcast(cage, "telemetry", TelemetryReadingSerializer(reading).data)
    return reading

def ingest_status(payload):
    cage, _ = ensure_topology(payload.get("farm_id", "farm01"), payload.get("cage_id", "cage01"))
    state = payload.get("status", payload.get("state", Device.State.ONLINE))
    if state not in Device.State.values: raise ValueError("invalid device status")
    Device.objects.filter(cage=cage).update(state=state, last_seen_at=timezone.now())
    _broadcast(cage, "status", {"state": state, "last_seen_at": timezone.now().isoformat()})

def ingest_alert(payload):
    cage, tier = ensure_topology(payload.get("farm_id", "farm01"), payload.get("cage_id", "cage01"), payload.get("tier"))
    code = payload.get("code", payload.get("type", "device_alert"))
    detected_at = _parse_timestamp(payload.get("timestamp"))
    if code in {"motion_detected", "perimeter_intrusion"}:
        event = SecurityEvent.objects.create(cage=cage, tier=tier, detected_at=detected_at, buzzer_activated=payload.get("buzzer_activated", True), payload=payload)
        _broadcast(cage, "security_alert", {"id": event.id, "detected_at": event.detected_at.isoformat(), "tier": tier.number if tier else None})
    alert = Alert.objects.create(cage=cage, tier=tier, code=code, title=payload.get("title", "Device alert"), detail=payload.get("detail", ""), severity=payload.get("severity", Alert.Severity.WARNING), opened_at=detected_at, payload=payload)
    _broadcast(cage, "alert", {"id": alert.id, "code": alert.code, "title": alert.title, "opened_at": alert.opened_at.isoformat()})

def ingest_ack(payload):
    command = ActuatorCommand.objects.filter(command_id=payload.get("command_id")).first()
    if not command: raise ValueError("unknown command_id")
    command.status = payload.get("status", ActuatorCommand.Status.EXECUTED)
    command.acknowledged_at = _parse_timestamp(payload.get("timestamp"))
    command.acknowledgement = payload
    command.save(update_fields=["status", "acknowledged_at", "acknowledgement"])
    _broadcast(command.cage, "command_ack", payload)

def publish_command(command):
    payload = {"command_id": str(command.command_id), "farm_id": command.cage.farm.external_id, "cage_id": command.cage.external_id, "tier": command.tier.number, "action": "SET_ACTUATOR", "target": command.target, "value": command.value, "timestamp": timezone.now().isoformat().replace("+00:00", "Z")}
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, protocol=mqtt.MQTTv5)
    client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
    client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
    client.connect(settings.MQTT_HOST, settings.MQTT_PORT, settings.MQTT_KEEPALIVE)
    client.loop_start()
    info = client.publish(f"{settings.MQTT_TOPIC_PREFIX}/command", json.dumps(payload), qos=1, retain=False)
    info.wait_for_publish(timeout=10)
    client.loop_stop()
    client.disconnect()
    if not info.is_published(): raise RuntimeError("MQTT command was not published")
    command.status = ActuatorCommand.Status.PUBLISHED
    command.published_at = timezone.now()
    command.save(update_fields=["status", "published_at"])
    return payload
