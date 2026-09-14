export type DeviceState = "online" | "stale" | "offline";
export type MetricState = "normal" | "warning" | "critical";

export interface TierReading {
  tier: number;
  temperatureC: number;
  humidityRh: number;
  lightLux: number;
  state: MetricState;
}

export interface HistoryPoint {
  time: string;
  temperature: number;
  humidity: number;
}

export interface AlertItem {
  id: string;
  title: string;
  detail: string;
  severity: "warning" | "critical";
  time: string;
}

export interface DashboardSnapshot {
  farmName: string;
  cageName: string;
  batchId: string;
  birdAgeDays: number;
  birdCount: number;
  deviceState: DeviceState;
  lastUpdated: string;
  averageTemperatureC: number;
  averageHumidityRh: number;
  feedKg: number;
  waterLevelPercent: number;
  co2Ppm: number;
  gasIndex: number;
  tiers: TierReading[];
  history: HistoryPoint[];
  alerts: AlertItem[];
}
