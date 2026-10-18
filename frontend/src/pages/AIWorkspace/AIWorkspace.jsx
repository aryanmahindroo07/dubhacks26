import {useEffect,useRef,useState} from 'react';
import {getAISession,setAIPrefetch,setAIReadAhead,uploadAIImage,openAIItem,runAIAction,setAIText,resetAIRun,restartExpiredAIRun} from '../../services/ai.js';
import styles from './AIWorkspace.module.css';
import AppLayout from '../../components/AppLayout/AppLayout.jsx';
import PolicyEvidence from './PolicyEvidence.jsx';
import {PrefireStatus,ComparisonPanel,DemoGuide} from './DemoEvidence.jsx';
import BenchmarkHighlight from './BenchmarkHighlight.jsx';
import {actionBadge,predictionReason} from './prefetchState.mjs';

const ACTIONS=[['READ_TEXT','Read text','Perceptron'],['EXTRACT_FIELDS','Extract fields','Gemini'],['SUMMARIZE','Summarize','Gemini'],['MAKE_TASKS','Turn into tasks','Gemini']];
const LABELS=Object.fromEntries(ACTIONS.map(([id,label])=>[id,label]));
const milliseconds=n=>`${(n||0).toFixed(1)} ms`;
const percent=p=>`${((p||0)*100).toFixed(0)}%`;
const TYPE_NAMES={RECEIPT:'Receipts',WHITEBOARD:'Whiteboards'};

function Result({result}){
  if(result.text!==undefined)return <>{result.quality?.hasReadableTotal===false&&<p>Receipt total was not readable in the extracted text. Check the image; automatic field extraction is skipped.</p>}<pre className={styles.transcript}>{result.text}</pre></>;
  if(result.fields)return <><p>{result.validation?.requiresReview?'Some values need review. Unsupported amounts are hidden.':result.validation?'Values have supporting OCR text. Verify them against the image.':null}</p><dl className={styles.fields}>{result.fields.map((field,i)=><div key={i}><dt>{field.name}</dt><dd>{field.value??(field.status==='not-stated'?'Not stated':'Needs review — not readable from OCR')}</dd>{field.reason&&<dd className={styles.small}>{field.reason}</dd>}{field.evidence&&<dd className={styles.small}>OCR: {field.evidence}</dd>}</div>)}</dl></>;
  if(result.tasks)return result.tasks.length?<ul>{result.tasks.map((item,i)=><li key={i}>{item.task}{item.owner&&` · ${item.owner}`}{item.due&&` · ${item.due}`}</li>)}</ul>:<p>No explicit tasks were found.</p>;
  return <p>{result.summary}</p>;
}

function LearningCard({entry}){
  const shifted=entry.startingPrefetch!==entry.nowPrefetch;
  const name=TYPE_NAMES[entry.type]||entry.type;
  return <div className={styles.learningCard}>
    <h3>{name}: after Read text</h3>
    <p className={shifted?styles.shift:styles.small} role={shifted?'status':undefined}>
      {shifted?`Prefetch changed: ${LABELS[entry.startingPrefetch]||'nothing'} → ${LABELS[entry.nowPrefetch]||'nothing'}`
        :`Prefetches ${LABELS[entry.nowPrefetch]||'nothing'}`}
    </p>
    <p className={styles.small}>{entry.finishedItems} finished {name.toLowerCase()} · {entry.observations} choices at this step</p>
    <details className={styles.learningDetails}><summary>See how the probabilities changed</summary><table><caption className={styles.srOnly}>{name}: next-action likelihood, starting model versus now</caption>
      <thead><tr><th scope="col">Next action</th><th scope="col">Starting model</th><th scope="col">Now</th></tr></thead>
      <tbody>{entry.rows.map(r=><tr key={r.action}><td>{r.label}</td><td>{percent(r.starting)}</td><td>{percent(r.now)}</td></tr>)}</tbody>
    </table></details>
  </div>;
}

