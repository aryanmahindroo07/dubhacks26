import { useState } from "react";
import Icon from "./OverviewIcon.jsx";
import {
  chartValues,
  createDemoRequests,
  filterRequests,
  sampleMetrics,
  sampleRequests,
  timeRanges,
} from "./overviewData.js";
import styles from "./Overview.module.css";

function Sidebar() {
  return (
    <aside className={styles.sidebar} aria-label="Main navigation">
      <a className={styles.brand} href="#overview">
        <span className={styles.brandMark}>
          <Icon name="workflow" size={23} />
        </span>
        <span>requestflow</span>
      </a>
      <p className={styles.navLabel}>Workspace</p>
      <nav className={styles.navigation}>
        <button type="button" className={styles.navItem} disabled>
          <Icon name="home" />
          Home
        </button>
        <a
          className={`${styles.navItem} ${styles.navActive}`}
          href="#overview"
          aria-current="page"
        >
          <Icon name="chart" />
          Overview
        </a>
        <button type="button" className={styles.navItem} disabled>
          <Icon name="sequence" />
          Sequences
        </button>
        <button type="button" className={styles.navItem} disabled>
          <Icon name="plug" />
          Apps &amp; setup
        </button>
      </nav>
      <div className={styles.sidebarBottom}>
        <div className={styles.workspaceNote}>
          <strong>Sample workspace</strong>
          <p>
            Illustrative telemetry only. No browser traffic is being
            intercepted.
          </p>
        </div>
        <div className={styles.profile}>
          <span className={styles.avatar}>RF</span>
          <div>
            <strong>Requestflow demo</strong>
            <span>Frontend team</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MetricCard({ metric, extraCalls }) {
  const value =
    metric.id === "calls"
      ? (12486 + extraCalls).toLocaleString("en-US")
      : metric.value;
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricTop}>
        <h2>{metric.label}</h2>
        <span className={styles.metricIcon}>
          <Icon name={metric.icon} />
        </span>
      </div>
      <p className={styles.metricValue}>
        {value}
        {metric.unit && <span>{metric.unit}</span>}
      </p>
      <p className={styles.metricNote}>{metric.note}</p>
    </article>
  );
}

function chartPath(values) {
  const points = values.map((value, index) => ({
    x: (index * 720) / (values.length - 1),
    y: 186 - value * 1.55,
  }));
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const before = points[Math.max(0, index - 2)];
    const after = points[Math.min(points.length - 1, index + 1)];
    return `${path} C ${previous.x + (point.x - before.x) / 6} ${previous.y + (point.y - before.y) / 6}, ${point.x - (after.x - previous.x) / 6} ${point.y - (after.y - previous.y) / 6}, ${point.x} ${point.y}`;
  }, "");
}

