import { useEffect, useState } from 'react';
import { requestEndpoint, getPrefetchMetrics } from '../../services/prefetch.js';
import './CustomerWorkspace.css';

export default function CustomerWorkspace() {
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [view, setView] = useState('CUSTOMERS');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState(getPrefetchMetrics);

  useEffect(() => {
    const timer = setInterval(() => setMetrics(getPrefetchMetrics()), 250);
    return () => clearInterval(timer);
  }, []);

  async function open(stateId, id) {
    setBusy(true);
    setError('');
    setData(null);
    setView(stateId);
    if (stateId === 'CUSTOMERS') setCustomerId('');
    else setCustomerId(id);
    try {
      const result = await requestEndpoint(stateId, id);
      if (stateId === 'CUSTOMERS') setCustomers(result);
      setData(result);
    } catch (error) {
      setError(`Could not load data: ${error.message}. Check the backend connection.`);
    } finally {
      setBusy(false);
      setMetrics(getPrefetchMetrics());
    }
  }

  return (
    <section className="search-demo customer-workspace" id="customers" aria-labelledby="workspace-title">
      <h2 id="workspace-title">Customer workspace · live API demo</h2>
      <p>Generated customer records, synthetic training journeys, and simulated 1,200 ms API delays. Wait for a prefetch to complete before opening Orders.</p>
      <nav aria-label="Customer views" className="customer-actions">
        <button disabled={busy} onClick={() => open('CUSTOMERS')}>Load customers</button>
        {['CUSTOMER', 'ORDERS', 'SUPPORT', 'ANALYTICS'].map(state => (
          <button key={state} disabled={busy || !customerId} aria-pressed={view === state}
            onClick={() => open(state, customerId)}>{state === 'CUSTOMER' ? 'Profile' : state.charAt(0) + state.slice(1).toLowerCase()}</button>
        ))}
      </nav>
      <div aria-busy={busy}>
        {busy && <p role="status">Loading {view.toLowerCase()}…</p>}
        {error && <p role="alert">{error}</p>}
        {view === 'CUSTOMERS' && !busy && customers.length > 0 && (
          <ul className="search-results">{customers.map(customer => (
            <li key={customer.id}><button onClick={() => open('CUSTOMER', customer.id)}>{customer.name}</button><span>{customer.plan} · ${customer.mrr.toLocaleString()} monthly</span></li>
          ))}</ul>
        )}
        {data && view === 'CUSTOMER' && <p><strong>{data.name}</strong> · {data.email} · {data.plan} · ${data.mrr.toLocaleString()} monthly</p>}
        {data && view === 'ORDERS' && <ul>{data.orders.map(order => <li key={order.id}>{order.product} · ${order.amount.toLocaleString()} · {order.date}</li>)}</ul>}
        {data && view === 'SUPPORT' && <ul>{data.tickets.map(ticket => <li key={ticket.id}>{ticket.subject} · {ticket.status} · {ticket.priority} priority</li>)}</ul>}
        {data && view === 'ANALYTICS' && <><p>Health: {data.healthScore}/100 · Churn risk: {data.churnRisk}</p><ul>{data.monthlyUsage.map(month => <li key={month.month}>{month.month}: {month.activeUsers} active users · {month.apiCalls.toLocaleString()} API calls</li>)}</ul></>}
      </div>
      <h3>Live workspace metrics</h3>
      <p>Cache hits: {metrics.hits} · Reused running requests: {metrics.reused} · Misses: {metrics.misses} · Hit rate: {(metrics.hitRate * 100).toFixed(1)}% · Served without a new request: {(metrics.servedRate * 100).toFixed(1)}%</p>
      <p>Prefetch started: {metrics.started} · Completed: {metrics.completed} · Failed: {metrics.failed} · In flight: {metrics.inFlightRequests}</p>
      {metrics.lastRequest && <p>Latest: {metrics.lastRequest.stateId} · {metrics.lastRequest.cacheHit ? 'Cache hit' : metrics.lastRequest.inFlightReuse ? 'Reused running request' : 'Network request'} · Wait: {metrics.lastRequest.latencyMs.toFixed(1)} ms</p>}
      <p>Prefetch is {metrics.prefetchEnabled ? "on" : "paused"} · Useful prefetches: {metrics.usefulPrefetches} · Unused: {metrics.unusedPrefetches}</p>
      <p className="metric-note">Estimated waiting saved: {metrics.totalEstimatedSavedMs.toFixed(1)} ms against the fixed 1,200 ms baseline. For measured OFF/ON results, run scripts/benchmark_prefetch.py. The customer search above is separate from these metrics.</p>
    </section>
  );
}
