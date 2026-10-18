import {useEffect, useState} from 'react';
import {comparePolicies} from './policies.mjs';
import styles from './BenchmarkHighlight.module.css';

const ARTIFACT = '/demo-evidence/us-policy-results.json';
const seconds = value => `${(value / 1000).toFixed(2)} s`;

export default function BenchmarkHighlight() {
  const [report, setReport] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(ARTIFACT, {signal: controller.signal});
        if (!response.ok) throw new Error('Recorded comparison unavailable.');
        const result = comparePolicies(await response.json());
        if (!result.triples || result.rows.some(row => !Number.isFinite(row.medianWaitMs))) {
          throw new Error('No complete matched trials.');
        }
        if (!controller.signal.aborted) setReport(result);
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  if (!report) {
    return <section className={styles.highlight} aria-label="Recorded benchmark" aria-busy={!unavailable}>
      <div>
        <p className={styles.eyebrow}>Recorded benchmark</p>
        <p className={styles.placeholder} role="status">
          {unavailable ? 'Recorded comparison unavailable. Live session metrics are shown below.' : 'Loading the recorded waiting comparison…'}
        </p>
      </div>
    </section>;
  }

  const off = report.rows.find(row => row.mode === 'OFF');
  const on = report.rows.find(row => row.mode === 'MARKOV');
  const fixed = report.rows.find(row => row.mode === 'FIXED');
  const maximum = Math.max(off.medianWaitMs, on.medianWaitMs, 1);
  const recordedDate = new Date(report.createdAt);
  const date = Number.isNaN(recordedDate.getTime()) ? '' : new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(recordedDate);

  return <section className={styles.highlight} aria-labelledby="benchmark-highlight-heading">
    <div className={styles.summary}>
      <h2 className={styles.eyebrow} id="benchmark-highlight-heading">Recorded benchmark</h2>
      <div className={styles.comparison}>
        <div><span className={styles.label}>Prefetch OFF</span><strong>{seconds(off.medianWaitMs)}</strong></div>
        <span className={styles.arrow} aria-hidden="true">→</span>
        <div><span className={styles.label}>Mise ON</span><strong className={styles.onValue}>{seconds(on.medianWaitMs)}</strong></div>
      </div>
      <p className={styles.caption}>Median total waiting per workflow · {report.triples} matched OFF/fixed/Markov trial groups · US receipts</p>
    </div>
    <div className={styles.evidence}>
      <div className={styles.bars} aria-label="Median total waiting comparison">
        {[{name: 'Prefetch OFF', value: off.medianWaitMs, className: styles.offBar}, {name: 'Markov prefetch', value: on.medianWaitMs, className: styles.onBar}].map(bar => <div className={styles.barRow} key={bar.name}>
          <span>{bar.name}</span>
          <div className={styles.track} aria-hidden="true"><div className={bar.className} style={{width: `${Math.max(0, bar.value / maximum * 100)}%`}} /></div>
          <strong>{seconds(bar.value)}</strong>
        </div>)}
      </div>
      <p className={styles.provenance}>Scripted tests{date ? ` · ${date}` : ''} · not this live session. <a href={ARTIFACT}>Source data</a></p>
      <details className={styles.method}><summary>Method & fixed-rule baseline</summary><p className={styles.note}>Fixed rule: {seconds(fixed.medianWaitMs)}. Fixed and Markov made the same prefetch choices in {report.identicalPolicyChoices}/{report.triples} groups; this does not establish a prediction advantage.</p></details>
    </div>
  </section>;
}
