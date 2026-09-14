# System Architecture

The initial data path is:

```text
ESP32 or simulator
    -> HiveMQ Cloud over MQTT/TLS
    -> Django MQTT ingestion worker
    -> PostgreSQL
    -> Django REST API and live-data channel
    -> React dashboard
```

Essential environmental protection must run locally on the ESP32 and must not depend on the dashboard, cloud server or internet connection.

## Initial milestone

1. Publish simulated temperature and humidity.
2. Receive and validate telemetry in Django.
3. Store measurements in PostgreSQL.
4. Display current and historical readings in React.
5. Show device online, stale and offline states.