function ActivityChart({ range }) {
  const received = chartPath(chartValues[range]);
  const predicted = chartPath(
    chartValues[range].map((value, index) => value - 10 - (index % 3) * 2),
  );
  return (
    <section
      className={`${styles.panel} ${styles.chartPanel}`}
      aria-labelledby="activity-heading"
    >
      <div className={styles.chartHeader}>
        <div>
          <h2 id="activity-heading">API calls over time</h2>
          <p>Solid line: calls received · dotted line: calls predicted</p>
        </div>
        <div className={styles.legend}>
          <span>
            <i />
            Received
          </span>
          <span>
            <i />
            Predicted
          </span>
        </div>
      </div>
      <svg
        className={styles.chart}
        viewBox="0 0 720 200"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Illustrative received and predicted request activity over ${timeRanges[range].label}`}
      >
        <defs>
          <linearGradient id="overview-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3c806d" stopOpacity="0.17" />
            <stop offset="100%" stopColor="#3c806d" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[18, 62, 106, 150, 194].map((y) => (
          <line
            key={y}
            x1="0"
            x2="720"
            y1={y}
            y2={y}
            className={styles.chartGridLine}
          />
        ))}
        <path
          d={`${received} L 720 194 L 0 194 Z`}
          fill="url(#overview-chart-fill)"
        />
        <path d={predicted} className={styles.predictedLine} />
        <path d={received} className={styles.receivedLine} />
      </svg>
      <div className={styles.chartLabels}>
        {timeRanges[range].labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </section>
  );
}

function PredictionExample() {
  return (
    <section
      className={styles.predictionExample}
      aria-labelledby="example-heading"
    >
      <div className={styles.exampleTop}>
        <span>
          <Icon name="sparkles" size={18} />
          Example prediction
        </span>
        <span>94% likely</span>
      </div>
      <h2 id="example-heading">
        After a search, product results
        <br className={styles.wideBreak} /> are often needed next.
      </h2>
      <p>Based on 1,832 similar searches in the sample data.</p>
      <div className={styles.exampleSteps}>
        <span>Search</span>
        <Icon name="arrow" size={19} />
        <span>Show matching products</span>
      </div>
    </section>
  );
}

function RequestTable({ requests, query, setQuery, app, setApp }) {
  const filteredRequests = filterRequests(requests, query, app);
  return (
    <section
      className={`${styles.panel} ${styles.requestsPanel}`}
      aria-labelledby="requests-heading"
    >
      <div className={styles.requestHeader}>
        <div>
          <h2 id="requests-heading">Recent data requests</h2>
          <p>Examples of data the app requested or may request next</p>
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
          <label className={styles.selectField}>
            <select
              aria-label="Filter by app"
              value={app}
              onChange={(event) => setApp(event.target.value)}
            >
              <option value="all">All apps</option>
              <option>Northstar Storefront</option>
              <option>Atlas Projects</option>
            </select>
            <Icon name="chevron" size={16} />
          </label>
        </div>
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.requestTable}>
          <caption className={styles.srOnly}>
            Sample API requests, response times, and prediction results
          </caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Type</th>
              <th scope="col">Data requested</th>
              <th scope="col">Response</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((request) => (
              <tr key={request.id}>
                <td>
                  <time>{request.time}</time>
                </td>
                <td>
                  <span className={styles.method}>{request.method}</span>
                </td>
                <td>
                  <span className={styles.requestTitle}>{request.title}</span>
                  <span className={styles.requestPath}>{request.path}</span>
                </td>
                <td className={styles.response}>{request.response} ms</td>
                <td>
                  <span
                    className={`${styles.result} ${request.result === "Not predicted" ? styles.notPredicted : ""}`}
                  >
                    {request.result}
                  </span>
                </td>
              </tr>
            ))}
            {filteredRequests.length === 0 && (
              <tr>
                <td colSpan="5" className={styles.emptyState}>
                  No requests match your filters.
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setApp("all");
                    }}
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NextRequest() {
  return (
    <section
      className={`${styles.panel} ${styles.nextPanel}`}
      aria-labelledby="next-heading"
    >
      <div className={styles.nextHeader}>
        <div>
          <h2 id="next-heading">What may be needed next</h2>
          <p>A common pattern after a product search</p>
        </div>
        <Icon name="branch" size={22} />
      </div>
      <div className={styles.nextRequest}>
        <div>
          <p className={styles.journeyTitle}>Someone searches for a product</p>
          <p className={styles.journeyNote}>
            Northstar Storefront · seen 1,832 times in the sample
          </p>
          <div className={styles.nextTags}>
            <span>Show matching products</span>
            <span>Update filters</span>
          </div>
        </div>
        <div className={styles.likelihood}>
          <strong>94%</strong>
          <span>likelihood</span>
        </div>
      </div>
      <div className={styles.timeEstimate}>
        <Icon name="bolt" size={20} />
        <p>
          <strong>Could be ready about 0.2 seconds sooner</strong>
          <span>
            Illustrative estimate from sample timings; not measured in a live
            app.
          </span>
        </p>
      </div>
    </section>
  );
}

export default function Overview() {
  const [range, setRange] = useState("24h");
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");
  const [app, setApp] = useState("all");
  const [requests, setRequests] = useState(sampleRequests);
  const [demoRuns, setDemoRuns] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  function runDemo() {
    const run = demoRuns + 1;
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setRequests((current) =>
      [...createDemoRequests(run, paused, time), ...current].slice(0, 25),
    );
    setDemoRuns(run);
    setQuery("");
    setApp("all");
    setAnnouncement(
      paused
        ? "Sample request received. Prefetch is paused, so no prediction was added."
        : "Sample journey complete. A search was received and matching products were predicted next.",
    );
  }

  function togglePrefetch() {
    setPaused((current) => !current);
    setAnnouncement(
      paused
        ? "Prefetch resumed for the local demo."
        : "Prefetch paused for the local demo.",
    );
  }

  return (
    <div className={styles.overview}>
      <a className={styles.skipLink} href="#overview">
        Skip to overview
      </a>
      <Sidebar />
      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}>
            Workspace<span>/</span>
            <strong>metrics</strong>
          </div>
          <div className={styles.workspaceStatus}>
            <span className={styles.sampleDate}>Tuesday, 14 May</span>
            <span className={styles.sampleBadge}>Sample telemetry</span>
          </div>
        </header>
        <main className={styles.content} id="overview" tabIndex="-1">
          <div className={styles.pageHeader}>
            <div>
              <p className={styles.eyebrow}>Requestflow · sample dashboard</p>
              <h1>Search activity, made simple.</h1>
              <p className={styles.subtitle}>
                See what data apps requested, what they may need next, and where
                preloading could reduce waiting.
              </p>
            </div>
            <div className={styles.pageActions}>
              <label className={styles.selectField}>
                <select
                  aria-label="Date range"
                  value={range}
                  onChange={(event) => setRange(event.target.value)}
                >
                  {Object.entries(timeRanges).map(([value, item]) => (
                    <option key={value} value={value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <Icon name="chevron" size={16} />
              </label>
              <button
                className={styles.prefetchButton}
                type="button"
                onClick={togglePrefetch}
                aria-pressed={paused}
              >
                <Icon name={paused ? "play" : "pause"} size={17} />
                {paused ? "Resume prefetch" : "Pause prefetch"}
              </button>
            </div>
          </div>
          <section
            className={styles.metricGrid}
            aria-label="Sample telemetry summary"
          >
            {sampleMetrics.map((metric) => (
              <MetricCard
                key={metric.id}
                metric={metric}
                extraCalls={demoRuns * 2}
              />
            ))}
          </section>
          <p className={styles.explainer}>
            <strong>How to read this:</strong> An API call asks an app for data.
            A prediction is a guess about what it may need next. Time saved is
            an estimate.
          </p>
          <div className={styles.activityGrid}>
            <ActivityChart range={range} />
            <PredictionExample />
          </div>
          <div className={styles.detailsGrid}>
            <RequestTable
              requests={requests}
              query={query}
              setQuery={setQuery}
              app={app}
              setApp={setApp}
            />
            <NextRequest />
          </div>
          <section className={styles.demoPanel} aria-labelledby="demo-heading">
            <div>
              <h2 id="demo-heading">Try a sample request journey</h2>
              <p>
                Simulate a storefront search locally to see how a prediction
                appears. This does not send a network request or intercept
                browser traffic.
              </p>
            </div>
            <button
              type="button"
              className={styles.demoButton}
              onClick={runDemo}
            >
              <Icon name="play" size={19} />
              Run demo request
            </button>
          </section>
          <p className={styles.announcement} role="status" aria-live="polite">
            {announcement && (
              <>
                <Icon name="check" size={17} />
                {announcement}
              </>
            )}
          </p>
          <p className={styles.disclaimer}>
            All values on this page are sample telemetry for interface
            demonstration. Predictions and time saved are illustrative
            estimates.
          </p>
        </main>
      </div>
    </div>
  );
}
