import { useState } from 'react';
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  async function handleSearch(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSearched(false);
    setResults([]);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (!response.ok) throw new Error('Search failed. Please try again.');
      const data = await response.json();
      setResults(data.results);
      setSearched(true);
    } catch {
      setError('Could not search. Make sure the backend is running on port 4000, then try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
  }

  return (
    <>
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
    <main className="app">
      <header className="title">RequestFlow</header>
      <form className="search-bar" role="search" onSubmit={handleSubmit}>
        <input
          type="search"
          placeholder="Search..."
          aria-label="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      <section className="page-heading" id="metrics">
        <div>
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

      <section className="search-demo" aria-labelledby="search-heading">
        <h2 id="search-heading">Try a customer search</h2>
        <p>Search customers through the backend. Try “Acme” or leave the search empty to see everyone.</p>
        <form className="search-form" onSubmit={handleSearch}>
          <label className="sr-only" htmlFor="customer-search">Customer name</label>
          <input id="customer-search" type="search" value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customers…" disabled={loading} />
          <button type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
        </form>
        <div aria-live="polite" aria-busy={loading}>
          {loading && <p>Searching customers…</p>}
          {error && <p role="alert">{error}</p>}
          {searched && <p>{results.length} customer{results.length === 1 ? '' : 's'} found.</p>}
          {results.length > 0 && (
            <ul className="search-results">
              {results.map((customer) => (
                <li key={customer.id}>
                  <strong>{customer.name}</strong>
                  <span>{customer.plan} · ${customer.mrr.toLocaleString()} monthly revenue</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="metric-note">Search results come from the running backend. The metrics below are sample data; prediction and prefetching are not connected yet.</p>
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
    </>
  );
}

export default App;
