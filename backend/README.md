# Django backend

Receives cage telemetry from HiveMQ, stores normalized measurements, exposes REST endpoints, and broadcasts live events through Django Channels.

## Docker setup (recommended)

```bash
cp .env.example .env
# Generate a Django key:
python -c "import secrets; print(secrets.token_urlsafe(50))"
# Generate a URL-safe alphanumeric PostgreSQL password:
python -c "import secrets; print(secrets.token_hex(24))"
# Put those values and the HiveMQ TLS credentials in .env.
docker compose up --build -d
```

The Compose stack runs PostgreSQL, Redis, migrations, Django/Daphne and the dedicated MQTT subscriber. PostgreSQL and Redis stay private on the Compose network; Django connects to the service names `db` and `redis`. The API and WebSocket server is available at `http://localhost:8000`.

Use the generated PostgreSQL password in both `POSTGRES_PASSWORD` and the password portion of `DATABASE_URL`. Docker creates the `broiler` user and `broiler_cage` database on the first startup. Redis does not require a password in this local-only network.

Check that every service started correctly:

```bash
docker compose ps
docker compose logs -f web mqtt
```

Create the first administrator after the stack is healthy:

```bash
docker compose exec web python manage.py createsuperuser
```

Stop the stack without deleting database data:

```bash
docker compose down
```

Do not add `-v` unless you intentionally want to delete the PostgreSQL and Redis volumes.

## Optional non-Docker development

For quick unit tests, create a virtual environment and install `backend/requirements.txt`. If `DATABASE_URL` is absent, Django uses `backend/db.sqlite3`. A locally running Redis is still required to exercise WebSockets. The Docker setup above is the supported team workflow.

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
