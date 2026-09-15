import json
import unittest
from unittest.mock import Mock

from config import SimulatorConfig
from simulator import CageSimulator


class FakePublishResult:
    def wait_for_publish(self, timeout=None):
        return None


class SimulatorTests(unittest.TestCase):
    def setUp(self):
        self.client = Mock()
        self.client.publish.return_value = FakePublishResult()
        self.config = SimulatorConfig(mqtt_host="test", mqtt_username="user", mqtt_password="pass", full_sensor_set=True, motion_probability=0)
        self.simulator = CageSimulator(self.config, seed=7, client=self.client)

    def test_generates_all_four_tiers_with_simulated_quality(self):
        rows = [self.simulator.generate_telemetry(tier, elapsed=0) for tier in range(1, 5)]
        self.assertEqual([row["tier"] for row in rows], [1, 2, 3, 4])
        self.assertTrue(all(row["source"] == "simulator" for row in rows))
        self.assertTrue(all(row["field_quality"]["temperature"] == "simulated" for row in rows))

    def test_unavailable_mode_uses_null_instead_of_fake_values(self):
        simulator = CageSimulator(SimulatorConfig(mqtt_host="test", mqtt_username="user", mqtt_password="pass", full_sensor_set=False), client=self.client)
        payload = simulator.generate_telemetry(1, elapsed=0)
        self.assertIsNone(payload["sensors"]["ammonia_ppm"])
        self.assertEqual(payload["field_quality"]["ammonia_ppm"], "unavailable")

    def test_motion_activates_buzzer_before_publishing_alert(self):
        payload = self.simulator.trigger_motion(2)
        self.assertTrue(all(tier.actuators["buzzer"] for tier in self.simulator.tiers.values()))
        self.assertEqual(payload["code"], "perimeter_intrusion")
        topic, encoded = self.client.publish.call_args.args[:2]
        self.assertTrue(topic.endswith("/alerts"))
        self.assertTrue(json.loads(encoded)["buzzer_activated"])

    def test_valid_command_changes_state_and_acknowledges(self):
        ack = self.simulator.handle_command({"command_id": "abc", "farm_id": "farm01", "cage_id": "cage01", "tier": 3, "action": "SET_ACTUATOR", "target": "led", "value": False})
        self.assertFalse(self.simulator.tiers[3].actuators["led"])
        self.assertEqual(ack["status"], "executed")

    def test_wrong_device_command_is_rejected(self):
        ack = self.simulator.handle_command({"command_id": "abc", "farm_id": "other", "cage_id": "cage01", "tier": 1, "action": "SET_ACTUATOR", "target": "buzzer", "value": True})
        self.assertEqual(ack["status"], "rejected")


if __name__ == "__main__":
    unittest.main()
