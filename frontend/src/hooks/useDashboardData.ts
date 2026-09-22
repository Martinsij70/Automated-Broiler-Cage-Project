import { useCallback, useEffect, useMemo, useState } from "react";
import { CAGE_ID, FARM_ID, loadDashboardData } from "../services/api";
import { connectCageSocket } from "../services/websocket";
import type { ApiAlert, ApiTelemetryReading, ConnectionState, DashboardSnapshot, MetricState, TierReading } from "../types/telemetry";

const numberAverage = (values: Array<number | null>) => {
  const available = values.filter((value): value is number => value !== null);
  return available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : null;
};

const ageInDays = (date?: string) => date ? Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000)) : null;
const relativeTime = (value: string) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
};

function metricState(reading: ApiTelemetryReading): MetricState {
  const temperature = reading.sensors.temperature;
  const ammonia = reading.sensors.ammonia_ppm;
  const co2 = reading.sensors.co2_ppm;
  if ((temperature !== null && temperature > 32) || (ammonia !== null && ammonia > 25) || (co2 !== null && co2 > 3000)) return "critical";
  if (temperature !== null && (temperature < 20 || temperature > 30)) return "warning";
  return "normal";
}

function mapTier(reading: ApiTelemetryReading): TierReading {
  return {
    tier: reading.tier,
    temperatureC: reading.sensors.temperature,
    humidityRh: reading.sensors.humidity,
    lightLux: reading.sensors.lux,
    ammoniaPpm: reading.sensors.ammonia_ppm,
    co2Ppm: reading.sensors.co2_ppm,
    weightKg: reading.sensors.weight_kg,
    actuators: reading.actuators,
    state: metricState(reading),
    sampledAt: reading.sampled_at,
    source: reading.source
  };
}

export function useDashboardData() {
  const [latest, setLatest] = useState<ApiTelemetryReading[]>([]);
  const [history, setHistory] = useState<ApiTelemetryReading[]>([]);
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const [deviceState, setDeviceState] = useState<"online" | "stale" | "offline">("offline");
  const [batch, setBatch] = useState<Awaited<ReturnType<typeof loadDashboardData>>["batch"]>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const result = await loadDashboardData();
      setLatest(result.latest);
      setHistory(result.history);
      setAlerts(result.alerts);
      setDeviceState(result.status?.state ?? "offline");
      setBatch(result.batch);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load dashboard data");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => connectCageSocket((message) => {
    if (message.event === "telemetry") {
      const reading = message.data as ApiTelemetryReading;
      setLatest((current) => [...current.filter((item) => item.tier !== reading.tier), reading].sort((a, b) => a.tier - b.tier));
      setHistory((current) => [reading, ...current].slice(0, 100));
      setDeviceState("online");
    } else if (message.event === "status") {
      const status = message.data as { state?: "online" | "stale" | "offline" };
      if (status.state) setDeviceState(status.state);
    } else if (message.event === "alert" || message.event === "security_alert") {
      void refresh(true);
    }
  }, setConnectionState), [refresh]);

  const snapshot = useMemo<DashboardSnapshot>(() => {
    const tiers = latest.map(mapTier);
    const newest = latest.reduce<ApiTelemetryReading | null>((result, item) => !result || item.sampled_at > result.sampled_at ? item : result, null);
    const mappedAlerts = alerts.filter((item) => !item.resolved_at).map((item) => ({
      id: `ALT-${item.id}`,
      title: item.title,
      detail: item.detail,
      severity: item.severity,
      time: relativeTime(item.opened_at),
      tier: item.tier
    }));
    const orderedHistory = [...history].reverse().map((item) => ({
      time: new Date(item.sampled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      temperature: item.sensors.temperature,
      humidity: item.sensors.humidity,
      tier: item.tier
    }));
    return {
      farmName: FARM_ID,
      cageName: CAGE_ID,
      batchId: batch?.batch_id ?? "No active batch",
      birdAgeDays: ageInDays(batch?.started_at),
      birdCount: batch?.bird_count ?? null,
      deviceState,
      lastUpdated: newest ? relativeTime(newest.sampled_at) : "waiting for data",
      averageTemperatureC: numberAverage(tiers.map((item) => item.temperatureC)),
      averageHumidityRh: numberAverage(tiers.map((item) => item.humidityRh)),
      averageWeightKg: numberAverage(tiers.map((item) => item.weightKg)),
      co2Ppm: numberAverage(tiers.map((item) => item.co2Ppm)),
      ammoniaPpm: numberAverage(tiers.map((item) => item.ammoniaPpm)),
      tiers,
      history: orderedHistory,
      alerts: mappedAlerts
    };
  }, [alerts, batch, deviceState, history, latest]);

  return { snapshot, connectionState, loading, error, refresh: () => refresh() };
}
