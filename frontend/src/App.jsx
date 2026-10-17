import './App.css';

const metrics = [
  {
    label: "API calls seen",
    value: "12,486",
    note: "Data requests in this sample period",
  },
  {
    label: "Likely next calls",
    value: "48",
    note: "87.2% average confidence in the sample",
  },
  {
    label: "Potential waiting reduced",
    value: "18.6 min",
    note: "Estimated from sample data, not measured live",
  },
  {
    label: "Typical response time",
    value: "184 ms",
    note: "Middle response time in the sample",
  },
];

function App() {
  return (
    <main className="app">
      <header className="topbar">
        <a className="brand" href="#metrics">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>RequestFlow</span>
        </a>

        <nav className="topbar-nav">
          <a className="active" href="#metrics" aria-current="page">Metrics</a>
          <a href="#requests">Requests</a>
          <a href="#predictions">Predictions</a>
        </nav>

      </header>

      <section className="page-heading" id="metrics">
        <div>
          <p className="eyebrow">Workspace / Metrics</p>
          <h1>API Metrics</h1>
          <p className="subtitle">
            See request activity and which calls RequestFlow predicts next.
          </p>
        </div>
        <label className="range-select">
          <span className="sr-only">Time range</span>
          <select defaultValue="Last 24 hours">
            <option>Last 24 hours</option>
            <option>Last 7 days</option>
            <option>Last 30 days</option>
          </select>
        </label>
      </section>

      <section className="metric-grid">
        {metrics.map(({ label, value, note }) => (
          <article className="metric-card" key={label}>
            <h3 className="metric-label">{label}</h3>
            <p className="metric-value">{value}</p>
            <p className="metric-note">{note}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

export default App;