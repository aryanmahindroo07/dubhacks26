import {useState} from 'react';
import {compareTrials} from './comparison.mjs';
import styles from './AIWorkspace.module.css';
import {backgroundFailure} from './prefetchState.mjs';
const names={READ_TEXT:'Read text',EXTRACT_FIELDS:'Extract fields',SUMMARIZE:'Summarize',MAKE_TASKS:'Turn into tasks'};
const seconds=ms=>ms===null?'—':Math.abs(ms)<10?`${ms.toFixed(1)} ms`:`${(ms/1000).toFixed(2)} s`;

export function PrefireStatus({session,current,result}){
  if(!current)return null;
  const states=Object.entries(current.actionStates||{});
  const ready=states.find(([,state])=>state?.prefetched&&state.status==='ready');
  const pending=states.find(([,state])=>state?.prefetched&&state.status==='pending');
  const failed=backgroundFailure(session,current);
  const prediction=current.predictions?.find(p=>p.shouldPrefetch&&p.eligible);
  let title='Choose Read text to begin',detail='Watch the next action change from Preparing to Ready.';
  if(ready){title=`${names[ready[0]]} is ready before your click.`;detail='Prepared in the background. Choose the Ready button to use it.';}
  else if(pending){title=`Preparing ${names[pending[0]]}…`;detail='You can click now to join the running request, or keep reviewing.';}
  else if(failed){title=`${names[failed.action]} wasn’t prepared`;detail='Background call failed. Choose this action to retry.';}
  else if(result?.usedPrefetch){title=`${names[result.action]} · ${seconds(result.waitMs)} wait`;detail=`Provider call: ${seconds(result.providerMs)} · Your wait: ${seconds(result.waitMs)}. ${result.source==='in-flight'?'Joined while still running.':'Reused the prepared result.'}`;}
  else if(prediction){title=`Next likely: ${names[prediction.action]} · ${(prediction.probability*100).toFixed(0)}%`;detail=session.enabled?'See the decisions below for what runs early.':'Enable prefetch to prepare likely actions in the background.';}
  else if(result||current.read){title='Choose your next action';detail='Your choices teach RequestFlow what to prepare next time.';}
  return <div className={`${styles.prefireStatus} ${failed&&!ready&&!pending?styles.prefireFailed:''}`} role="status"><span className={styles.eyebrow}>Behind the next click</span><strong>{title}</strong><p>{detail}</p></div>;
}

export function DemoGuide(){
  return <details className={`${styles.panel} ${styles.demoGuide}`}><summary>Try the demo · watch it prepare, then learn</summary>
    <ol><li><strong>Prepare:</strong> enable prefetch, add a receipt, then Read text. Watch the predicted button change from Preparing → Ready before you click.</li>
    <li><strong>Learn:</strong> start fresh with prefetch ON and read-ahead OFF. Add four demo whiteboards. On the first three choose Read text → Summarize, then open the next. Watch “Prefetch changed: Turn into tasks → Summarize”; try the fourth.</li>
    <li><strong>Compare:</strong> load matched results below. Use fresh sessions and equal review time in both modes; waiting for Ready only in ON biases the comparison. See <code>docs/demo-evidence.md</code>.</li></ol>
    <p className={styles.small}>These scripted workflows demonstrate latency and adaptation, not real-user accuracy. Verify AI output against each image.</p>
  </details>;
}

export function ComparisonPanel(){
  const [report,setReport]=useState(null),[error,setError]=useState('');
  async function load(file){if(!file)return;setError('');setReport(null);try{if(file.size>10*1024*1024)throw Error('Choose a results file smaller than 10 MB.');setReport(compareTrials(JSON.parse(await file.text())));}catch(e){setError(e.message);}}
  async function recorded(){setError('');setReport(null);try{const response=await fetch('/demo-evidence/results.json');if(!response.ok)throw Error('Recorded benchmark is not available yet. Load your own results.json instead.');setReport(compareTrials(await response.json()));}catch(e){setError(e.message);}}
  return <section className={`${styles.panel} ${styles.comparison}`} aria-labelledby="comparison-heading"><h2 id="comparison-heading">OFF / ON · measured waiting</h2>
    <p>Load a matched benchmark results.json. Fresh sessions, identical images and action sequences, matched review time, read-ahead OFF in both modes.</p>
    <button onClick={recorded}>Load recorded CORD benchmark (Indonesia)</button>
    <label className={styles.label}>Benchmark measurements<input type="file" accept=".json,application/json" onChange={e=>load(e.target.files[0])}/></label>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {!report&&<p className={styles.small}>No measurements loaded. No sample savings are shown.</p>}
    {report&&<><p>{report.pairs} valid pairs · {report.excludedGroups} excluded or incomplete pairs · {report.allTrials} total trials · {report.failures} provider failures · {report.failedActions} failed actions</p>
      {report.stopReason&&<p role="status">{report.stopReason}</p>}
      {report.pairs?<><div className={styles.waitBars} aria-label="Median total action wait comparison">{[['OFF',report.off.wait],['ON',report.on.wait]].map(([label,wait])=><div key={label}><span>{label} · {seconds(wait)}</span><div className={styles.waitTrack}><div className={label==='ON'?styles.onBar:styles.offBar} style={{width:`${Math.max(1,100*wait/Math.max(report.off.wait,report.on.wait,1))}%`}}/></div></div>)}</div><div className={styles.metrics}><div><strong>{seconds(report.off.wait)}</strong><span>OFF median total action wait</span></div><div><strong>{seconds(report.on.wait)}</strong><span>ON median total action wait</span></div><div><strong>{seconds(report.savedMs)}</strong><span>Median paired waiting reduction (negative = slower)</span></div><div><strong>{report.off.totalCalls} → {report.on.totalCalls}</strong><span>Total provider calls across matched trials</span></div></div><p>ON prefires: {report.on.used} consumed / {report.on.unused} unused across valid pairs.</p><div className={styles.tableWrap}><table><caption>Each workflow, including the unexpected action</caption><thead><tr><th>Workflow / pairs</th><th>OFF median wait</th><th>ON median wait</th><th>Paired reduction</th><th>Net extra calls</th><th>Unused prefires</th></tr></thead><tbody>{report.scenarios.map(s=><tr key={s.name}><td>{s.name} / {s.pairs}</td><td>{seconds(s.offMs)}</td><td>{seconds(s.onMs)}</td><td>{seconds(s.savedMs)}</td><td>{s.extraCalls}</td><td>{s.unused}</td></tr>)}</tbody></table></div></>:<p>No valid matched pairs. Inspect failures or complete both modes before claiming savings.</p>}
      <p className={styles.small}>{report.description} Recorded {report.createdAt||'without date'}. Failure counts include all trials; latency comparison includes only complete, failure-free pairs with matching provider settings. Scripted workflows measure latency tradeoffs, not real-user prediction accuracy. These are server action waits, excluding browser rendering.</p></>}
  </section>;
}
