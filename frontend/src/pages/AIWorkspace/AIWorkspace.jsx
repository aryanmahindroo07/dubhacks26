import {useEffect,useRef,useState} from 'react';
import {getAISession,setAIPrefetch,uploadAIImage,runAIAction,resetAIRun,restartExpiredAIRun} from '../../services/ai.js';
import styles from './AIWorkspace.module.css';
import AppLayout from '../../components/AppLayout/AppLayout.jsx';

const ACTIONS=[['READ_TEXT','Read text','Perceptron'],['EXTRACT_FIELDS','Extract fields','Gemini'],['SUMMARIZE','Summarize','Gemini'],['MAKE_TASKS','Turn into tasks','Gemini']];
const LABELS=Object.fromEntries(ACTIONS.map(([id,label])=>[id,label]));
const milliseconds=n=>`${(n||0).toFixed(1)} ms`;

function Result({result}){
  if(result.text!==undefined)return <>{result.quality?.hasReadableTotal===false&&<p>Receipt total was not readable in the extracted text. Check the image; automatic field extraction is skipped.</p>}<pre className={styles.transcript}>{result.text}</pre></>;
  if(result.fields)return <><p>{result.validation?.requiresReview?'Some values need review. Unsupported amounts are hidden.':result.validation?'Values have supporting OCR text. Verify them against the image.':null}</p><dl className={styles.fields}>{result.fields.map((field,i)=><div key={i}><dt>{field.name}</dt><dd>{field.value??(field.status==='not-stated'?'Not stated':'Needs review — not readable from OCR')}</dd>{field.reason&&<dd className={styles.small}>{field.reason}</dd>}{field.evidence&&<dd className={styles.small}>OCR: {field.evidence}</dd>}</div>)}</dl></>;
  if(result.tasks)return result.tasks.length?<ul>{result.tasks.map((item,i)=><li key={i}>{item.task}{item.owner&&` · ${item.owner}`}{item.due&&` · ${item.due}`}</li>)}</ul>:<p>No explicit tasks were found.</p>;
  return <p>{result.summary}</p>;
}

