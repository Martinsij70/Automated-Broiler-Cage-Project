import type { TierReading } from "../types/telemetry";

interface TierCardProps { reading: TierReading; }
const show = (value: number | null, digits = 1) => value === null ? "—" : value.toFixed(digits);

export function TierCard({ reading }: TierCardProps) {
  return <article className="tier-card"><div className="tier-card__header"><div><p className="eyebrow">CAGE ZONE</p><h3>Tier {reading.tier}</h3></div><span className={`state state--${reading.state}`}>{reading.state}</span></div>
    <dl className="tier-card__metrics"><div><dt>Temperature</dt><dd>{show(reading.temperatureC)}°C</dd></div><div><dt>Humidity</dt><dd>{show(reading.humidityRh)}%</dd></div><div><dt>Light</dt><dd>{show(reading.lightLux, 0)} lx</dd></div><div><dt>Ammonia</dt><dd>{show(reading.ammoniaPpm)} ppm</dd></div><div><dt>CO₂</dt><dd>{show(reading.co2Ppm, 0)} ppm</dd></div><div><dt>Weight</dt><dd>{show(reading.weightKg, 2)} kg</dd></div></dl>
    <p className="tier-card__source">{reading.source} · {new Date(reading.sampledAt).toLocaleTimeString()}</p>
  </article>;
}
