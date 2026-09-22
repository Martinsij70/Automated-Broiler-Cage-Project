import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricCard } from "./components/MetricCard";
import { TierCard } from "./components/TierCard";
import { useDashboardData } from "./hooks/useDashboardData";
import type { DashboardSnapshot } from "./types/telemetry";

type PageId = "overview" | "live" | "analytics" | "alerts" | "batches" | "maintenance";
const navigation: { id: PageId; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "live", label: "Live monitoring" },
  { id: "analytics", label: "Analytics" }, { id: "alerts", label: "Alerts" },
  { id: "batches", label: "Batches" }, { id: "maintenance", label: "Maintenance" }
];
const pageTitles: Record<PageId, string> = {
  overview: "Farm overview", live: "Live monitoring", analytics: "Analytics",
  alerts: "Alert centre", batches: "Batch management", maintenance: "Maintenance"
};
const show = (value: number | null, digits = 1) => value === null ? "—" : value.toFixed(digits);

function TrendChart({ data }: { data: DashboardSnapshot }) {
  return <div className="chart-wrap" aria-label="Live temperature and humidity chart">
    {data.history.length === 0 ? <div className="empty-state">Waiting for historical telemetry.</div> :
      <ResponsiveContainer width="100%" height="100%"><LineChart data={data.history}>
        <CartesianGrid stroke="#e6ebe7" vertical={false} /><XAxis dataKey="time" tickLine={false} axisLine={false} />
        <YAxis yAxisId="temperature" tickLine={false} axisLine={false} /><YAxis yAxisId="humidity" orientation="right" tickLine={false} axisLine={false} />
        <Tooltip /><Line yAxisId="temperature" type="monotone" dataKey="temperature" stroke="#16794b" strokeWidth={3} dot={false} connectNulls />
        <Line yAxisId="humidity" type="monotone" dataKey="humidity" stroke="#3b82b5" strokeWidth={3} dot={false} connectNulls />
      </LineChart></ResponsiveContainer>}
  </div>;
}

function TierGrid({ data }: { data: DashboardSnapshot }) {
  if (!data.tiers.length) return <div className="panel empty-state">No live tier readings yet. Start the simulator or connect the cage controller.</div>;
  return <div className="tiers-grid">{data.tiers.map((tier) => <TierCard reading={tier} key={tier.tier} />)}</div>;
}

function OverviewPage({ data, openAlerts }: { data: DashboardSnapshot; openAlerts: () => void }) {
  return <>
    <section className="hero"><div><p className="eyebrow">CURRENT OPERATION</p><h2>{data.cageName}</h2><p>{data.farmName} · {data.batchId}</p></div>
      <div className="hero__stats"><div><span>Bird age</span><strong>{data.birdAgeDays === null ? "—" : `Day ${data.birdAgeDays}`}</strong></div>
        <div><span>Population</span><strong>{data.birdCount === null ? "—" : `${data.birdCount} birds`}</strong></div>
        <div><span>Device</span><strong className={data.deviceState === "online" ? "online" : "offline-text"}>{data.deviceState}</strong></div></div></section>
    <section className="metrics-grid" aria-label="Current cage measurements">
      <MetricCard label="Avg. temperature" value={`${show(data.averageTemperatureC)}°C`} note="Across available tiers" />
      <MetricCard label="Avg. humidity" value={`${show(data.averageHumidityRh)}%`} note="Across available tiers" accent="blue" />
      <MetricCard label="Avg. weight" value={`${show(data.averageWeightKg, 2)} kg`} note="Sensor estimate" accent="amber" />
      <MetricCard label="CO₂" value={`${show(data.co2Ppm, 0)} ppm`} note="Average available reading" />
      <MetricCard label="Ammonia" value={`${show(data.ammoniaPpm, 1)} ppm`} note="Average available reading" accent="amber" />
      <MetricCard label="Active alerts" value={String(data.alerts.length)} note="Unresolved events" accent={data.alerts.length ? "amber" : "green"} />
    </section>
    <section className="content-grid"><article className="panel chart-panel"><div className="panel__header"><div><p className="eyebrow">ENVIRONMENTAL TREND</p><h2>Last 12 hours</h2></div><span className="tag">REST + WebSocket</span></div><TrendChart data={data} /></article>
      <article className="panel alerts-panel"><div className="panel__header"><div><p className="eyebrow">ATTENTION NEEDED</p><h2>Active alerts</h2></div><span className="alert-count">{data.alerts.length}</span></div>
        <div className="alert-list">{data.alerts.slice(0, 4).map((alert) => <div className={`alert alert--${alert.severity}`} key={alert.id}><div className="alert__topline"><strong>{alert.title}</strong><time>{alert.time}</time></div><p>{alert.detail}</p></div>)}</div>
        {!data.alerts.length && <p className="muted">No unresolved alerts.</p>}<button className="text-button" onClick={openAlerts}>Open alert centre →</button></article></section>
    <section className="tiers-section"><div className="section-heading"><div><p className="eyebrow">FOUR-TIER MONITORING</p><h2>Tier conditions</h2></div><p>Live backend readings using current demonstration thresholds.</p></div><TierGrid data={data} /></section>
  </>;
}