// What to tell the user after Read text fails, by kind of error (the backend
// decides the kind and has already retried temporary failures).
const FAILURE_COPY={
  retry:{title:"Couldn't reach Perceptron.",advice:'This looks temporary. Try again, or type the text yourself.',canRetry:true},
  image:{title:"Couldn't read text from this image.",advice:'Trying the same image again will give the same result. Use a sharper or cropped photo, or type the text yourself.',canRetry:false},
  wait:{title:'Perceptron rate limit reached.',advice:'Wait a minute, then try again, or type the text yourself.',canRetry:true},
  setup:{title:"Perceptron isn't set up correctly.",advice:'Fix the key or model in backend/.env and restart the backend. You can type the text yourself in the meantime.',canRetry:false},
};
function FailurePanel({error,onRetry,typing,onType}){
  const copy=FAILURE_COPY[error.recovery]||FAILURE_COPY.retry;
  return <div className={styles.warning} role="group" aria-label="Read text failed">
    <p><strong>{copy.title}</strong> {copy.advice}</p>
    <p className={styles.small}>{error.message}</p>
    <div className={styles.controls}>{copy.canRetry&&<button onClick={onRetry}>Retry Read text</button>}<button aria-expanded={typing} onClick={onType}>Type the text instead</button></div>
  </div>;
}

