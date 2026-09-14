import type { TierReading } from "../types/telemetry";

interface TierCardProps {
  reading: TierReading;
}

export function TierCard({ reading }: TierCardProps) {
  return (
    <article className="tier-card">
      <div className="tier-card__header">
        <div>
          <p className="eyebrow">CAGE ZONE</p>
          <h3>Tier {reading.tier}</h3>
        </div>
        <span className={`state state--${reading.state}`}>
          {reading.state}
        </span>
      </div>
      <dl className="tier-card__metrics">
        <div>
          <dt>Temperature</dt>
          <dd>{reading.temperatureC.toFixed(1)}°C</dd>
        </div>
        <div>
          <dt>Humidity</dt>
          <dd>{reading.humidityRh}%</dd>
        </div>
        <div>
          <dt>Light</dt>
          <dd>{reading.lightLux} lx</dd>
        </div>
      </dl>
    </article>
  );
}
