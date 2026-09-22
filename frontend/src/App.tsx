import { FormEvent, useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricCard } from "./components/MetricCard";
import { TierCard } from "./components/TierCard";
import { useDashboardData } from "./hooks/useDashboardData";
import { acknowledgeAlert, createCage, getCurrentUser, listCages, loadDailyWeights, register, saveBatch, selectCage, signIn, signOut, telemetryExportUrl } from "./services/api";
import type { CageOption, DailyWeight, DashboardSnapshot, UserAccount } from "./types/telemetry";

type PageId = "overview" | "live" | "analytics" | "alerts" | "batches" | "maintenance" | "account";
const navigation: { id: PageId; label: string }[] = [
  { id: "overview", label: "Overview" }, { id: "live", label: "Live monitoring" },
  { id: "analytics", label: "Analytics" }, { id: "alerts", label: "Alerts" },
  { id: "batches", label: "Batches" }, { id: "maintenance", label: "Maintenance" },
  { id: "account", label: "Account & setup" }
];
const pageTitles: Record<PageId, string> = {
  overview: "Farm overview", live: "Live monitoring", analytics: "Analytics",
  alerts: "Alert centre", batches: "Batch management", maintenance: "Maintenance", account: "Account and cage setup"
};
const show = (value: number | null, digits = 1) => value === null ? "—" : value.toFixed(digits);

function TrendChart({ data }: { data: DashboardSnapshot }) {
  return <div className="chart-wrap" aria-label="Live temperature and humidity chart">
    {data.history.length === 0 ? <div className="empty-state">Waiting for historical telemetry.</div> :
      <ResponsiveContainer width="100%" height="100%"><LineChart data={data.history}>
        <CartesianGrid stroke="#e6ebe7" vertical={false} /><XAxis dataKey="time" tickLine={false} axisLine={false} />
        <YAxis yAxisId="temperature" domain={["auto", "auto"]} tickLine={false} axisLine={false} /><YAxis yAxisId="humidity" domain={["auto", "auto"]} orientation="right" tickLine={false} axisLine={false} />
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

function AnalyticsPage({ data, weights, user }: { data: DashboardSnapshot; weights: DailyWeight[]; user: UserAccount | null }) {
  const temperatures = data.tiers.flatMap((tier) => tier.temperatureC === null ? [] : [tier.temperatureC]);
  const range = temperatures.length ? `${Math.min(...temperatures).toFixed(1)}–${Math.max(...temperatures).toFixed(1)}°C` : "—";
  return <section className="page-stack"><div className="page-grid page-grid--four"><MetricCard label="Temperature range" value={range} note="Latest tier readings" />
    <MetricCard label="Average humidity" value={`${show(data.averageHumidityRh)}%`} note="Latest readings" accent="blue" /><MetricCard label="Active alerts" value={String(data.alerts.length)} note="Backend records" accent="amber" />
    <MetricCard label="History points" value={String(data.history.length)} note="Current 12-hour view" /></div><article className="panel"><div className="panel__header"><div><p className="eyebrow">ENVIRONMENTAL HISTORY</p><h2>Temperature and humidity</h2></div>{user && <a className="secondary-button link-button" href={telemetryExportUrl()}>Export telemetry CSV</a>}</div><TrendChart data={data} /></article>
    <article className="panel"><p className="eyebrow">DAILY WEIGHT GROWTH</p><h2>Average weight by tier</h2><div className="weight-table"><div className="weight-table__head"><span>Date</span><span>Tier</span><span>Average weight</span><span>Daily increase</span></div>{weights.map((row) => <div key={`${row.date}-${row.tier}`}><span>{row.date}</span><span>Tier {row.tier}</span><span>{row.average_weight_kg.toFixed(3)} kg</span><span>{row.daily_increase_kg === null ? "Baseline" : `${row.daily_increase_kg >= 0 ? "+" : ""}${row.daily_increase_kg.toFixed(3)} kg`}</span></div>)}</div>{!weights.length && <div className="empty-state">Daily weight records will appear after telemetry is collected across multiple dates.</div>}</article></section>;
}

function AlertsPage({ data, user, onAcknowledge }: { data: DashboardSnapshot; user: UserAccount | null; onAcknowledge: (id: number) => Promise<void> }) {
  return <section className="page-stack"><div className="summary-strip"><div><strong>{data.alerts.length}</strong><span>Open</span></div><div><strong>{data.alerts.filter((item) => item.severity === "critical").length}</strong><span>Critical</span></div><div><strong>{data.alerts.filter((item) => item.severity === "warning").length}</strong><span>Warnings</span></div></div>
    <article className="panel"><div className="panel__header"><div><p className="eyebrow">CURRENT EVENTS</p><h2>Alerts requiring attention</h2></div>{!user && <span className="tag">Sign in to acknowledge</span>}</div><div className="alert-table">{data.alerts.map((alert) => <div className="alert-row" key={alert.id}><span className={`severity-dot severity-dot--${alert.severity}`} /><div><strong>{alert.title}</strong><p>{alert.detail}</p><small>{alert.id}{alert.tier ? ` · Tier ${alert.tier}` : ""} · {alert.time}</small></div>{user && <button className="primary-button" disabled={alert.acknowledged} onClick={() => void onAcknowledge(Number(alert.id.replace("ALT-", "")))}>{alert.acknowledged ? "Acknowledged" : "Acknowledge"}</button>}</div>)}</div>{!data.alerts.length && <div className="empty-state">No unresolved alerts.</div>}</article></section>;
}

function BatchesPage({ data, user, onSaved }: { data: DashboardSnapshot; user: UserAccount | null; onSaved: () => void }) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = { batch_id: form.get("batch_id"), bird_count: Number(form.get("bird_count")), initial_total_weight_kg: Number(form.get("initial_total_weight_kg") || 0), current_total_weight_kg: Number(form.get("current_total_weight_kg") || 0), feed_consumed_kg: Number(form.get("feed_consumed_kg") || 0) };
    const startedAt = String(form.get("started_at") ?? ""); if (startedAt) body.started_at = startedAt;
    await saveBatch(body, data.birdCount !== null); onSaved();
  };
  return <section className="page-stack"><div className="panel batch-hero"><div><p className="eyebrow">ACTIVE BATCH</p><h2>{data.batchId}</h2><p className="muted">{data.birdCount === null ? "No active batch record is available." : `${data.birdCount} broilers`}</p></div><div><p className="eyebrow">AUTOMATIC AGE</p><h2>{data.birdAgeDays === null ? "—" : `Day ${data.birdAgeDays}`}</h2><p className="muted">Calculated daily from the recorded start date.</p></div></div>
    <article className="panel"><p className="eyebrow">FLOCK LOG</p><h2>{data.birdCount === null ? "Create active batch" : "Update active batch"}</h2>{user ? <form className="form-grid" onSubmit={(event) => void submit(event)}><label>Batch ID<input name="batch_id" defaultValue={data.batchId === "No active batch" ? "" : data.batchId} required /></label><label>Start date<input name="started_at" type="date" required={data.birdCount === null} /></label><label>Number of broilers<input name="bird_count" type="number" min="1" defaultValue={data.birdCount ?? ""} required /></label><label>Initial total weight (kg)<input name="initial_total_weight_kg" type="number" step="0.001" min="0" /></label><label>Current total weight (kg)<input name="current_total_weight_kg" type="number" step="0.001" min="0" /></label><label>Feed consumed (kg)<input name="feed_consumed_kg" type="number" step="0.001" min="0" /></label><button className="primary-button" type="submit">Save flock record</button></form> : <p className="muted">Sign in from Account & setup to create or update flock records.</p>}</article></section>;
}