export default function AIWorkspace(){
  const [session,setSession]=useState(null),[item,setItem]=useState(null),[type,setType]=useState('RECEIPT');
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[result,setResult]=useState(null),[read,setRead]=useState(false);
  const [notice,setNotice]=useState(''),[sessionFailed,setSessionFailed]=useState(false);
  const fileInput=useRef(null);
  useEffect(()=>{
    let active=true;
    const refresh=()=>getAISession().then(s=>{if(active){setSession(s);setSessionFailed(false);}}).catch(e=>{if(active){setError(e.message);setSessionFailed(true);}});
    refresh();
    const timer=setInterval(refresh,1000);
    return()=>{active=false;clearInterval(timer);};
  },[]);
  const metrics=session?.metrics;
  async function upload(file,category=type){
    if(!file)return;
    setBusy('Uploading image');setError('');setResult(null);setRead(false);setItem(null);
    try{const uploaded=await uploadAIImage(file,category);setItem(uploaded);setNotice('Image loaded. Read text first; Gemini transformations use the resulting OCR text.');}
    catch(e){setError(e.message);}finally{setBusy('');}
  }
  async function sample(category){
    setType(category);setBusy('Loading sample');setError('');
    try{
      const url=category==='RECEIPT'?'/ai-samples/receipt.png':'/ai-samples/whiteboard.png';
      const response=await fetch(url);if(!response.ok)throw new Error('Sample image could not be loaded.');
      const blob=await response.blob();await upload(new File([blob],`${category.toLowerCase()}-synthetic.png`,{type:'image/png'}),category);
    }catch(e){setError(e.message);setBusy('');}
  }
  async function run(action){
    setBusy(LABELS[action]);setError('');setResult(null);
    try{
      const output=await runAIAction(item.id,action);setResult({...output,action});
      if(action==='READ_TEXT')setRead(true);
      setSession(await getAISession());
    }catch(e){setError(e.message);}finally{setBusy('');}
  }
  async function toggle(){
    setError('');
    try{const next=await setAIPrefetch(!session.enabled);setSession(next);setNotice(next.enabled?'Prefetch enabled. Additional provider calls may be billed.':'Prefetch paused. Calls already running can finish; cached results remain available.');}
    catch(e){setError(e.message);}
  }
  async function fresh(){
    setBusy('Starting fresh run');setError('');
    try{
      const s=sessionFailed?await restartExpiredAIRun():await resetAIRun();
      setSession(s);setSessionFailed(false);setItem(null);setRead(false);setResult(null);setNotice('Fresh cache, counters, and seed model. Prefetch is OFF. Load the same image again for a comparison.');
      if(fileInput.current)fileInput.current.value='';
    }catch(e){setError(e.message);}finally{setBusy('');}
  }
  function download(){
    const {sessionId: _sessionId, ...measurements}=session;
    const data={exportedAt:new Date().toISOString(),...measurements};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`requestflow-ai-${session.enabled?'on':'off'}-${Date.now()}.json`;a.click();URL.revokeObjectURL(url);
  }
  return <AppLayout activePage="ai">
    <main className={styles.page}>
      <div className={styles.heading}><div><p className={styles.eyebrow}>Visual AI workspace</p><h1>Prepare the next step.</h1><p className={styles.subtitle}>Perceptron reads the image. Gemini transforms the text. RequestFlow anticipates a matching next action while you review.</p></div><div className={styles.controls}><button className={styles.prefetchButton} disabled={!session||Boolean(busy)} aria-pressed={session?.enabled||false} onClick={toggle}>{session?.enabled?'Pause prefetch':'Enable prefetch'}</button><button disabled={Boolean(busy)||Boolean(metrics?.running)} onClick={fresh}>Fresh run</button></div></div>
      <p className={styles.disclosure}>Read text sends the selected image to Perceptron. Transformations send OCR text to Gemini. Enabling prefetch can make up to {session?.prefetchLimitPerItem??3} additional paid calls per image. Nothing is sent as a message or added to an external account.</p>
      <div className={styles.providerStatus} aria-label="Provider configuration"><span>Perceptron: {session?(session.providers.perceptron.configured?'key configured':'key needed'):'checking…'}</span><span>Gemini: {session?(session.providers.gemini.configured?'key configured':'key needed'):'checking…'}</span><span>Prefetch: {session?.enabled?'ON':'OFF'}</span></div>
      {session&&(!session.providers.perceptron.configured||!session.providers.gemini.configured)&&<p className={styles.setup}>Add the missing API keys to <code>backend/.env</code> using <code>backend/.env.example</code>, then restart the backend. This workspace does not substitute simulated AI results.</p>}
      {error&&<p role="alert" className={styles.error}>{error}</p>}
      <p role="status" className={styles.notice}>{busy?`${busy}…`:notice}</p>
      <div className={styles.workspace}>
        <section className={styles.panel} aria-labelledby="image-heading"><h2 id="image-heading">1. Choose an image</h2>
          <label className={styles.label}>Image category<select value={type} disabled={Boolean(busy)} onChange={e=>setType(e.target.value)}><option value="RECEIPT">Receipt</option><option value="WHITEBOARD">Whiteboard</option></select></label>
          <label className={styles.label}>PNG, JPEG, or WebP · up to 5 MB<input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" disabled={!session||Boolean(busy)} onChange={e=>upload(e.target.files?.[0])}/></label>
          <div className={styles.controls}><button disabled={!session||Boolean(busy)} onClick={()=>sample('RECEIPT')}>Demo receipt</button><button disabled={!session||Boolean(busy)} onClick={()=>sample('WHITEBOARD')}>Demo whiteboard</button></div>
          <p className={styles.small}>Demo images contain synthetic text. They are actual image inputs; provider responses are generated live.</p>
          {item?<figure><img className={styles.preview} src={item.preview} alt={`Uploaded ${item.type.toLowerCase()}: ${item.name}`}/><figcaption>{item.name} · {item.type.toLowerCase()}</figcaption></figure>:<div className={styles.empty}>Your image will appear here.</div>}
        </section>
        <section className={styles.panel} aria-labelledby="action-heading"><h2 id="action-heading">2. Run an action</h2>
          <div className={styles.actions}>{ACTIONS.map(([id,label,provider])=><button key={id} disabled={!item||Boolean(busy)||sessionFailed||(id!=='READ_TEXT'&&!read)||!session?.providers[provider.toLowerCase()].configured} onClick={()=>run(id)}><span>{label}</span><small>{provider}</small></button>)}</div>
          {!read&&<p className={styles.small}>Gemini actions become available after Read text succeeds.</p>}
          {result?<div aria-live="polite"><h3>{LABELS[result.action]}</h3><p className={styles.source}>{result.source==='cache'?'Completed cache hit':result.source==='in-flight'?'Joined running request':'New provider request'}{result.usedPrefetch?' · consumed a prefetch':''} · observed wait {milliseconds(result.waitMs)}</p><p className={styles.small}>{result.provider} · {result.model} · original provider call {milliseconds(result.providerMs)}</p><Result result={result.result}/><p className={styles.small}>AI-generated output. Check extracted amounts, names, and tasks before using them.</p></div>:<div className={styles.empty}>Run Read text, then choose a transformation. If a matching prefire is ready, it is reused.</div>}
          {!!session?.predictions.length&&<div className={styles.predictions}><h3>Latest next-action estimates</h3>{session.predictions.map(p=><p key={p.action}>{p.label}: {(p.probability*100).toFixed(1)}% · {p.shouldPrefetch&&p.eligible?'eligible':'skipped'} · {p.latencySource} latency estimate</p>)}</div>}
        </section>
      </div>
      <section className={styles.panel} aria-labelledby="metrics-heading"><div className={styles.sectionHeading}><h2 id="metrics-heading">This run · measured activity</h2><button disabled={!session||Boolean(busy)||Boolean(metrics?.running)} onClick={download}>Export measurements</button></div>
        {metrics&&<><div className={styles.metrics}><div><strong>{metrics.navigations}</strong><span>Completed actions</span></div><div><strong>{metrics.hits} / {metrics.reused}</strong><span>Cache hits / in-flight joins</span></div><div><strong>{metrics.usedPrefetches} / {metrics.unusedPrefetches}</strong><span>Used / unused prefires so far</span></div><div><strong>{milliseconds(metrics.medianWaitMs)}</strong><span>Median observed wait</span></div></div><p>Provider calls: {metrics.demandCalls} demand + {metrics.speculativeCalls} speculative · Pending prefires: {metrics.pendingPrefetches} · Failed prefires: {metrics.failedPrefetches} · Failed actions: {metrics.failedActions ?? 0} · Total action wait (including failures): {(metrics.totalWaitMs/1000).toFixed(2)} s</p></>}
        <p className={styles.small}>Unused prefires may still be consumed later. Fresh run resets cache, counters, and learned transitions for a matched comparison. Switching OFF alone preserves cache. Prediction probabilities start from synthetic journeys, not verified user behavior. Initial scoring costs/latencies are estimates; exported waits and provider usage are measured, not a dollar ROI claim.</p>
        <div className={styles.tableWrap}><table><caption className={styles.srOnly}>AI provider, speculation, and navigation events</caption><thead><tr><th>Event</th><th>Action</th><th>Outcome</th><th>Time</th></tr></thead><tbody>{session?.requestLog.map(e=><tr key={e.id}><td>{e.kind}</td><td>{LABELS[e.action]||e.action}</td><td>{e.result}{e.message?` · ${e.message}`:''}{e.usedPrefetch?' · useful prefire':''}</td><td>{e.waitMs!==undefined?milliseconds(e.waitMs):e.providerMs!==undefined?milliseconds(e.providerMs):'—'}</td></tr>)}</tbody></table></div>
      </section>
    </main>
  </AppLayout>;
}
