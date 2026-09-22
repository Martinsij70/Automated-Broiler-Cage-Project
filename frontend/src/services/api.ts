import type { ActiveBatch, ApiAlert, ApiTelemetryReading, DeviceState } from "../types/telemetry";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
export const FARM_ID = import.meta.env.VITE_FARM_ID ?? "farm01";
export const CAGE_ID = import.meta.env.VITE_CAGE_ID ?? "cage01";

interface Paginated<T> {
  results: T[];
}

interface DeviceStatus {
  device_id: string;
  state: DeviceState;
  last_seen_at: string | null;
}

async function request<T>(path: string, optional = false): Promise<T | null> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
    credentials: "include"
  });
  if (optional && response.status === 404) return null;
  if (!response.ok) throw new Error(`API request failed (${response.status}) for ${path}`);
  return response.json() as Promise<T>;
}

const cagePath = `/farms/${encodeURIComponent(FARM_ID)}/cages/${encodeURIComponent(CAGE_ID)}`;

export async function loadDashboardData() {
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const [latest, historyResponse, alertsResponse, status, batch] = await Promise.all([
    request<ApiTelemetryReading[]>(`${cagePath}/telemetry/latest/`),
    request<Paginated<ApiTelemetryReading> | ApiTelemetryReading[]>(`${cagePath}/telemetry/history/?since=${encodeURIComponent(since)}`),
    request<Paginated<ApiAlert> | ApiAlert[]>(`${cagePath}/alerts/`),
    request<DeviceStatus>(`${cagePath}/status/`),
    request<ActiveBatch>(`${cagePath}/batch/active/`, true)
  ]);
  const unwrap = <T,>(value: Paginated<T> | T[] | null): T[] => value ? (Array.isArray(value) ? value : value.results) : [];
  return {
    latest: latest ?? [],
    history: unwrap(historyResponse),
    alerts: unwrap(alertsResponse),
    status,
    batch
  };
}
