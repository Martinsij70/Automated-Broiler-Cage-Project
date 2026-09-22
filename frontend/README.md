# Frontend

Responsive monitoring dashboard built with React, TypeScript and Vite. It now uses the Django REST API for the initial snapshot and history, then Django Channels WebSockets for live telemetry, status and alert updates.

## Configure

Copy the example environment file:

```bash
cd frontend
cp .env.example .env
```

Defaults target the local Docker backend at `http://localhost:8000`, farm `farm01` and cage `cage01`. Change only the public browser endpoints and cage identifiers here. Never place HiveMQ device credentials in the frontend.

## Run locally

Start the backend from the repository root:

```bash
docker compose up -d --build
```

Then start React:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The dashboard loads:

- Latest four-tier readings from REST
- Twelve hours of telemetry history
- Device state and active alerts
- Active flock batch when one exists
- Live telemetry, status and alert events through WebSocket

If the WebSocket disconnects, the client reconnects with bounded exponential backoff. REST errors show a retry control rather than silently displaying mock readings.

## Verify

```bash
npm run build
```

With the simulator running, confirm that all four tier cards update without refreshing the browser. Stop the simulator and confirm device status eventually becomes stale or offline. Run the `hot`, `high-gas` and motion scenarios to verify alert updates.

## Production

Set `VITE_API_BASE_URL` to the public HTTPS API and `VITE_WS_BASE_URL` to its WSS origin before building. The frontend never connects directly to HiveMQ.