function LivePage({ data }: { data: DashboardSnapshot }) {
  const actuators = data.tiers[0]?.actuators ?? {};
  return <section className="page-stack"><div className="notice"><span className="pulse" /><strong>Receiving live cage data</strong><span>Updated {data.lastUpdated}</span></div><TierGrid data={data} />
    <div className="page-grid page-grid--three"><article className="panel"><p className="eyebrow">AIR QUALITY</p><h2>{show(data.co2Ppm, 0)} ppm CO₂</h2><p className="muted">Ammonia: {show(data.ammoniaPpm)} ppm</p></article>
      <article className="panel"><p className="eyebrow">WEIGHT</p><h2>{show(data.averageWeightKg, 2)} kg</h2><p className="muted">Average across available tier sensors</p></article>
      <article className="panel"><p className="eyebrow">ACTUATORS · TIER 1</p><div className="status-list">{Object.keys(actuators).length ? Object.entries(actuators).map(([name, on]) => <span key={name}>{name.replaceAll("_", " ")}<b className={`pill ${on ? "pill--on" : ""}`}>{on ? "On" : "Off"}</b></span>) : <p className="muted">Waiting for actuator state.</p>}</div></article></div>
    <article className="panel"><div className="panel__header"><div><p className="eyebrow">LIVE TREND</p><h2>Environmental readings</h2></div><span className="tag">Live stream</span></div><TrendChart data={data} /></article></section>;
}

function AnalyticsPage({ data }: { data: DashboardSnapshot }) {
  const temperatures = data.tiers.flatMap((tier) => tier.temperatureC === null ? [] : [tier.temperatureC]);
  const range = temperatures.length ? `${Math.min(...temperatures).toFixed(1)}–${Math.max(...temperatures).toFixed(1)}°C` : "—";
  return <section className="page-stack"><div className="page-grid page-grid--four"><MetricCard label="Temperature range" value={range} note="Latest tier readings" />
    <MetricCard label="Average humidity" value={`${show(data.averageHumidityRh)}%`} note="Latest readings" accent="blue" /><MetricCard label="Active alerts" value={String(data.alerts.length)} note="Backend records" accent="amber" />
    <MetricCard label="History points" value={String(data.history.length)} note="Current 12-hour view" /></div><article className="panel"><p className="eyebrow">ENVIRONMENTAL HISTORY</p><h2>Temperature and humidity</h2><TrendChart data={data} /></article></section>;
}

