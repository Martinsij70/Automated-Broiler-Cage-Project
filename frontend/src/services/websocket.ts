import { CAGE_ID, FARM_ID } from "./api";
import type { CageEvent, ConnectionState } from "../types/telemetry";

const explicitUrl = import.meta.env.VITE_WS_BASE_URL as string | undefined;

function websocketBaseUrl(): string {
  if (explicitUrl) return explicitUrl.replace(/\/$/, "");
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.hostname}:8000`;
}

export function connectCageSocket(
  onEvent: (message: CageEvent) => void,
  onState: (state: ConnectionState) => void
): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;
  let retryTimer: number | undefined;
  let attempt = 0;

  const connect = () => {
    if (stopped) return;
    onState(attempt ? "reconnecting" : "connecting");
    socket = new WebSocket(`${websocketBaseUrl()}/ws/farms/${encodeURIComponent(FARM_ID)}/cages/${encodeURIComponent(CAGE_ID)}/`);
    socket.onopen = () => { attempt = 0; onState("live"); };
    socket.onmessage = (message) => {
      try { onEvent(JSON.parse(message.data) as CageEvent); }
      catch { console.warn("Ignored malformed WebSocket message"); }
    };
    socket.onerror = () => socket?.close();
    socket.onclose = () => {
      if (stopped) return;
      onState("reconnecting");
      const delay = Math.min(1000 * 2 ** attempt, 30000);
      attempt += 1;
      retryTimer = window.setTimeout(connect, delay);
    };
  };

  connect();
  return () => {
    stopped = true;
    if (retryTimer) window.clearTimeout(retryTimer);
    socket?.close();
    onState("offline");
  };
}
