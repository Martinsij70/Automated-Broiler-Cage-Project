export type DeviceState = "online" | "stale" | "offline";
export type MetricState = "normal" | "warning" | "critical";
export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline";

export interface SensorValues {
  temperature: number | null;
  humidity: number | null;
  lux: number | null;
  ammonia_ppm: number | null;
  co2_ppm: number | null;
  weight_kg: number | null;
}

export interface ApiTelemetryReading {
  id: number;
  farm_id: string;
  cage_id: string;
  tier: number;
  sampled_at: string;
  received_at: string;
  source: "hardware" | "simulator";
  sensors: SensorValues;
  actuators: Record<string, boolean>;
  field_quality: Record<string, string>;
}

export interface TierReading {
  tier: number;
  temperatureC: number | null;
  humidityRh: number | null;
  lightLux: number | null;
  ammoniaPpm: number | null;
  co2Ppm: number | null;
  weightKg: number | null;
  actuators: Record<string, boolean>;
  state: MetricState;
  sampledAt: string;
  source: "hardware" | "simulator";
}

export interface HistoryPoint {
  time: string;
  temperature: number | null;
  humidity: number | null;
  tier: number;
}

export interface ApiAlert {
  id: number;
  tier: number | null;
  code: string;
  title: string;
  detail: string;
  severity: "warning" | "critical";
  opened_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export interface AlertItem {
  id: string;
  title: string;
  detail: string;
  severity: "warning" | "critical";
  time: string;
  tier: number | null;
  acknowledged: boolean;
}

export interface ActiveBatch {
  batch_id: string;
  started_at: string;
  bird_count: number;
  current_total_weight_kg: string;
  feed_consumed_kg: string;
  active: boolean;
}

export interface UserAccount { id: number; username: string; email: string; }
export interface CageOption { farm_id: string; farm_name: string; cage_id: string; cage_name: string; }
export interface DailyWeight { date: string; tier: number; average_weight_kg: number; daily_increase_kg: number | null; }

export interface DashboardSnapshot {
  farmName: string;
  cageName: string;
  batchId: string;
  birdAgeDays: number | null;
  birdCount: number | null;
  deviceState: DeviceState;
  lastUpdated: string;
  averageTemperatureC: number | null;
  averageHumidityRh: number | null;
  averageWeightKg: number | null;
  co2Ppm: number | null;
  ammoniaPpm: number | null;
  tiers: TierReading[];
  history: HistoryPoint[];
  alerts: AlertItem[];
}

export interface CageEvent {
  event: "telemetry" | "status" | "alert" | "security_alert" | "command_ack";
  data: unknown;
}
