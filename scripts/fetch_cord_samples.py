"""Download the first six public CORD-v2 test images and reference annotations.
No AI calls. CC BY 4.0: NAVER CLOVA, CORD (Park et al., 2019).
"""
import hashlib,json,urllib.request,time,argparse
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'datasets/cord-test'
DATASET='naver-clova-ix/cord-v2'
REVISION='7f0115a4b758a71d6473b8d085751692da2fef98'
def get(url):
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url,timeout=45) as r:return r.read()
        except Exception:
            if attempt==2:raise
            time.sleep(1+attempt)
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--offset',type=int,default=0);ap.add_argument('--count',type=int,default=6);ap.add_argument('--out',default='datasets/cord-test');args=ap.parse_args()
    if args.offset<0 or not 1<=args.count<=10:raise ValueError('Use nonnegative offset and count 1–10.')
    dest=ROOT/args.out
    info=json.loads(get('https://huggingface.co/api/datasets/'+DATASET))
    if info['sha']!=REVISION:raise RuntimeError('Dataset revision changed; review before downloading.')
    rows=json.loads(get(f'https://datasets-server.huggingface.co/rows?dataset=naver-clova-ix%2Fcord-v2&config=default&split=test&offset={args.offset}&length={args.count}'))['rows']
    dest.mkdir(parents=True,exist_ok=True)
    samples=[]
    for entry in rows:
        idx=entry['row_idx'];row=entry['row'];src=row['image']['src']
        if REVISION not in src:raise RuntimeError('Image revision does not match pinned dataset.')
        data=get(src);name=f'test-{idx:03}.jpg';(dest/name).write_bytes(data)
        gt=json.loads(row['ground_truth']);(dest/f'test-{idx:03}.json').write_text(json.dumps(gt,indent=2,ensure_ascii=False)+'\n')
        parsed=gt['gt_parse'];expected={'total':parsed.get('total',{}).get('total_price'),'subtotal':parsed.get('sub_total',{}).get('subtotal_price'),'tax':parsed.get('sub_total',{}).get('tax_price')}
        samples.append({'id':f'cord-test-{idx:03}','image':name,'annotation':f'test-{idx:03}.json','sha256':hashlib.sha256(data).hexdigest(),'expected':{k:v for k,v in expected.items() if isinstance(v,str)}})
        print(name,len(data),'bytes')
    (dest/'manifest.json').write_text(json.dumps({'dataset':DATASET,'revision':REVISION,'source':'https://huggingface.co/datasets/'+DATASET,'license':'CC-BY-4.0','attribution':'NAVER CLOVA; Park et al., CORD: A Consolidated Receipt Dataset for Post-OCR Parsing, 2019','selection':f'Consecutive test rows {args.offset}–{args.offset+args.count-1}; selected before provider calls; not selected by outcome.','downloadedAt':datetime.now(timezone.utc).isoformat(),'samples':samples},indent=2)+'\n')
if __name__=='__main__':main()
