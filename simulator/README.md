# Four-tier MQTT simulator

Publishes realistic development telemetry for all four cage tiers before the physical ESP32 and sensors are available. Every generated field is explicitly marked `simulated`; unavailable-mode fields are `null` and marked `unavailable`.

## Features

- Exact project MQTT topics with TLS and QoS 1
- Four telemetry messages per cycle, one per tier
- Normal, hot-tier, and high-gas scenarios
- Retained availability heartbeat and MQTT Last Will
- Status, command, config, alert, and acknowledgement flows
- Immediate simulated PIR-to-buzzer path
- Remote LED, fan, valve, heater, and buzzer commands
- Deterministic seeded generation for repeatable tests

## Setup

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r simulator/requirements.txt
cp .env.example .env
```

Use separate HiveMQ simulator credentials with permission to publish telemetry/status/availability/alerts/ack and subscribe to command/config. Never commit `.env`.

## Run

```bash
python simulator/simulator.py --dry-run
python simulator/simulator.py
python simulator/simulator.py --scenario hot
python simulator/simulator.py --scenario high-gas
python simulator/simulator.py --motion-now
python simulator/simulator.py --once
```

Set `SIMULATOR_FULL_SENSOR_SET=false` to produce `null` ammonia, CO2, and weight fields while those physical sensors are unavailable.

## Test

```bash
python -m unittest discover -s simulator -p "test_*.py" -v
```
