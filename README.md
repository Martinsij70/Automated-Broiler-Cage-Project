# Automated Broiler Cage Project

An intelligent broiler-cage monitoring and control platform developed by the InsightWorks project team.

The system will collect live environmental and operational data from an ESP32-based cage controller, transmit telemetry securely through HiveMQ Cloud, store validated records in Django/PostgreSQL, and present live and historical information through a responsive React dashboard.

## Repository structure

```text
.
├── firmware/          # ESP32 firmware and sensor integration
├── backend/           # Django and Django REST Framework
├── frontend/          # React and TypeScript dashboard
├── simulator/         # Simulated MQTT telemetry for development
├── docs/              # Architecture and setup documentation
├── .env.example       # Safe configuration template
├── .gitignore         # Excluded secrets and generated files
└── docker-compose.yml # Local PostgreSQL and Redis services
```

## Planned technology stack

- ESP32 with Arduino framework or ESP-IDF
- HiveMQ Cloud using MQTT over TLS
- Django and Django REST Framework
- PostgreSQL
- Redis
- React and TypeScript

## First milestone

Build and verify the complete monitoring path:

```text
Simulator or ESP32
    -> HiveMQ Cloud
    -> Django ingestion worker
    -> PostgreSQL
    -> React live dashboard
```

Automatic safety control will remain local to the ESP32 so essential cage protection does not depend on the cloud or internet connection.

## Local backend stack

After creating a root `.env` from `.env.example`, the complete backend starts with:

```bash
docker compose up --build -d
```

This runs PostgreSQL, Redis, database migrations, Django/Daphne and the HiveMQ subscriber. See `backend/README.md` for configuration, verification and administrator setup.

## Security

Never commit Wi-Fi passwords, MQTT credentials, Django secrets or production database passwords. Copy `.env.example` to `.env` locally and supply real values only in the local or deployment environment.