function MaintenancePage({ data }: { data: DashboardSnapshot }) {
  return <section className="page-stack"><div className="page-grid page-grid--three"><MetricCard label="Device state" value={data.deviceState} note="Reported by backend" />
    <MetricCard label="Web telemetry" value={String(data.tiers.length)} note="Tiers reporting" accent="blue" /><MetricCard label="Last reading" value={data.lastUpdated} note="Most recent sample" accent="amber" /></div>
    <article className="panel"><p className="eyebrow">SENSOR SOURCES</p><h2>Connected tiers</h2><div className="maintenance-list">{data.tiers.map((tier) => <div key={tier.tier}><span className="connection-dot" /><div><strong>Tier {tier.tier}</strong><small>Source: {tier.source} · {new Date(tier.sampledAt).toLocaleString()}</small></div><b>{tier.state}</b></div>)}</div></article></section>;
}

function AccountPage({ user, cages, onUser, onCageCreated }: { user: UserAccount | null; cages: CageOption[]; onUser: (user: UserAccount | null) => void; onCageCreated: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState<string | null>(null);
  const authSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      const result = mode === "register" ? await register({ username: String(form.get("username")), email: String(form.get("email") ?? ""), password: String(form.get("password")) }) : await signIn({ username: String(form.get("username")), password: String(form.get("password")) });
      onUser(result); setMessage(null);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Account request failed"); }
  };
  const cageSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      const cage = await createCage({ farm_id: String(form.get("farm_id")), farm_name: String(form.get("farm_name")), cage_id: String(form.get("cage_id")), cage_name: String(form.get("cage_name")) });
      if (cage) { selectCage(cage.farm_id, cage.cage_id); onCageCreated(); window.location.reload(); }
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Cage setup failed"); }
  };
  if (!user) return <section className="page-stack"><article className="panel auth-panel"><div className="panel__header"><div><p className="eyebrow">SECURE ACCESS</p><h2>{mode === "login" ? "Sign in" : "Create operator account"}</h2></div><button className="text-button" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Register" : "Use existing account"}</button></div>{message && <div className="error-banner">{message}</div>}<form className="form-grid" onSubmit={(event) => void authSubmit(event)}><label>Username<input name="username" required minLength={3} /></label>{mode === "register" && <label>Email<input name="email" type="email" /></label>}<label>Password<input name="password" type="password" required minLength={8} /></label><button className="primary-button" type="submit">{mode === "login" ? "Sign in" : "Register"}</button></form></article></section>;
  return <section className="page-stack"><article className="panel"><div className="panel__header"><div><p className="eyebrow">SIGNED IN</p><h2>{user.username}</h2><p className="muted">{user.email || "No email supplied"}</p></div><button className="secondary-button" onClick={() => void signOut().then(() => onUser(null))}>Sign out</button></div></article>
    <article className="panel"><p className="eyebrow">AVAILABLE CAGES</p><h2>Select monitoring context</h2><div className="cage-list">{cages.map((cage) => <button className="secondary-button" key={`${cage.farm_id}-${cage.cage_id}`} onClick={() => { selectCage(cage.farm_id, cage.cage_id); window.location.reload(); }}>{cage.farm_name} · {cage.cage_name}</button>)}</div></article>
    <article className="panel"><p className="eyebrow">FARM AND CAGE SETUP</p><h2>Register monitoring location</h2>{message && <div className="error-banner">{message}</div>}<form className="form-grid" onSubmit={(event) => void cageSubmit(event)}><label>Farm ID<input name="farm_id" placeholder="farm01" required /></label><label>Farm name<input name="farm_name" placeholder="Pilot Farm" required /></label><label>Cage ID<input name="cage_id" placeholder="cage01" required /></label><label>Cage name<input name="cage_name" placeholder="Four-tier Cage 01" required /></label><button className="primary-button" type="submit">Save and select cage</button></form></article></section>;
}

