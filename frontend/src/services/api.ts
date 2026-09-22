import type { ActiveBatch, ApiAlert, ApiTelemetryReading, CageOption, DailyWeight, DeviceState, UserAccount } from "../types/telemetry";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
const defaultFarmId = import.meta.env.VITE_FARM_ID ?? "farm01";
const defaultCageId = import.meta.env.VITE_CAGE_ID ?? "cage01";
export const selectedCage = () => ({
  farmId: localStorage.getItem("broiler.farmId") ?? defaultFarmId,
  cageId: localStorage.getItem("broiler.cageId") ?? defaultCageId
});
export function selectCage(farmId: string, cageId: string) {
  localStorage.setItem("broiler.farmId", farmId);
  localStorage.setItem("broiler.cageId", cageId);
}

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

function cookie(name: string): string {
  return document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.split("=").slice(1).join("=") ?? "";
}

async function mutate<T>(path: string, method: "POST" | "PATCH", body?: unknown): Promise<T | null> {
  await request("/auth/csrf/");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": decodeURIComponent(cookie("csrftoken")) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail ?? `Request failed (${response.status})`);
  return payload as T;
}

const cagePath = () => {
  const { farmId, cageId } = selectedCage();
  return `/farms/${encodeURIComponent(farmId)}/cages/${encodeURIComponent(cageId)}`;
};

export async function loadDashboardData() {
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const [latest, historyResponse, alertsResponse, status, batch] = await Promise.all([
    request<ApiTelemetryReading[]>(`${cagePath()}/telemetry/latest/`),
    request<Paginated<ApiTelemetryReading> | ApiTelemetryReading[]>(`${cagePath()}/telemetry/history/?since=${encodeURIComponent(since)}`),
    request<Paginated<ApiAlert> | ApiAlert[]>(`${cagePath()}/alerts/`),
    request<DeviceStatus>(`${cagePath()}/status/`),
    request<ActiveBatch>(`${cagePath()}/batch/active/`, true)
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

export const getCurrentUser = () => request<UserAccount>("/auth/me/");
export const register = (body: { username: string; email: string; password: string }) => mutate<UserAccount>("/auth/register/", "POST", body);
export const signIn = (body: { username: string; password: string }) => mutate<UserAccount>("/auth/login/", "POST", body);
export const signOut = () => mutate<never>("/auth/logout/", "POST");
export const listCages = () => request<CageOption[]>("/setup/cages/");
export const createCage = (body: { farm_id: string; farm_name: string; cage_id: string; cage_name: string }) => mutate<CageOption>("/setup/cages/", "POST", body);
export const saveBatch = (body: Record<string, unknown>, update: boolean) => mutate<ActiveBatch>(`${cagePath()}/batch/active/`, update ? "PATCH" : "POST", body);
export const acknowledgeAlert = (id: number) => mutate<ApiAlert>(`${cagePath()}/alerts/${id}/acknowledge/`, "POST");
export const loadDailyWeights = () => request<DailyWeight[]>(`${cagePath()}/weight/daily/`);
export const telemetryExportUrl = () => `${API_BASE_URL}${cagePath()}/telemetry/export.csv`;
