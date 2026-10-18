"""Score CORD total/subtotal/tax values; annotations are never provider inputs."""
import argparse,json,re,statistics,random
from decimal import Decimal,InvalidOperation
from pathlib import Path
ALIASES={
 'total':{'total','totalamount','grandtotal','totalprice','amountdue','totalpayment','totalbayar'},
 'subtotal':{'subtotal','subtotalprice','subtotalamount'},
 'tax':{'tax','taxamount','taxprice','totaltax','ppn','vat'},
}
def money(value):
    if not isinstance(value,str):return None
    s=re.sub(r'(?i)\b(?:rp|idr)\b|\s|\$','',value)
    if not re.fullmatch(r'-?\d+(?:[.,]\d+)*',s):return None
    sign='-' if s.startswith('-') else '';s=s.lstrip('-')
    if re.fullmatch(r'\d{1,3}(?:[.,]\d{3})+',s):s=re.sub(r'[.,]','',s)
    elif '.' in s or ',' in s:
        parts=re.split('[.,]',s)
        if len(parts[-1]) in (1,2):s=''.join(parts[:-1])+'.'+parts[-1]
        elif len(parts)==2:s=''.join(parts)
        else:return None
    try:return Decimal(sign+s)
    except InvalidOperation:return None

def score_fields(result,expected):
    fields=result.get('fields',[]) if isinstance(result,dict) else []
    checks=[]
    for label,reference in expected.items():
        values=[f.get('value') for f in fields if re.sub('[^a-z]','',str(f.get('name','')).lower()) in ALIASES[label]]
        normalized={money(v) for v in values}
        checks.append({'field':label,'expected':reference,'predicted':values,'correct':len(normalized)==1 and None not in normalized and money(reference) in normalized})
    return checks

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--results',required=True);ap.add_argument('--manifest',default='datasets/cord-test/manifest.json');ap.add_argument('--out',required=True);a=ap.parse_args()
    data=json.loads(Path(a.results).read_text());m=json.loads(Path(a.manifest).read_text());rows=[];pairs=[]
    for sample in m['samples']:
        trials=[t for t in data['trials'] if t['scenario']==sample['id']+'-extract']
        for t in trials:
            extraction=next((op for op in t['actions'] if op['action']=='EXTRACT_FIELDS'),None)
            checks=score_fields(extraction['result'] if extraction else {},sample['expected'])
            rows.append({'sample':sample['id'],'mode':t['mode'],'completed':bool(extraction),'checks':checks,'correct':sum(c['correct'] for c in checks),'expected':len(checks)})
        off=next((t for t in trials if t['mode']=='OFF' and t['clean']),None);on=next((t for t in trials if t['mode']=='ON' and t['clean']),None)
        if off and on:pairs.append({'sample':sample['id'],'dwellMs':on['dwellMs'],'offWaitMs':off['metrics']['totalWaitMs'],'onWaitMs':on['metrics']['totalWaitMs'],'savedMs':off['metrics']['totalWaitMs']-on['metrics']['totalWaitMs']})
    output={'source':m['source'],'selection':m['selection'],'scoring':'Exact normalized amount match for total/subtotal/tax only. Fixed English/Indonesian field aliases; ambiguous, missing or failed outputs are incorrect. This is not a full OCR metric or prediction-accuracy metric. Each mode is a separate output on the same image, not an independent document.','rows':rows,'latencyPairs':pairs}
    lines=['# Real-receipt evaluation','',m['selection'],'','Real CORD test photographs and annotated amounts; action sequences are scripted. The Markov model still starts from synthetic journeys. CORD was not supplied to this app’s predictor or prompts as training data; external provider pretraining overlap is unknown.','', '| Mode | Matched amount fields / reference fields | Completed extraction requests |','|---|---:|---:|']
    for mode in ['OFF','ON']:
        selected=[r for r in rows if r['mode']==mode];correct=sum(r['correct'] for r in selected);total=sum(r['expected'] for r in selected)
        lines.append(f'| {mode} | {correct} / {total} | {sum(r["completed"] for r in selected)} / {len(selected)} |')
    lines+=['','Scoring covers total, subtotal and tax when annotated, using exact normalized amount matches and predefined field-name aliases. Missing/failed fields count as incorrect. It does not measure complete OCR accuracy or arbitrary field correctness. See score details for misses.','','| Receipt | Review interval | OFF total action wait | ON total action wait | Saved |','|---|---:|---:|---:|---:|']
    for p in pairs:lines.append(f'| {p["sample"]} | {p["dwellMs"]} ms | {p["offWaitMs"]:.1f} ms | {p["onWaitMs"]:.1f} ms | {p["savedMs"]:.1f} ms |')
    if pairs:
        diffs=[p['savedMs'] for p in pairs];rng=random.Random(42);boot=sorted(statistics.mean(rng.choices(diffs,k=len(diffs))) for _ in range(10000));ci=[boot[249],boot[9749]]
        output['exploratoryPairedMeanSavedMs']=statistics.mean(diffs);output['exploratoryBootstrap95IntervalMs']=ci
        lines+=['',f'Mean paired waiting difference: {statistics.mean(diffs):.1f} ms; exploratory image-pair bootstrap 95% interval [{ci[0]:.1f}, {ci[1]:.1f}] ms. One pair per image and a small sample: this does not characterize production variance or establish general significance. Review intervals differ across images, but are matched within each pair.']
    on=[t for t in data['trials'] if t['mode']=='ON'];extraction_events=[e for t in on for e in t['requestLog'] if e['kind']=='prefetch' and e['result']=='started']
    lines+=['',f'Observed speculative starts: {len(extraction_events)}; actions: {sorted(set(e["action"] for e in extraction_events))}.', '', '## What is and is not established','','Real images and real model latency are tested here. Predictive accuracy on real users is not tested: these actions were authored. A fixed policy that always prefires extraction after receipt OCR may choose the same requests as the seeded Markov policy. If it does, these trials cannot establish an advantage over that baseline. Wrong-action and stop cases quantify wasted calls, not naturally observed prediction error rates. The correct-policy benefit cannot be extrapolated without real workflow traces.','','Failed trials, all provider calls and unused prefires remain in the benchmark report. No retries were used. Backend action waiting excludes transport/rendering and the deliberate review interval; client journey time is retained in raw results.']
    dest=Path(a.out);dest.mkdir(parents=True,exist_ok=True);(dest/'quality.json').write_text(json.dumps(output,indent=2)+'\n');(dest/'quality.md').write_text('\n'.join(lines)+'\n');print('\n'.join(lines))
if __name__=='__main__':main()