export default function AIWorkspace(){
  const [session,setSession]=useState(null),[type,setType]=useState('RECEIPT');
  const [previews,setPreviews]=useState({}),[currentId,setCurrentId]=useState(null);
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[result,setResult]=useState(null);
  const [notice,setNotice]=useState(''),[sessionFailed,setSessionFailed]=useState(false);
  const [typing,setTyping]=useState(false),[typedText,setTypedText]=useState('');
  const fileInput=useRef(null);
  useEffect(()=>{
    let active=true;
    const refresh=()=>getAISession().then(s=>{if(active){setSession(s);setSessionFailed(false);}}).catch(e=>{if(active){setError(e.message);setSessionFailed(true);}});
    refresh();
    const timer=setInterval(refresh,1000);
    return()=>{active=false;clearInterval(timer);};
  },[]);
  const metrics=session?.metrics;
  const items=session?.items??[];
  const current=items.find(i=>i.id===currentId)||null;
  const read=Boolean(current?.read);
  const predictions=current?.predictions??[];
  const learning=session?.learning?.find(entry=>entry.type===current?.type);
  const learningChanged=learning&&learning.startingPrefetch!==learning.nowPrefetch;
  const refresh=async()=>setSession(await getAISession());

  async function openItem(id){
    setError('');setResult(null);setTyping(false);setTypedText('');
    try{await openAIItem(id);setCurrentId(id);await refresh();}
    catch(e){setError(e.message);}
  }
  async function addFiles(files,category=type){
    const list=[...(files||[])];
    if(!list.length)return;
    setBusy(list.length>1?`Adding ${list.length} images`:'Uploading image');setError('');
    try{
      let first=null;
      for(const file of list){
        const uploaded=await uploadAIImage(file,category);
        setPreviews(p=>({...p,[uploaded.id]:uploaded.preview}));
        first||=uploaded;
      }
      if(!currentId&&first){await openAIItem(first.id);setCurrentId(first.id);setResult(null);}
      await refresh();
      setNotice(list.length>1?`${list.length} images added to the inbox.`:'Image added. Read text first; Gemini actions use the resulting text.');
    }catch(e){setError(e.message);}
    finally{setBusy('');if(fileInput.current)fileInput.current.value='';}
  }
  async function realReceipts(){
    setBusy('Loading public receipts');setError('');
    try{
      const files=await Promise.all(['family-dollar','walmart','cameron-market'].map(async name=>{
        const response=await fetch(`/real-receipts/us-${name}.jpg`);
        if(!response.ok)throw new Error('Public receipt could not be loaded.');
        return new File([await response.blob()],`us-${name}.jpg`,{type:'image/jpeg'});
      }));
      await addFiles(files,'RECEIPT');
    }catch(e){setError(e.message);setBusy('');}
  }
  async function sample(category){
    setBusy('Loading sample');setError('');
    try{
      const url=category==='RECEIPT'?'/ai-samples/receipt.png':'/ai-samples/whiteboard.png';
      const response=await fetch(url);if(!response.ok)throw new Error('Sample image could not be loaded.');
      const blob=await response.blob();
      await addFiles([new File([blob],`${category.toLowerCase()}-synthetic.png`,{type:'image/png'})],category);
    }catch(e){setError(e.message);setBusy('');}
  }
  async function run(action){
    setBusy(action==='READ_TEXT'?'Reading text (retrying up to 2 times if it fails)':LABELS[action]);setError('');setResult(null);
    try{const output=await runAIAction(current.id,action);setResult({...output,action});await refresh();}
    catch(e){setError(e.message);await refresh().catch(()=>{});}finally{setBusy('');}
  }
  async function useTypedText(){
    setBusy('Saving text');setError('');
    try{const output=await setAIText(current.id,typedText);setResult({...output,action:'READ_TEXT'});setTyping(false);setTypedText('');await refresh();setNotice('Using the text you typed. Gemini actions are now available.');}
    catch(e){setError(e.message);}finally{setBusy('');}
  }
  async function next(){
    const index=items.findIndex(i=>i.id===currentId);
    const following=items[index+1];
    if(following)await openItem(following.id);
  }
  async function toggle(){
    setError('');
    try{const s=await setAIPrefetch(!session.enabled);setSession(s);setNotice(s.enabled?'Prefetch on: after each action, the likely next action on this image may run early (extra provider calls may be billed).':'Prefetch paused. Calls already running can finish; cached results remain available.');}
    catch(e){setError(e.message);}
  }
  async function toggleReadAhead(){
    setError('');
    try{const s=await setAIReadAhead(!session.readAhead);setSession(s);setNotice(s.readAhead?'Read-ahead on: the next unread image in your inbox is sent to Perceptron in the background while you work.':'Read-ahead off: images are only sent when you open them and click Read text.');}
    catch(e){setError(e.message);}
  }
  async function fresh(){
    setBusy('Starting fresh run');setError('');
    try{
      const s=sessionFailed?await restartExpiredAIRun():await resetAIRun();
      setSession(s);setSessionFailed(false);setCurrentId(null);setPreviews({});setResult(null);
      setNotice('Fresh inbox, cache, counters and learned habits. Prefetch and read-ahead are OFF.');
      if(fileInput.current)fileInput.current.value='';
    }catch(e){setError(e.message);}finally{setBusy('');}
  }
  function download(){
    const {sessionId: _sessionId, ...measurements}=session;
    const data={exportedAt:new Date().toISOString(),...measurements};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`requestflow-ai-${session.enabled?'on':'off'}-${Date.now()}.json`;a.click();URL.revokeObjectURL(url);
  }
  const index=items.findIndex(i=>i.id===currentId);
  return <AppLayout activePage="ai">
    <main className={styles.page}>
      <div className={styles.heading}><div><p className={styles.eyebrow}>RequestFlow · live AI demo</p><h1>AI that’s ready before you ask.</h1><p className={styles.subtitle}>RequestFlow learns your next step and prepares it while you review. Try it with receipts or whiteboards.</p></div><div className={styles.controls}><button className={styles.prefetchButton} disabled={!session||Boolean(busy)} aria-pressed={session?.enabled||false} onClick={toggle}>{session?.enabled?'Pause prefetch':'Enable prefetch'}</button><button disabled={Boolean(busy)||Boolean(metrics?.running)} onClick={fresh}>Fresh run</button></div></div>
      <BenchmarkHighlight/>
      <p className={styles.disclosure}>Images go to Perceptron; extracted text goes to Gemini. Prefetch allows up to {session?.prefetchLimitPerItem??3} extra paid calls per image. Actions only prepare results here.</p>
      <div className={styles.providerStatus} aria-label="Provider configuration"><span>Perceptron: {session?(session.providers.perceptron.configured?'key configured':'key needed'):'checking…'}</span><span>Gemini: {session?(session.providers.gemini.configured?'key configured':'key needed'):'checking…'}</span><span>Prefetch: {session?.enabled?'ON':'OFF'}</span><span>Read-ahead: {session?.readAhead?'ON':'OFF'}</span></div>
      {error&&<p role="alert" className={styles.error}>{error}</p>}
      {(busy||notice)&&<p role="status" className={styles.notice}>{busy?`${busy}…`:notice}</p>}
      <div className={styles.workspace}>
        <section className={styles.panel} aria-labelledby="inbox-heading"><h2 id="inbox-heading">1. Inbox</h2>
          <label className={styles.label}>Image category<select value={type} disabled={Boolean(busy)} onChange={e=>setType(e.target.value)}><option value="RECEIPT">Receipt</option><option value="WHITEBOARD">Whiteboard</option></select></label>
          <label className={styles.label}>Add images · PNG, JPEG, or WebP · up to 5 MB each<input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={!session||Boolean(busy)} onChange={e=>addFiles(e.target.files)}/></label>
          <div className={styles.controls}><button disabled={!session||Boolean(busy)} onClick={()=>sample('RECEIPT')}>Add demo receipt</button><button disabled={!session||Boolean(busy)} onClick={()=>sample('WHITEBOARD')}>Add demo whiteboard</button></div>
          <div className={styles.controls}><button disabled={!session||Boolean(busy)||items.length>7} onClick={realReceipts}>Add 3 real US receipts</button></div><p className={styles.small}>Public receipt photos · <a href="/real-receipts/ATTRIBUTION.md" target="_blank" rel="noreferrer">Credits / licenses</a></p>
          <div className={styles.toggleRow}><button disabled={!session||Boolean(busy)} aria-pressed={session?.readAhead||false} onClick={toggleReadAhead}>{session?.readAhead?'Stop reading ahead':'Read ahead'}</button><p className={styles.small}>Also send the next unread image to Perceptron in the background. Off by default.</p></div>
          {items.length?<ul className={styles.inboxList} aria-label="Images in this run">{items.map((it,i)=><li key={it.id}><button aria-current={it.id===currentId} disabled={Boolean(busy)} onClick={()=>openItem(it.id)}>
            <span className={styles.itemName}>{i+1}. {it.name}</span>
            <span className={styles.chips}>
              <span className={styles.chip}>{it.type==='RECEIPT'?'Receipt':'Whiteboard'}</span>
              {it.read?<span className={styles.chip}>Text read</span>:it.textReady?<span className={`${styles.chip} ${styles.chipReady}`}>Text ready</span>:it.textPending?<span className={styles.chip}>Reading…</span>:null}
              {!it.read&&it.error?.action==='READ_TEXT'&&<span className={`${styles.chip} ${styles.chipWarn}`}>Couldn't read</span>}
              {it.textSource==='manual'&&<span className={styles.chip}>Typed text</span>}
              {it.duplicateOf&&<span className={`${styles.chip} ${styles.chipWarn}`}>Possible duplicate</span>}
            </span></button></li>)}</ul>:<div className={styles.empty}>Your images will appear here.</div>}
          {current&&<figure><img className={styles.preview} src={previews[current.id]} alt={`${current.type.toLowerCase()}: ${current.name}`}/><figcaption>{current.name} · {current.type.toLowerCase()}</figcaption></figure>}
          <p className={styles.small}>Demo images are synthetic; public receipt photos are real.</p>
        </section>
        <div className={styles.actionColumn}>
        <section className={styles.panel} aria-labelledby="action-heading"><div className={styles.sectionHeading}><h2 id="action-heading">2. Work on {current?`image ${index+1}`:'an image'}</h2>{current&&index<items.length-1&&<button disabled={Boolean(busy)} onClick={next}>Next image →</button>}</div>
          {current?.duplicateOf&&<p className={styles.warning}>Possible duplicate of “{current.duplicateOf.name}”. {current.duplicateOf.reason}</p>}
          {!sessionFailed&&<PrefireStatus session={session} current={current} result={result}/>}
          {learningChanged&&<div className={styles.learningMoment} role="status"><span>Learning live</span><strong>Prefetch changed: {LABELS[learning.startingPrefetch]||'nothing'} → {LABELS[learning.nowPrefetch]||'nothing'}</strong></div>}
          <div className={styles.actions}>{ACTIONS.map(([id,label,provider])=>{
            const badge=sessionFailed?null:actionBadge(current?.actionStates?.[id]);
            return <button key={id} className={badge?.ready?styles.actionReady:undefined} disabled={!current||Boolean(busy)||sessionFailed||(id!=='READ_TEXT'&&!read)||!session?.providers[provider.toLowerCase()].configured} onClick={()=>run(id)}><span className={styles.actionTitle}><span>{label}</span>{badge&&<span className={badge.ready?styles.readyBadge:styles.actionBadge}>{badge.label}</span>}</span><small>{provider}</small></button>;
          })}</div>
          {current&&!read&&!busy&&current.error?.action==='READ_TEXT'&&<FailurePanel error={current.error} onRetry={()=>run('READ_TEXT')} typing={typing} onType={()=>setTyping(t=>!t)}/>}
          {current&&!read&&typing&&<div className={styles.typed}>
            <label className={styles.label}>Text from the image<textarea rows="6" value={typedText} onChange={e=>setTypedText(e.target.value)} placeholder={'e.g. TOTAL 13.20\nDATE 2026-10-17'}/></label>
            <button disabled={!typedText.trim()||Boolean(busy)} onClick={useTypedText}>Use this text</button>
          </div>}
          {current&&!read&&!current.error&&<p className={styles.small}>Gemini actions become available after Read text succeeds.</p>}
          {result?<div aria-live="polite"><h3>{LABELS[result.action]}</h3><p className={styles.source}>{result.source==='manual'?'Text typed by you':result.source==='cache'?'From cache':result.source==='in-flight'?'Joined running request':'New provider request'} · {milliseconds(result.waitMs)} wait</p><Result result={result.result}/><p className={styles.small}>AI-generated · verify before use.</p><details className={styles.resultDetails}><summary>Provider details</summary><p>{result.provider} · {result.model} · original call {milliseconds(result.providerMs)}{result.usedPrefetch?' · used a prefetch':''}</p></details></div>:<div className={styles.empty}>{current?'Start with Read text. Watch for ✓ Ready on your next action.':'Add an image to start.'}</div>}
          {!sessionFailed&&!!predictions.length&&<div className={styles.predictions}><h3>What runs early — and what doesn’t</h3><ul className={styles.decisionList}>{predictions.map(p=><li key={p.action}><div><strong>{p.label}</strong><span>{percent(p.probability)} likely</span></div><p>{predictionReason(p,session,current)}</p></li>)}</ul><details className={styles.learningDetails}><summary>How this is decided</summary><p>Markov next-action estimates, adjusted by your choices. Calls must clear a likelihood floor, estimated cost benefit and request budget. Initial costs and latencies are assumptions; this is not measured accuracy or dollar ROI.</p></details></div>}
        </section>
        {session&&(!session.providers.perceptron.configured||!session.providers.gemini.configured)&&<p className={styles.setup}>Add the missing API keys to <code>backend/.env</code> using <code>backend/.env.example</code>, then restart the backend. This workspace does not substitute simulated AI results.</p>}
        </div>
      </div>
      {!!session?.learning?.length&&<section className={`${styles.panel} ${styles.learning}`} aria-labelledby="learning-heading">
        <h2 id="learning-heading">It learns your next move</h2>
        <p className={styles.small}>Starts with 500 generated journeys, then adapts to choices in this run.</p>
        <div className={styles.learningGrid}>{session.learning.map(entry=><LearningCard key={entry.type} entry={entry}/>)}</div>
      </section>}
      <section className={styles.panel} aria-labelledby="metrics-heading"><div className={styles.sectionHeading}><h2 id="metrics-heading">This run · measured activity</h2><button disabled={!session||Boolean(busy)||Boolean(metrics?.running)} onClick={download}>Export measurements</button></div>
        {metrics&&<div className={styles.metrics}><div><strong>{metrics.navigations}</strong><span>Completed actions</span></div><div><strong>{metrics.hits} / {metrics.reused}</strong><span>Cache hits / in-flight joins</span></div><div><strong>{metrics.usedPrefetches} / {metrics.unusedPrefetches}</strong><span>Used / unused prefetches so far</span></div><div><strong>{milliseconds(metrics.medianWaitMs)}</strong><span>Median observed wait</span></div></div>}
        <details className={styles.eventDetails}><summary>Show details · request log</summary>
        {metrics&&<p>Calls: {metrics.demandCalls} demand + {metrics.speculativeCalls} speculative · {metrics.pendingPrefetches} pending · {metrics.failedPrefetches} background failures · {metrics.failedActions??0} failed actions · {(metrics.totalWaitMs/1000).toFixed(2)} s total wait</p>}
        <p>Unused calls may be used later. Fresh run clears cache, counters and learning; pausing keeps the cache. Exported waits are measured server action times.</p>
        <div className={styles.tableWrap}><table><caption className={styles.srOnly}>AI provider, prefetch, read-ahead and navigation events</caption><thead><tr><th>Event</th><th>Action</th><th>Outcome</th><th>Time</th></tr></thead><tbody>{session?.requestLog.map(e=><tr key={e.id}><td>{e.kind}</td><td>{LABELS[e.action]||e.action}</td><td>{e.result}{e.message?` · ${e.message}`:''}{e.usedPrefetch?' · useful prefetch':''}</td><td>{e.waitMs!==undefined?milliseconds(e.waitMs):e.providerMs!==undefined?milliseconds(e.providerMs):'—'}</td></tr>)}</tbody></table></div>
        </details>
      </section>
      <DemoGuide/>
      <details className={`${styles.panel} ${styles.evidenceDetails}`}><summary>Benchmark evidence · compare policies or load your own results</summary><PolicyEvidence/><ComparisonPanel/></details>
    </main>
  </AppLayout>;
}
