import type { DashboardSnapshot } from "../types/telemetry";

export const dashboardSnapshot: DashboardSnapshot = {
  farmName: "InsightWorks Pilot Farm",
  cageName: "Four-Tier Cage 01",
  batchId: "BATCH-2026-001",
  birdAgeDays: 18,
  birdCount: 200,
  deviceState: "online",
  lastUpdated: "8 seconds ago",
  averageTemperatureC: 29.8,
  averageHumidityRh: 68,
  feedKg: 28.5,
  waterLevelPercent: 72,
  co2Ppm: 920,
  gasIndex: 145,
  tiers: [
    { tier: 1, temperatureC: 29.1, humidityRh: 66, lightLux: 320, state: "normal" },
    { tier: 2, temperatureC: 29.6, humidityRh: 68, lightLux: 314, state: "normal" },
    { tier: 3, temperatureC: 30.1, humidityRh: 69, lightLux: 306, state: "warning" },
    { tier: 4, temperatureC: 30.4, humidityRh: 70, lightLux: 298, state: "normal" }
  ],
  history: [
    { time: "06:00", temperature: 27.8, humidity: 72 },
    { time: "08:00", temperature: 28.4, humidity: 70 },
    { time: "10:00", temperature: 29.1, humidity: 69 },
    { time: "12:00", temperature: 30.0, humidity: 67 },
    { time: "14:00", temperature: 30.4, humidity: 66 },
    { time: "16:00", temperature: 29.8, humidity: 68 }
  ],
  alerts: [
    {
      id: "ALT-104",
      title: "Tier 3 temperature trending high",
      detail: "Temperature has remained above the demonstration target for 4 minutes.",
      severity: "warning",
      time: "2 min ago"
    },
    {
      id: "ALT-099",
      title: "Feed refill approaching",
      detail: "Estimated feed remaining is 28.5 kg.",
      severity: "warning",
      time: "42 min ago"
    }
  ]
};