function AlertsPage({ data }: { data: DashboardSnapshot }) {
  return <section className="page-stack"><div className="summary-strip"><div><strong>{data.alerts.length}</strong><span>Open</span></div><div><strong>{data.alerts.filter((item) => item.severity === "critical").length}</strong><span>Critical</span></div><div><strong>{data.alerts.filter((item) => item.severity === "warning").length}</strong><span>Warnings</span></div></div>
    <article className="panel"><div className="panel__header"><div><p className="eyebrow">CURRENT EVENTS</p><h2>Alerts requiring attention</h2></div></div><div className="alert-table">{data.alerts.map((alert) => <div className="alert-row" key={alert.id}><span className={`severity-dot severity-dot--${alert.severity}`} /><div><strong>{alert.title}</strong><p>{alert.detail}</p><small>{alert.id}{alert.tier ? ` · Tier ${alert.tier}` : ""} · {alert.time}</small></div></div>)}</div>{!data.alerts.length && <div className="empty-state">No unresolved alerts.</div>}</article></section>;
}

function BatchesPage({ data }: { data: DashboardSnapshot }) {
  return <section className="page-stack"><div className="panel batch-hero"><div><p className="eyebrow">ACTIVE BATCH</p><h2>{data.batchId}</h2><p className="muted">{data.birdCount === null ? "No active batch record is available." : `${data.birdCount} broilers`}</p></div><div><p className="eyebrow">AGE</p><h2>{data.birdAgeDays === null ? "—" : `Day ${data.birdAgeDays}`}</h2></div></div></section>;
}

function MaintenancePage({ data }: { data: DashboardSnapshot }) {
  return <section className="page-stack"><div className="page-grid page-grid--three"><MetricCard label="Device state" value={data.deviceState} note="Reported by backend" />
    <MetricCard label="Web telemetry" value={String(data.tiers.length)} note="Tiers reporting" accent="blue" /><MetricCard label="Last reading" value={data.lastUpdated} note="Most recent sample" accent="amber" /></div>
    <article className="panel"><p className="eyebrow">SENSOR SOURCES</p><h2>Connected tiers</h2><div className="maintenance-list">{data.tiers.map((tier) => <div key={tier.tier}><span className="connection-dot" /><div><strong>Tier {tier.tier}</strong><small>Source: {tier.source} · {new Date(tier.sampledAt).toLocaleString()}</small></div><b>{tier.state}</b></div>)}</div></article></section>;
}

function App() {
  const [page, setPage] = useState<PageId>("overview");
  const { snapshot: data, connectionState, loading, error, refresh } = useDashboardData();
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand__mark">IW</span><div><strong>InsightWorks</strong><small>Smart Poultry</small></div></div>
    <nav aria-label="Dashboard navigation">{navigation.map((item, index) => <button className={page === item.id ? "nav-item nav-item--active" : "nav-item"} key={item.id} onClick={() => setPage(item.id)}><span>{String(index + 1).padStart(2, "0")}</span>{item.label}</button>)}</nav>
    <div className="sidebar__footer"><span className={`connection-dot connection-dot--${connectionState}`} /><div><strong>{connectionState === "live" ? "Live connection" : connectionState}</strong><small>{data.deviceState} device</small></div></div></aside>
    <main><header className="topbar"><div><p className="eyebrow">AUTOMATED BROILER CAGE</p><h1>{pageTitles[page]}</h1></div><div className="topbar__actions"><div className={`live-status live-status--${connectionState}`}><span className="pulse" />{connectionState} · {data.lastUpdated}</div><button className="profile" aria-label="User profile">AT</button></div></header>
      <div className="page-content">{loading && <div className="notice">Loading live cage data…</div>}{error && <div className="error-banner"><span>{error}</span><button onClick={refresh}>Try again</button></div>}
        {!loading && <>{page === "overview" && <OverviewPage data={data} openAlerts={() => setPage("alerts")} />}{page === "live" && <LivePage data={data} />}{page === "analytics" && <AnalyticsPage data={data} />}{page === "alerts" && <AlertsPage data={data} />}{page === "batches" && <BatchesPage data={data} />}{page === "maintenance" && <MaintenancePage data={data} />}</>}</div></main></div>;
}

export default App;
