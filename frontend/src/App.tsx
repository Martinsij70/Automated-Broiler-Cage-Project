import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { MetricCard } from "./components/MetricCard";
import { TierCard } from "./components/TierCard";
import { dashboardSnapshot as data } from "./data/mockData";

type PageId = "overview" | "live" | "analytics" | "alerts" | "batches" | "maintenance";

const navigation: { id: PageId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "live", label: "Live monitoring" },
  { id: "analytics", label: "Analytics" },
  { id: "alerts", label: "Alerts" },
  { id: "batches", label: "Batches" },
  { id: "maintenance", label: "Maintenance" }
];

const pageTitles: Record<PageId, string> = {
  overview: "Farm overview",
  live: "Live monitoring",
  analytics: "Analytics",
  alerts: "Alert centre",
  batches: "Batch management",
  maintenance: "Maintenance"
};

const dailyPerformance = [
  { day: "Mon", feed: 31, water: 76 },
  { day: "Tue", feed: 30, water: 74 },
  { day: "Wed", feed: 29, water: 73 },
  { day: "Thu", feed: 29, water: 72 },
  { day: "Fri", feed: 28, water: 72 }
];

function TrendChart() {
  return (
    <div className="chart-wrap" aria-label="Temperature and humidity chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.history}>
          <CartesianGrid stroke="#e6ebe7" vertical={false} />
          <XAxis dataKey="time" tickLine={false} axisLine={false} />
          <YAxis yAxisId="temperature" tickLine={false} axisLine={false} domain={[24, 34]} />
          <YAxis yAxisId="humidity" orientation="right" tickLine={false} axisLine={false} domain={[50, 80]} />
          <Tooltip />
          <Line yAxisId="temperature" type="monotone" dataKey="temperature" stroke="#16794b" strokeWidth={3} dot={false} />
          <Line yAxisId="humidity" type="monotone" dataKey="humidity" stroke="#3b82b5" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function OverviewPage({ openAlerts }: { openAlerts: () => void }) {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">CURRENT OPERATION</p>
          <h2>{data.cageName}</h2>
          <p>{data.farmName} · {data.batchId}</p>
        </div>
        <div className="hero__stats">
          <div><span>Bird age</span><strong>Day {data.birdAgeDays}</strong></div>
          <div><span>Population</span><strong>{data.birdCount} birds</strong></div>
          <div><span>Device</span><strong className="online">Online</strong></div>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Current cage measurements">
        <MetricCard label="Avg. temperature" value={`${data.averageTemperatureC.toFixed(1)}°C`} note="Across four tiers" />
        <MetricCard label="Avg. humidity" value={`${data.averageHumidityRh}%`} note="Within demo range" accent="blue" />
        <MetricCard label="Feed remaining" value={`${data.feedKg} kg`} note="Refill approaching" accent="amber" />
        <MetricCard label="Water level" value={`${data.waterLevelPercent}%`} note="Tank estimate" accent="blue" />
        <MetricCard label="CO₂" value={`${data.co2Ppm} ppm`} note="Cage-level reading" />
        <MetricCard label="Gas index" value={String(data.gasIndex)} note="Not calibrated as NH₃" accent="amber" />
      </section>

      <section className="content-grid">
        <article className="panel chart-panel">
          <div className="panel__header">
            <div><p className="eyebrow">ENVIRONMENTAL TREND</p><h2>Today’s cage conditions</h2></div>
            <button className="secondary-button">Last 12 hours</button>
          </div>
          <TrendChart />
          <div className="legend">
            <span><i className="legend__temperature" />Temperature °C</span>
            <span><i className="legend__humidity" />Humidity %</span>
          </div>
        </article>

        <article className="panel alerts-panel">
          <div className="panel__header">
            <div><p className="eyebrow">ATTENTION NEEDED</p><h2>Active alerts</h2></div>
            <span className="alert-count">{data.alerts.length}</span>
          </div>
          <div className="alert-list">
            {data.alerts.map((alert) => (
              <div className={`alert alert--${alert.severity}`} key={alert.id}>
                <div className="alert__topline"><strong>{alert.title}</strong><time>{alert.time}</time></div>
                <p>{alert.detail}</p>
              </div>
            ))}
          </div>
          <button className="text-button" onClick={openAlerts}>Open alert centre →</button>
        </article>
      </section>

      <section className="tiers-section">
        <div className="section-heading">
          <div><p className="eyebrow">FOUR-TIER MONITORING</p><h2>Tier conditions</h2></div>
          <p>Demonstration thresholds pending poultry-specialist approval.</p>
        </div>
        <div className="tiers-grid">{data.tiers.map((tier) => <TierCard reading={tier} key={tier.tier} />)}</div>
      </section>
    </>
  );
}

function LivePage() {
  return (
    <section className="page-stack">
      <div className="notice"><span className="pulse" /><strong>Receiving demonstration data</strong><span>Updated {data.lastUpdated}</span></div>
      <div className="tiers-grid">{data.tiers.map((tier) => <TierCard reading={tier} key={tier.tier} />)}</div>
      <div className="page-grid page-grid--three">
        <article className="panel"><p className="eyebrow">AIR QUALITY</p><h2>{data.co2Ppm} ppm CO₂</h2><p className="muted">Gas index: {data.gasIndex}. NH₃ calibration pending.</p><div className="meter"><span style={{ width: "46%" }} /></div></article>
        <article className="panel"><p className="eyebrow">RESOURCES</p><h2>{data.feedKg} kg feed</h2><p className="muted">{data.waterLevelPercent}% water remaining</p><div className="meter meter--blue"><span style={{ width: `${data.waterLevelPercent}%` }} /></div></article>
        <article className="panel"><p className="eyebrow">ACTUATORS</p><div className="status-list"><span>Ventilation <b className="pill">Standby</b></span><span>Lighting <b className="pill pill--on">On</b></span><span>Water valve <b className="pill">Closed</b></span></div></article>
      </div>
      <article className="panel"><div className="panel__header"><div><p className="eyebrow">LIVE TREND</p><h2>Environmental readings</h2></div><span className="tag">Mock stream</span></div><TrendChart /></article>
    </section>
  );
}

function AnalyticsPage() {
  return (
    <section className="page-stack">
      <div className="filter-bar"><button className="filter-button filter-button--active">24 hours</button><button className="filter-button">7 days</button><button className="filter-button">30 days</button><button className="secondary-button">Export CSV</button></div>
      <div className="page-grid page-grid--four">
        <MetricCard label="Temperature range" value="27.8–30.4°C" note="Today" />
        <MetricCard label="Average humidity" value="68.7%" note="Today" accent="blue" />
        <MetricCard label="Warning events" value="2" note="No critical events" accent="amber" />
        <MetricCard label="Data completeness" value="99.2%" note="Demonstration" />
      </div>
      <article className="panel"><p className="eyebrow">ENVIRONMENTAL HISTORY</p><h2>Temperature and humidity</h2><TrendChart /></article>
      <article className="panel">
        <p className="eyebrow">RESOURCE TREND</p><h2>Feed and water estimates</h2>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyPerformance}>
              <CartesianGrid stroke="#e6ebe7" vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="feed" fill="#16794b" radius={[5, 5, 0, 0]} />
              <Bar dataKey="water" fill="#3b82b5" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}

function AlertsPage() {
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  return (
    <section className="page-stack">
      <div className="summary-strip"><div><strong>{data.alerts.length}</strong><span>Open</span></div><div><strong>{acknowledged.length}</strong><span>Acknowledged</span></div><div><strong>0</strong><span>Critical</span></div></div>
      <article className="panel">
        <div className="panel__header"><div><p className="eyebrow">CURRENT EVENTS</p><h2>Alerts requiring attention</h2></div><button className="secondary-button">Alert settings</button></div>
        <div className="alert-table">
          {data.alerts.map((alert) => {
            const isAcknowledged = acknowledged.includes(alert.id);
            return (
              <div className="alert-row" key={alert.id}>
                <span className={`severity-dot severity-dot--${alert.severity}`} />
                <div><strong>{alert.title}</strong><p>{alert.detail}</p><small>{alert.id} · {alert.time}</small></div>
                <button className="primary-button" disabled={isAcknowledged} onClick={() => setAcknowledged((items) => [...items, alert.id])}>{isAcknowledged ? "Acknowledged" : "Acknowledge"}</button>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}

function BatchesPage() {
  return (
    <section className="page-stack">
      <div className="panel batch-hero">
        <div><p className="eyebrow">ACTIVE BATCH</p><h2>{data.batchId}</h2><p className="muted">{data.birdCount} broilers · Started 28 August 2026</p></div>
        <div className="batch-progress"><div><span>Cycle progress</span><strong>43%</strong></div><div className="meter"><span style={{ width: "43%" }} /></div><small>18 of approximately 42 days</small></div>
      </div>
      <div className="page-grid page-grid--four">
        <MetricCard label="Current population" value={String(data.birdCount)} note="Initial: 200 birds" />
        <MetricCard label="Mortality" value="0.0%" note="No event recorded" />
        <MetricCard label="Bird age" value={`Day ${data.birdAgeDays}`} note="Grow-out stage" accent="blue" />
        <MetricCard label="Target market date" value="9 Oct" note="Estimate" accent="amber" />
      </div>
      <article className="panel">
        <div className="panel__header"><div><p className="eyebrow">BATCH LOG</p><h2>Recent production events</h2></div><button className="primary-button">Add record</button></div>
        <div className="simple-table">
          <div className="simple-table__head"><span>Date</span><span>Event</span><span>Details</span><span>Recorded by</span></div>
          <div><span>14 Sep</span><span>Environment check</span><span>Conditions within demonstration range</span><span>System</span></div>
          <div><span>13 Sep</span><span>Feed refill</span><span>35 kg added</span><span>Farm operator</span></div>
          <div><span>12 Sep</span><span>Weight sample</span><span>Growth record captured</span><span>Technician</span></div>
        </div>
      </article>
    </section>
  );
}

function MaintenancePage() {
  const items = [
    ["ESP32 controller", "Online", "Firmware simulator-0.1"],
    ["SHT31 · Tier 1", "Healthy", "Calibration due in 28 days"],
    ["SHT31 · Tier 2", "Healthy", "Calibration due in 28 days"],
    ["SHT31 · Tier 3", "Healthy", "Reading slightly elevated"],
    ["SHT31 · Tier 4", "Healthy", "Calibration due in 28 days"],
    ["Feed load cell", "Check soon", "Zero verification due"],
    ["Water sensor", "Healthy", "72% estimated level"]
  ];
  return (
    <section className="page-stack">
      <div className="page-grid page-grid--three">
        <MetricCard label="Device uptime" value="1h 00m" note="Mock session" />
        <MetricCard label="Wi-Fi signal" value="-58 dBm" note="Good connection" accent="blue" />
        <MetricCard label="Sensors healthy" value="6 of 7" note="One check due" accent="amber" />
      </div>
      <article className="panel">
        <div className="panel__header"><div><p className="eyebrow">SYSTEM HEALTH</p><h2>Devices and sensors</h2></div><button className="secondary-button">Download log</button></div>
        <div className="maintenance-list">
          {items.map(([name, state, note]) => <div key={name}><span className="connection-dot" /><div><strong>{name}</strong><small>{note}</small></div><b>{state}</b></div>)}
        </div>
      </article>
      <div className="notice notice--warning"><strong>Calibration reminder</strong><span>Values shown are demonstration data and are not approved poultry safety thresholds.</span></div>
    </section>
  );
}

function App() {
  const [page, setPage] = useState<PageId>("overview");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand__mark">IW</span><div><strong>InsightWorks</strong><small>Smart Poultry</small></div></div>
        <nav aria-label="Dashboard navigation">
          {navigation.map((item, index) => (
            <button className={page === item.id ? "nav-item nav-item--active" : "nav-item"} key={item.id} onClick={() => setPage(item.id)}>
              <span>{String(index + 1).padStart(2, "0")}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar__footer"><span className="connection-dot" /><div><strong>System connected</strong><small>Demonstration mode</small></div></div>
      </aside>

      <main>
        <header className="topbar">
          <div><p className="eyebrow">AUTOMATED BROILER CAGE</p><h1>{pageTitles[page]}</h1></div>
          <div className="topbar__actions"><div className="live-status"><span className="pulse" />Live · {data.lastUpdated}</div><button className="profile" aria-label="Open user profile">AT</button></div>
        </header>
        <div className="page-content">
          {page === "overview" && <OverviewPage openAlerts={() => setPage("alerts")} />}
          {page === "live" && <LivePage />}
          {page === "analytics" && <AnalyticsPage />}
          {page === "alerts" && <AlertsPage />}
          {page === "batches" && <BatchesPage />}
          {page === "maintenance" && <MaintenancePage />}
        </div>
      </main>
    </div>
  );
}

export default App;
