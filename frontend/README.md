# Frontend

Responsive monitoring dashboard built with React, TypeScript and Vite.

## Included in the first interface

- Farm, cage and batch summary
- Device online status and data freshness
- Six cage-level measurement cards
- Four-tier temperature, humidity and light cards
- Temperature and humidity trend chart
- Active-alert cards
- Responsive desktop, tablet and phone layouts
- Typed realistic mock telemetry

## Run locally

Requirements: a Node.js release supported by the Vite version in `package.json`.

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

## Current data source

The first interface reads typed mock data from `src/data/mockData.ts`. This intentionally lets the interface progress before the Django and HiveMQ pipeline is ready.

The integration phase will replace the mock import with:

- Django REST Framework for current and historical records
- Django Channels or another authenticated live-data channel
- Clear loading, stale, offline and error states

The browser will not receive ESP32 or HiveMQ device credentials.
