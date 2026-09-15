import json
import logging
import ssl
import paho.mqtt.client as mqtt
from django.conf import settings
from django.db import close_old_connections
from .services import ingest_ack, ingest_alert, ingest_status, ingest_telemetry

logger = logging.getLogger(__name__)

class HiveMQSubscriber:
    def __init__(self):
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, protocol=mqtt.MQTTv5)
        self.client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
        self.client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
    def on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code != 0:
            logger.error("HiveMQ connection failed: %s", reason_code)
            return
        p = settings.MQTT_TOPIC_PREFIX
        client.subscribe([(f"{p}/telemetry", 1), (f"{p}/status", 1), (f"{p}/availability", 1), (f"{p}/alerts", 1), (f"{p}/ack", 1)])
        logger.info("Connected to HiveMQ under %s", p)
    def on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties):
        if reason_code != 0: logger.warning("Unexpected HiveMQ disconnect: %s", reason_code)
    def on_message(self, client, userdata, message):
        close_old_connections()
        try:
            payload = json.loads(message.payload.decode("utf-8"))
            suffix = message.topic.rsplit("/", 1)[-1]
            {"telemetry": ingest_telemetry, "status": ingest_status, "availability": ingest_status, "alerts": ingest_alert, "ack": ingest_ack}[suffix](payload)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            logger.exception("Rejected MQTT message on %s", message.topic)
        finally:
            close_old_connections()
    def run_forever(self):
        if not all([settings.MQTT_HOST, settings.MQTT_USERNAME, settings.MQTT_PASSWORD]):
            raise RuntimeError("MQTT_HOST, MQTT_USERNAME and MQTT_PASSWORD are required")
        self.client.connect(settings.MQTT_HOST, settings.MQTT_PORT, settings.MQTT_KEEPALIVE)
        self.client.loop_forever(retry_first_connection=True)
