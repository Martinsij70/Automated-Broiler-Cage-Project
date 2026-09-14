interface MetricCardProps {
  label: string;
  value: string;
  note: string;
  accent?: "green" | "amber" | "blue";
}

export function MetricCard({
  label,
  value,
  note,
  accent = "green"
}: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${accent}`}>
      <p className="metric-card__label">{label}</p>
      <p className="metric-card__value">{value}</p>
      <p className="metric-card__note">{note}</p>
    </article>
  );
}
