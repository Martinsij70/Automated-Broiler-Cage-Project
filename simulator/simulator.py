#!/usr/bin/env python3
import argparse
import json
import logging
import math
import random
import signal
import ssl
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from config import SimulatorConfig

LOGGER = logging.getLogger("broiler-simulator")
ACTUATOR_TARGETS = {"led", "fan", "solenoid_valve", "heater", "buzzer"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass
class TierState:
    number: int
    actuators: dict[str, bool] = field(default_factory=lambda: {"led": True, "fan": False, "solenoid_valve": False, "buzzer": False, "heater": False})


class CageSimulator:
    def __init__(self, config: SimulatorConfig, scenario: str = "normal", seed: int | None = None, client=None):
        self.config = config
        self.scenario = scenario
        self.random = random.Random(seed)
        self.tiers = {number: TierState(number) for number in range(1, 5)}
        self.started_monotonic = time.monotonic()
        self.buzzer_until = 0.0
        self.running = True
        self.connected = False
        self._client = client

    @property
    def client(self):
        if self._client is None:
            self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"sim-{self.config.cage_id}-{uuid.uuid4().hex[:8]}", protocol=mqtt.MQTTv5)
            self._client.username_pw_set(self.config.mqtt_username, self.config.mqtt_password)
            self._client.tls_set(cert_reqs=ssl.CERT_REQUIRED)
            self._client.will_set(self.topic("availability"), json.dumps(self.status_payload("offline")), qos=1, retain=True)
            self._client.on_connect = self._on_connect
            self._client.on_disconnect = self._on_disconnect
            self._client.on_message = self._on_message
        return self._client

    def topic(self, suffix: str) -> str:
        return f"{self.config.topic_prefix}/{suffix}"

    def status_payload(self, state: str = "online") -> dict:
        return {"farm_id": self.config.farm_id, "cage_id": self.config.cage_id, "status": state, "timestamp": utc_now(), "source": "simulator", "uptime_seconds": round(time.monotonic() - self.started_monotonic)}

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code != 0:
            LOGGER.error("HiveMQ rejected the connection: %s", reason_code)
            return
        self.connected = True
        client.subscribe([(self.topic("command"), 1), (self.topic("config"), 1)])
        self.publish("status", self.status_payload())
        self.publish("availability", self.status_payload(), retain=True)
        LOGGER.info("Connected securely to HiveMQ")

    def _on_disconnect(self, client, userdata, disconnect_flags, reason_code, properties):
        self.connected = False
        if reason_code != 0:
            LOGGER.warning("Unexpected disconnect: %s", reason_code)

    def _on_message(self, client, userdata, message):
        try:
            payload = json.loads(message.payload.decode("utf-8"))
            if message.topic.endswith("/command"):
                self.handle_command(payload)
            elif message.topic.endswith("/config"):
                self.handle_config(payload)
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError) as exc:
            LOGGER.warning("Rejected message on %s: %s", message.topic, exc)

    def publish(self, suffix: str, payload: dict, retain: bool = False) -> None:
        encoded = json.dumps(payload, separators=(",", ":"), allow_nan=False)
        info = self.client.publish(self.topic(suffix), encoded, qos=1, retain=retain)
        if hasattr(info, "wait_for_publish"):
            info.wait_for_publish(timeout=10)
        LOGGER.info("Published %s: %s", suffix, encoded)

    def generate_telemetry(self, tier_number: int, elapsed: float | None = None) -> dict:
        elapsed = time.monotonic() - self.started_monotonic if elapsed is None else elapsed
        tier = self.tiers[tier_number]
        wave = math.sin(elapsed / 90 + tier_number * 0.35)
        temperature = 28.2 + tier_number * 0.25 + wave * 1.1 + self.random.uniform(-0.25, 0.25)
        humidity = 66.0 + tier_number * 0.6 - wave * 2.4 + self.random.uniform(-0.7, 0.7)
        ammonia = 11.0 + tier_number * 0.8 + self.random.uniform(-1.0, 1.0)
        co2 = 820 + tier_number * 35 + self.random.uniform(-45, 45)
        if self.scenario == "hot" and tier_number == 3:
            temperature = self.random.uniform(32.5, 35.0)
        if self.scenario == "high-gas" and tier_number in {2, 3}:
            ammonia, co2 = self.random.uniform(26, 34), self.random.uniform(3100, 3900)
        sensors = {"temperature": round(temperature, 2), "humidity": round(humidity, 2), "lux": round(300 + tier_number * 9 + self.random.uniform(-18, 18), 2), "ammonia_ppm": round(ammonia, 2), "co2_ppm": round(co2), "weight_kg": round(42 + tier_number * 1.4 + elapsed / 86400 * 2 + self.random.uniform(-0.4, 0.4), 2)}
        quality = {key: "simulated" for key in sensors}
        if not self.config.full_sensor_set:
            for key in ("ammonia_ppm", "co2_ppm", "weight_kg"):
                sensors[key] = None
                quality[key] = "unavailable"
        return {"farm_id": self.config.farm_id, "cage_id": self.config.cage_id, "tier": tier_number, "timestamp": utc_now(), "source": "simulator", "sensors": sensors, "actuators": dict(tier.actuators), "field_quality": quality}

    def publish_cycle(self) -> None:
        self._expire_local_buzzer()
        for tier_number in self.tiers:
            self.publish("telemetry", self.generate_telemetry(tier_number))
        if self.random.random() < self.config.motion_probability:
            self.trigger_motion()

    def trigger_motion(self, tier_number: int = 1) -> dict:
        # This state change represents the firmware's immediate local GPIO path.
        for tier in self.tiers.values():
            tier.actuators["buzzer"] = True
        self.buzzer_until = time.monotonic() + self.config.buzzer_hold_seconds
        payload = {"farm_id": self.config.farm_id, "cage_id": self.config.cage_id, "tier": tier_number, "timestamp": utc_now(), "code": "perimeter_intrusion", "title": "Perimeter motion detected", "detail": "Simulated PIR interrupt activated the local buzzer.", "severity": "critical", "source": "simulator", "buzzer_activated": True}
        self.publish("alerts", payload)
        return payload

    def _expire_local_buzzer(self) -> None:
        if self.buzzer_until and time.monotonic() >= self.buzzer_until:
            for tier in self.tiers.values():
                tier.actuators["buzzer"] = False
            self.buzzer_until = 0.0

    def handle_command(self, payload: dict) -> dict:
        command_id = payload.get("command_id")
        status, detail = "executed", ""
        try:
            if not command_id:
                raise ValueError("command_id is required")
            if payload.get("farm_id") != self.config.farm_id or payload.get("cage_id") != self.config.cage_id:
                raise ValueError("command targets another device")
            if payload.get("action") != "SET_ACTUATOR":
                raise ValueError("unsupported action")
            tier_number = int(payload.get("tier"))
            if tier_number not in self.tiers:
                raise ValueError("tier must be between 1 and 4")
            target = payload.get("target")
            if target not in ACTUATOR_TARGETS:
                raise ValueError("unsupported actuator target")
            if not isinstance(payload.get("value"), bool):
                raise ValueError("value must be boolean")
            self.tiers[tier_number].actuators[target] = payload["value"]
            if target == "buzzer":
                self.buzzer_until = time.monotonic() + self.config.buzzer_hold_seconds if payload["value"] else 0.0
                if not payload["value"]:
                    for tier in self.tiers.values():
                        tier.actuators["buzzer"] = False
        except (TypeError, ValueError) as exc:
            status, detail = "rejected", str(exc)
        acknowledgement = {"command_id": command_id or "missing", "status": status, "timestamp": utc_now()}
        if detail:
            acknowledgement["detail"] = detail
        self.publish("ack", acknowledgement)
        return acknowledgement

    def handle_config(self, payload: dict) -> None:
        hold = payload.get("buzzer_hold_seconds")
        if hold is not None:
            hold = float(hold)
            if not 1 <= hold <= 300:
                raise ValueError("buzzer_hold_seconds must be between 1 and 300")
            object.__setattr__(self.config, "buzzer_hold_seconds", hold)

    def run(self, once: bool = False, motion_now: bool = False) -> None:
        self.config.validate_for_connection()
        self.client.connect(self.config.mqtt_host, self.config.mqtt_port, self.config.keepalive)
        self.client.loop_start()
        deadline = time.monotonic() + 15
        while not self.connected and time.monotonic() < deadline:
            time.sleep(0.1)
        if not self.connected:
            raise RuntimeError("Timed out connecting to HiveMQ")
        if motion_now:
            self.trigger_motion()
        last_heartbeat = 0.0
        try:
            while self.running:
                self.publish_cycle()
                if time.monotonic() - last_heartbeat >= self.config.heartbeat_seconds:
                    self.publish("availability", self.status_payload(), retain=True)
                    last_heartbeat = time.monotonic()
                if once:
                    break
                time.sleep(self.config.interval_seconds)
        finally:
            self.publish("status", self.status_payload("offline"))
            self.publish("availability", self.status_payload("offline"), retain=True)
            self.client.disconnect()
            self.client.loop_stop()


def parse_args():
    parser = argparse.ArgumentParser(description="Four-tier Automated Broiler Cage MQTT simulator")
    parser.add_argument("--scenario", choices=["normal", "hot", "high-gas"], default="normal")
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--motion-now", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--seed", type=int, default=None)
    return parser.parse_args()


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    args = parse_args()
    simulator = CageSimulator(SimulatorConfig(), scenario=args.scenario, seed=args.seed)
    if args.dry_run:
        print(json.dumps([simulator.generate_telemetry(tier, elapsed=0) for tier in range(1, 5)], indent=2))
        return
    signal.signal(signal.SIGINT, lambda *_: setattr(simulator, "running", False))
    signal.signal(signal.SIGTERM, lambda *_: setattr(simulator, "running", False))
    simulator.run(once=args.once, motion_now=args.motion_now)


if __name__ == "__main__":
    main()
