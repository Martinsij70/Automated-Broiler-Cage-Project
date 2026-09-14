import {
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

const navigation = ["Overview", "Live monitoring", "Analytics", "Alerts", "Batches", "Maintenance"];

function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark">IW</span>
          <div>
            <strong>InsightWorks</strong>
            <small>Smart Poultry</small>
          </div>
        </div>

        <nav aria-label="Dashboard navigation">
          {navigation.map((item, index) => (
            <button className={index === 0 ? "nav-item nav-item--active" : "nav-item"} key={item}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item}
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <span className="connection-dot" />
          <div>
            <strong>System connected</strong>
            <small>HiveMQ link healthy</small>
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div>
            <p className="eyebrow">AUTOMATED BROILER CAGE</p>
            <h1>Farm overview</h1>
          </div>
          <div className="topbar__actions">
            <div className="live-status">
              <span className="pulse" />
              Live · {data.lastUpdated}
            </div>
            <button className="profile" aria-label="Open user profile">AT</button>
          </div>
        </header>

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
              <div>
                <p className="eyebrow">ENVIRONMENTAL TREND</p>
                <h2>Today’s cage conditions</h2>
              </div>
              <button className="secondary-button">Last 12 hours</button>
            </div>
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
            <div className="legend">
              <span><i className="legend__temperature" />Temperature °C</span>
              <span><i className="legend__humidity" />Humidity %</span>
            </div>
          </article>

          <article className="panel alerts-panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">ATTENTION NEEDED</p>
                <h2>Active alerts</h2>
              </div>
              <span className="alert-count">{data.alerts.length}</span>
            </div>
            <div className="alert-list">
              {data.alerts.map((alert) => (
                <div className={`alert alert--${alert.severity}`} key={alert.id}>
                  <div className="alert__topline">
                    <strong>{alert.title}</strong>
                    <time>{alert.time}</time>
                  </div>
                  <p>{alert.detail}</p>
                  <button>Acknowledge</button>
                </div>
              ))}
            </div>
            <button className="text-button">View complete alert history →</button>
          </article>
        </section>

        <section className="tiers-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">FOUR-TIER MONITORING</p>
              <h2>Tier conditions</h2>
            </div>
            <p>Demonstration thresholds pending poultry-specialist approval.</p>
          </div>
          <div className="tiers-grid">
            {data.tiers.map((tier) => <TierCard reading={tier} key={tier.tier} />)}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
