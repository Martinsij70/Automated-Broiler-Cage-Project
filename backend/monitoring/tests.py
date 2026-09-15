from datetime import date
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from .models import Alert, FlockBatch, SecurityEvent, TelemetryReading
from .services import ingest_alert, ingest_telemetry

@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class IngestionTests(TestCase):
    @staticmethod
    def payload():
        return {"farm_id": "farm01", "cage_id": "cage01", "tier": 1, "timestamp": timezone.now().isoformat(), "source": "simulator", "sensors": {"temperature": 33.2, "humidity": 65.2, "lux": 32.1, "ammonia_ppm": None, "co2_ppm": None, "weight_kg": None}, "actuators": {"led": True, "fan": False, "solenoid_valve": False, "buzzer": False, "heater": False}, "field_quality": {"temperature": "simulated", "ammonia_ppm": "unavailable"}}
    def test_ingests_nullable_telemetry_and_opens_alert(self):
        reading = ingest_telemetry(self.payload())
        self.assertEqual(reading.source, TelemetryReading.Source.SIMULATOR)
        self.assertIsNone(reading.ammonia_ppm)
        self.assertTrue(Alert.objects.filter(code="temperature_high").exists())
    def test_motion_alert_creates_security_event(self):
        ingest_alert({"farm_id": "farm01", "cage_id": "cage01", "tier": 1, "timestamp": timezone.now().isoformat(), "code": "perimeter_intrusion", "title": "Motion detected", "severity": "critical", "buzzer_activated": True})
        self.assertEqual(SecurityEvent.objects.count(), 1)

@override_settings(CHANNEL_LAYERS={"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}})
class ApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.reading = ingest_telemetry(IngestionTests.payload())
        FlockBatch.objects.create(cage=self.reading.cage, batch_id="batch-001", started_at=date.today(), bird_count=200, initial_total_weight_kg=8, current_total_weight_kg=48, feed_consumed_kg=64)
    def test_latest_telemetry(self):
        response = self.client.get(reverse("latest-telemetry", kwargs={"farm_id": "farm01", "cage_id": "cage01"}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["tier"], 1)
        self.assertIsNone(response.data[0]["sensors"]["ammonia_ppm"])
    def test_active_batch_exposes_fcr(self):
        response = self.client.get(reverse("active-batch", kwargs={"farm_id": "farm01", "cage_id": "cage01"}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["fcr"], 1.6)
