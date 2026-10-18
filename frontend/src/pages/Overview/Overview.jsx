import { useEffect, useState } from "react";
import Icon from "./OverviewIcon.jsx";
import CustomerWorkspace from "../../components/CustomerWorkspace/CustomerWorkspace.jsx";
import {
  getPrefetchMetrics,
  isPrefetchEnabled,
  setPrefetchEnabled,
} from "../../services/prefetch.js";
import styles from "./Overview.module.css";

const DELAY_MS = 1200;
const LABELS = {
  CUSTOMERS: "Customer list",
  CUSTOMER: "Customer profile",
  ORDERS: "Orders",
  SUPPORT: "Support tickets",
  ANALYTICS: "Analytics",
};

const percent = (part, whole) =>
  whole === 0 ? "0%" : `${((part / whole) * 100).toFixed(0)}%`;

function Sidebar({ enabled }) {
  return (
    <aside className={styles.sidebar} aria-label="Main navigation">
      <a className={styles.brand} href="/">
        <span className={styles.brandMark}>
          <Icon name="workflow" size={23} />
        </span>
        <span>requestflow</span>
      </a>
      <p className={styles.navLabel}>Workspace</p>
      <nav className={styles.navigation}>
        <a className={styles.navItem} href="/">
          <Icon name="home" />
          Home
        </a>
        <a
          className={`${styles.navItem} ${styles.navActive}`}
          href="#overview"
          aria-current="page"
        >
          <Icon name="chart" />
          Live overview
        </a>
      </nav>
      <div className={styles.sidebarBottom}>
        <div className={styles.workspaceNote}>
          <strong>This page session</strong>
          <p>
            Measured in this browser from the customer workspace below.
            Reloading resets these counters; the backend model keeps learning.
            Prefetch is {enabled ? "on" : "paused"}.
          </p>
        </div>
      </div>
    </aside>
  );
}

function MetricCard({ label, icon, value, unit, note }) {
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricTop}>
        <h2>{label}</h2>
        <span className={styles.metricIcon}>
          <Icon name={icon} />
        </span>
      </div>
      <p className={styles.metricValue}>
        {value}
        {unit && <span>{unit}</span>}
      </p>
      <p className={styles.metricNote}>{note}</p>
    </article>
  );
}

function resultClass(result) {
  if (result === "cache hit") return styles.barHit;
  if (result === "reused running request") return styles.barReused;
  return styles.barNetwork;
}