function App() {
  const [page, setPage] = useState<PageId>("overview");
  const { snapshot: data, connectionState, loading, error, refresh } = useDashboardData();
  const [user, setUser] = useState<UserAccount | null>(null);
  const [cages, setCages] = useState<CageOption[]>([]);
  const [weights, setWeights] = useState<DailyWeight[]>([]);
  useEffect(() => { void getCurrentUser().then((account) => setUser(account)); }, []);
  useEffect(() => { if (user) void listCages().then((items) => setCages(items ?? [])); else setCages([]); }, [user]);
  useEffect(() => {
    const load = () => void loadDailyWeights().then((items) => setWeights(items ?? [])).catch(() => setWeights([]));
    load(); const timer = window.setInterval(load, 60000); return () => window.clearInterval(timer);
  }, []);
  const handleAcknowledge = async (id: number) => { await acknowledgeAlert(id); await refresh(); };
  const connectionLabel = connectionState === "live" ? "Dashboard connected" : connectionState;
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand__mark">IW</span><div><strong>InsightWorks</strong><small>Smart Poultry</small></div></div>
    <nav aria-label="Dashboard navigation">{navigation.map((item, index) => <button className={page === item.id ? "nav-item nav-item--active" : "nav-item"} key={item.id} onClick={() => setPage(item.id)}><span>{String(index + 1).padStart(2, "0")}</span>{item.label}</button>)}</nav>
    <div className="sidebar__footer"><span className={`connection-dot connection-dot--${connectionState}`} /><div><strong>{connectionLabel}</strong><small>{data.deviceState} cage device</small></div></div></aside>
    <main><header className="topbar"><div><p className="eyebrow">AUTOMATED BROILER CAGE</p><h1>{pageTitles[page]}</h1></div><div className="topbar__actions"><div className={`live-status live-status--${connectionState}`}><span className="pulse" />{connectionLabel} · device {data.deviceState} · {data.lastUpdated}</div><button className="profile" aria-label="User profile" onClick={() => setPage("account")}>{user ? user.username.slice(0, 2).toUpperCase() : "?"}</button></div></header>
      <div className="page-content">{loading && <div className="notice">Loading live cage data…</div>}{error && <div className="error-banner"><span>{error}</span><button onClick={refresh}>Try again</button></div>}
        {!loading && <>{page === "overview" && <OverviewPage data={data} openAlerts={() => setPage("alerts")} />}{page === "live" && <LivePage data={data} />}{page === "analytics" && <AnalyticsPage data={data} weights={weights} user={user} />}{page === "alerts" && <AlertsPage data={data} user={user} onAcknowledge={handleAcknowledge} />}{page === "batches" && <BatchesPage data={data} user={user} onSaved={() => void refresh()} />}{page === "maintenance" && <MaintenancePage data={data} />}{page === "account" && <AccountPage user={user} cages={cages} onUser={setUser} onCageCreated={() => void listCages().then((items) => setCages(items ?? []))} />}</>}</div></main></div>;
}

export default App;
