import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def _as_bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class SimulatorConfig:
    mqtt_host: str = os.getenv("MQTT_HOST", "")
    mqtt_port: int = int(os.getenv("MQTT_PORT", "8883"))
    mqtt_username: str = os.getenv("MQTT_SIMULATOR_USERNAME", os.getenv("MQTT_USERNAME", ""))
    mqtt_password: str = os.getenv("MQTT_SIMULATOR_PASSWORD", os.getenv("MQTT_PASSWORD", ""))
    topic_prefix: str = os.getenv("MQTT_TOPIC_PREFIX", "farm/farm01/cage/cage01")
    keepalive: int = int(os.getenv("MQTT_KEEPALIVE", "60"))
    farm_id: str = os.getenv("SIMULATOR_FARM_ID", "farm01")
    cage_id: str = os.getenv("SIMULATOR_CAGE_ID", "cage01")
    interval_seconds: float = float(os.getenv("SIMULATOR_INTERVAL_SECONDS", "5"))
    heartbeat_seconds: float = float(os.getenv("SIMULATOR_HEARTBEAT_SECONDS", "30"))
    motion_probability: float = float(os.getenv("SIMULATOR_MOTION_PROBABILITY", "0.01"))
    buzzer_hold_seconds: float = float(os.getenv("SIMULATOR_BUZZER_HOLD_SECONDS", "10"))
    full_sensor_set: bool = _as_bool("SIMULATOR_FULL_SENSOR_SET", True)

    def validate_for_connection(self) -> None:
        required = {"MQTT_HOST": self.mqtt_host, "MQTT_SIMULATOR_USERNAME": self.mqtt_username, "MQTT_SIMULATOR_PASSWORD": self.mqtt_password}
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
        if not 0 <= self.motion_probability <= 1:
            raise ValueError("SIMULATOR_MOTION_PROBABILITY must be between 0 and 1")
