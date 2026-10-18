import {useState} from 'react';
import {compareTrials} from './comparison.mjs';
import styles from './AIWorkspace.module.css';
const names={READ_TEXT:'Read text',EXTRACT_FIELDS:'Extract fields',SUMMARIZE:'Summarize',MAKE_TASKS:'Turn into tasks'};
const seconds=ms=>ms===null?'—':Math.abs(ms)<10?`${ms.toFixed(1)} ms`:`${(ms/1000).toFixed(2)} s`;

export function PrefireStatus({session,current,result}){
  if(!current)return null;
  const events=(session?.requestLog||[]).filter(e=>e.itemId===current.id);
  const consumed=events.find(e=>e.kind==='navigation'&&e.usedPrefetch);
  const background=events.find(e=>e.kind==='prefetch'||e.kind==='read-ahead');
  // Predictions are session-wide; never label the previous image's as current.
  const latestNavigation=session?.requestLog?.find(e=>e.kind==='navigation');
  const prediction=latestNavigation?.itemId===current.id?session.predictions?.find(p=>p.shouldPrefetch&&p.eligible):null;
  let title='Choose Read text to begin',detail='Perceptron reads the image. Gemini transforms its text.';
  if(consumed&&(!background||events.indexOf(consumed)<events.indexOf(background))){title=`Used ${names[consumed.action]} · ${consumed.waitMs.toFixed(1)} ms wait`;detail=consumed.source==='in-flight'?'Joined a prefire still running. Only part of the wait was hidden.':'Reused a completed prefire. No second provider request for this action.';}
  else if(background){
    title=`${names[background.action]} · ${{started:'Preparing…',completed:'Ready',failed:'Failed'}[background.result]||background.result}`;
    detail=background.kind==='read-ahead'?'OCR read-ahead for this image. Accounted separately from next-action prediction.':prediction?`Model estimate: ${(prediction.probability*100).toFixed(0)}% for ${names[prediction.action]}. This is not measured prediction accuracy.`:'Background next-action prefire for this image.';
  }else if(prediction){title=`Predicting ${names[prediction.action]} · ${(prediction.probability*100).toFixed(0)}%`;detail=session.enabled?'Eligible prediction; scheduling depends on cache and request budget.':'Prefetch is OFF. This action will run when you request it.';}
  else if(result){title=`${names[result.action]} completed`;detail='No eligible prefire is currently shown for this image.';}
  return <div className={styles.prefireStatus} role="status"><span className={styles.eyebrow}>Behind the next click</span><strong>{title}</strong><p>{detail}</p></div>;
}

export function DemoGuide(){
  return <details className={`${styles.panel} ${styles.demoGuide}`}><summary>Run the demo · real inputs, visible predictions, measured tradeoffs</summary>
    <ol><li><strong>Real receipt:</strong> add the three public receipts. Read text, inspect the image and OCR, then Extract fields. Check evidence and unknown amounts.</li>
    <li><strong>Prediction:</strong> use a fresh run with prefetch ON and read-ahead OFF. After Read text, watch Preparing → Ready. Click the predicted action; the strip reports the actual wait. Choosing a different action demonstrates unused work.</li>
    <li><strong>Compare:</strong> run the matched benchmark described in <code>docs/demo-evidence.md</code>, then load its results below. Review time must match; waiting for Ready only in ON would bias the comparison.</li>
    <li><strong>Adaptation:</strong> in a fresh run, add four demo whiteboards. On each of the first three choose Read text → Summarize, then open the next. Inspect the learning panel; on the fourth, observe which action is prepared. This is a controlled demonstration using synthetic whiteboards, not an accuracy study.</li></ol>
    <p className={styles.small}>Do not infer OCR accuracy from latency, or real-user accuracy from these scripted choices. Savings accumulate across steps; they do not grow exponentially.</p>
  </details>;
}

export function ComparisonPanel(){
  const [report,setReport]=useState(null),[error,setError]=useState('');
  async function load(file){if(!file)return;setError('');setReport(null);try{if(file.size>10*1024*1024)throw Error('Choose a results file smaller than 10 MB.');setReport(compareTrials(JSON.parse(await file.text())));}catch(e){setError(e.message);}}
  async function recorded(){setError('');setReport(null);try{const response=await fetch('/demo-evidence/results.json');if(!response.ok)throw Error('Recorded benchmark is not available yet. Load your own results.json instead.');setReport(compareTrials(await response.json()));}catch(e){setError(e.message);}}
  return <section className={`${styles.panel} ${styles.comparison}`} aria-labelledby="comparison-heading"><h2 id="comparison-heading">OFF / ON · measured waiting</h2>
    <p>Load a matched benchmark results.json. Fresh sessions, identical images and action sequences, matched review time, read-ahead OFF in both modes.</p>
    <button onClick={recorded}>Load recorded real-receipt benchmark</button>
    <label className={styles.label}>Benchmark measurements<input type="file" accept=".json,application/json" onChange={e=>load(e.target.files[0])}/></label>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {!report&&<p className={styles.small}>No measurements loaded. No sample savings are shown.</p>}
    {report&&<><p>{report.pairs} valid pairs · {report.excludedGroups} excluded or incomplete pairs · {report.allTrials} total trials · {report.failures} provider failures · {report.failedActions} failed actions</p>
      {report.stopReason&&<p role="status">{report.stopReason}</p>}
      {report.pairs?<><div className={styles.waitBars} aria-label="Median total action wait comparison">{[['OFF',report.off.wait],['ON',report.on.wait]].map(([label,wait])=><div key={label}><span>{label} · {seconds(wait)}</span><div className={styles.waitTrack}><div className={label==='ON'?styles.onBar:styles.offBar} style={{width:`${Math.max(1,100*wait/Math.max(report.off.wait,report.on.wait,1))}%`}}/></div></div>)}</div><div className={styles.metrics}><div><strong>{seconds(report.off.wait)}</strong><span>OFF median total action wait</span></div><div><strong>{seconds(report.on.wait)}</strong><span>ON median total action wait</span></div><div><strong>{seconds(report.savedMs)}</strong><span>Median paired waiting reduction (negative = slower)</span></div><div><strong>{report.off.totalCalls} → {report.on.totalCalls}</strong><span>Total provider calls across matched trials</span></div></div><p>ON prefires: {report.on.used} consumed / {report.on.unused} unused across valid pairs.</p><div className={styles.tableWrap}><table><caption>Each workflow, including the unexpected action</caption><thead><tr><th>Workflow / pairs</th><th>OFF median wait</th><th>ON median wait</th><th>Paired reduction</th><th>Net extra calls</th><th>Unused prefires</th></tr></thead><tbody>{report.scenarios.map(s=><tr key={s.name}><td>{s.name} / {s.pairs}</td><td>{seconds(s.offMs)}</td><td>{seconds(s.onMs)}</td><td>{seconds(s.savedMs)}</td><td>{s.extraCalls}</td><td>{s.unused}</td></tr>)}</tbody></table></div></>:<p>No valid matched pairs. Inspect failures or complete both modes before claiming savings.</p>}
      <p className={styles.small}>{report.description} Recorded {report.createdAt||'without date'}. Failure counts include all trials; latency comparison includes only complete, failure-free pairs with matching provider settings. Scripted workflows measure latency tradeoffs, not real-user prediction accuracy. These are server action waits, excluding browser rendering.</p></>}
  </section>;
}