function WaitChart({ log }) {
  const navigations = log
    .filter((entry) => entry.kind === "navigation")
    .slice(0, 24)
    .reverse();
  const scale = DELAY_MS * 1.2;
  const fast = navigations.filter((n) => n.result !== "network").length;
  return (
    <section
      className={`${styles.panel} ${styles.chartPanel}`}
      aria-labelledby="wait-heading"
    >
      <div className={styles.chartHeader}>
        <div>
          <h2 id="wait-heading">How long each page waited for data</h2>
          <p>Latest {navigations.length} navigations, oldest on the left</p>
        </div>
        <div className={styles.waitLegend}>
          <span><i className={styles.barNetwork} />Network</span>
          <span><i className={styles.barReused} />Joined prefetch</span>
          <span><i className={styles.barHit} />Cache hit</span>
        </div>
      </div>
      {navigations.length === 0 ? (
        <p className={styles.emptyChart}>
          No navigations yet. Open a customer in the workspace below.
        </p>
      ) : (
        <div
          className={styles.waitChart}
          role="img"
          aria-label={`${navigations.length} navigations: ${fast} served by cache or a running prefetch, ${navigations.length - fast} waited on the network.`}
        >
          <span
            className={styles.delayLine}
            style={{ bottom: `${(DELAY_MS / scale) * 100}%` }}
          >
            1,200 ms artificial delay
          </span>
          {navigations.map((n) => (
            <span
              key={n.id}
              className={`${styles.waitBar} ${resultClass(n.result)}`}
              style={{ height: `${Math.max(2, (Math.min(n.waitMs, scale) / scale) * 100)}%` }}
              title={`${LABELS[n.stateId] ?? n.stateId}: ${Math.round(n.waitMs)} ms (${n.result})`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PrefetchOutcomes({ m }) {
  const extra = m.unusedPrefetches + m.failed;
  return (
    <section
      className={`${styles.panel} ${styles.outcomePanel}`}
      aria-labelledby="outcome-heading"
    >
      <h2 id="outcome-heading">Prefetch outcomes</h2>
      <p>Speculative requests and whether the user needed them</p>
      <dl className={styles.outcomeList}>
        <div><dt>Useful</dt><dd>{m.usefulPrefetches}</dd></div>
        <div><dt>Unused so far</dt><dd>{m.unusedPrefetches}</dd></div>
        <div><dt>Failed</dt><dd>{m.failed}</dd></div>
        <div><dt>Still loading</dt><dd>{m.inFlightRequests}</dd></div>
        <div><dt>Prediction calls</dt><dd>{m.predictionCalls}</dd></div>
      </dl>
      <p className={styles.outcomeNote}>
        Extra data GETs so far: <strong>{extra}</strong> of{" "}
        {m.speculativeRequests} prefetches. Prediction calls are small POSTs
        without the artificial delay.
      </p>
    </section>
  );
}

function RequestLog({ log }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rows = log.filter(
    (entry) =>
      !q ||
      entry.url.toLowerCase().includes(q) ||
      (LABELS[entry.stateId] ?? "").toLowerCase().includes(q),
  );
  return (
    <section
      className={`${styles.panel} ${styles.requestsPanel}`}
      aria-labelledby="requests-heading"
    >
      <div className={styles.requestHeader}>
        <div>
          <h2 id="requests-heading">Recent data requests</h2>
          <p>Every navigation and prefetch in this session, newest first</p>
        </div>
        <div className={styles.requestFilters}>
          <label className={styles.searchField}>
            <Icon name="search" size={18} />
            <input
              aria-label="Search request paths"
              placeholder="Find a path…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.requestTable}>
          <caption className={styles.srOnly}>
            Navigations and prefetches with wait times and outcomes
          </caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Type</th>
              <th scope="col">Data requested</th>
              <th scope="col">Wait</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <time>
                    {new Date(entry.at).toLocaleTimeString("en-GB", { hour12: false })}
                  </time>
                </td>
                <td>
                  <span className={styles.method}>
                    {entry.kind === "prefetch" ? "PREFETCH" : "OPEN"}
                  </span>
                </td>
                <td>
                  <span className={styles.requestTitle}>
                    {LABELS[entry.stateId] ?? entry.stateId}
                  </span>
                  <span className={styles.requestPath}>{entry.url}</span>
                </td>
                <td className={styles.response}>{Math.round(entry.waitMs)} ms</td>
                <td>
                  <span
                    className={`${styles.result} ${entry.result === "network" || entry.result === "prefetch failed" ? styles.notPredicted : ""}`}
                  >
                    {entry.servedByPrefetch ? `${entry.result} (prefetched)` : entry.result}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan="5" className={styles.emptyState}>
                  {log.length === 0
                    ? "No requests yet. Use the customer workspace below."
                    : "No requests match your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Overview() {
  const [m, setMetrics] = useState(getPrefetchMetrics);
  const [enabled, setEnabled] = useState(isPrefetchEnabled);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setMetrics(getPrefetchMetrics()), 250);
    return () => clearInterval(timer);
  }, []);

  function togglePrefetch() {
    const next = !enabled;
    setPrefetchEnabled(next);
    setEnabled(next);
    setMetrics(getPrefetchMetrics());
    setAnnouncement(
      next
        ? "Prefetch resumed. New navigations will request predictions and prefetch."
        : "Prefetch paused. New navigations send no prediction calls or prefetches.",
    );
  }

  const served = m.hits + m.reused;
  return (
    <div className={styles.overview}>
      <a className={styles.skipLink} href="#overview">
        Skip to overview
      </a>
      <Sidebar enabled={enabled} />
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            Workspace<span>/</span>
            <strong>live overview</strong>
          </div>
          <div className={styles.workspaceStatus}>
            <span className={styles.sampleBadge}>Mock records · live measurements</span>
          </div>
        </header>
        <main className={styles.content} id="overview" tabIndex="-1">
          <div className={styles.pageHeader}>
            <div>
              <p className={styles.eyebrow}>Customer API activity</p>
              <h1>Measure the waiting.</h1>
              <p className={styles.subtitle}>
                Use the workspace below to make real navigation, prediction and
                prefetch requests. Pause prefetch to compare.
              </p>
            </div>
            <div className={styles.pageActions}>
              <button
                className={styles.prefetchButton}
                type="button"
                onClick={togglePrefetch}
                aria-pressed={!enabled}
              >
                <Icon name={enabled ? "pause" : "play"} size={17} />
                {enabled ? "Pause prefetch" : "Resume prefetch"}
              </button>
            </div>
          </div>
          <section className={styles.metricGrid} aria-label="Live measurements">
            <MetricCard
              label="Data GETs sent"
              icon="activity"
              value={m.dataRequests}
              note={`${m.demandRequests} demanded · ${m.speculativeRequests} speculative`}
            />
            <MetricCard
              label="Cache hits"
              icon="sparkles"
              value={m.hits}
              note={`${percent(m.hits, m.navigations)} of ${m.navigations} navigations answered instantly`}
            />
            <MetricCard
              label="Joined a running prefetch"
              icon="timer"
              value={m.reused}
              note={`With cache hits, ${percent(served, m.navigations)} of navigations avoided a new request`}
            />
            <MetricCard
              label="Median wait"
              icon="gauge"
              value={m.navigations ? Math.round(m.medianWaitMs).toLocaleString("en-US") : "—"}
              unit={m.navigations ? "ms" : undefined}
              note={`Total ${(m.totalWaitMs / 1000).toFixed(1)} s across ${m.navigations} navigations`}
            />
          </section>
          <p className={styles.explainer}>
            <strong>How to read this:</strong> customer records are generated
            mock data, and the backend adds an artificial {DELAY_MS.toLocaleString("en-US")} ms
            delay to every data request. Everything on this page is measured in
            this browser session; for an OFF/ON comparison, run{" "}
            <code>scripts/benchmark_prefetch.py</code>.
          </p>
          <div className={styles.activityGrid}>
            <WaitChart log={m.requestLog} />
            <PrefetchOutcomes m={m} />
          </div>
          <div className={styles.liveDetails}>
            <RequestLog log={m.requestLog} />
          </div>
          <p className={styles.announcement} role="status" aria-live="polite">
            {announcement && (
              <>
                <Icon name="check" size={17} />
                {announcement}
              </>
            )}
          </p>
          <CustomerWorkspace />
        </main>
      </div>
    </div>
  );
}
