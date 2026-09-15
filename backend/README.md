# Django backend

Receives cage telemetry from HiveMQ, stores normalized measurements, exposes REST endpoints, and broadcasts live events through Django Channels.

## Local setup

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
cp .env.example .env
python backend/manage.py migrate
python backend/manage.py createsuperuser
python backend/manage.py runserver
```

Run PostgreSQL and Redis with `docker compose up -d db redis`. SQLite is used automatically only when `DATABASE_URL` is absent, which is convenient for local tests.

Run the dedicated HiveMQ subscriber separately:

```bash
python backend/manage.py runmqtt
```

## API

All REST routes begin with `/api/v1/farms/{farm_id}/cages/{cage_id}/`:

- `telemetry/latest/`
- `telemetry/history/?tier=1&since=...`
- `alerts/`
- `security-events/`
- `status/`
- `thresholds/`
- `commands/`
- `batch/active/`

Read endpoints are public for initial dashboard integration. Threshold changes and actuator commands require an authenticated Django user. Add farm-level membership authorization before a multi-farm production release.

WebSocket: `/ws/farms/{farm_id}/cages/{cage_id}/`.

Missing hardware values are returned as `null`. The `source` field distinguishes hardware and simulator records, while `field_quality` labels values as live, simulated, or unavailable.
