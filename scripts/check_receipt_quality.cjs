// Provider-backed quality check. Reference amounts are scored offline, never sent.
const fs=require('node:fs');const path=require('node:path');const {performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..');
try{require('node:process').loadEnvFile(path.join(root,'backend/.env'));}catch(e){if(e.code!=='ENOENT')throw e;}
const {createProviders}=require('../backend/ai/providers');
const arg=(name,fallback)=>{const i=process.argv.indexOf('--'+name);return i<0?fallback:process.argv[i+1];};
const manifests=process.argv.flatMap((a,i)=>a==='--manifest'?[path.resolve(process.argv[i+1])]:[]);
if(!manifests.length)throw new Error('Pass --manifest PATH at least once. This command makes real provider calls.');
const gap=Number(arg('gap-ms',8000));if(!Number.isFinite(gap)||gap<0)throw new Error('Use nonnegative --gap-ms.');
const out=path.resolve(arg('out','work/receipt-quality'));fs.mkdirSync(out,{recursive:true});
const cases=manifests.flatMap(m=>JSON.parse(fs.readFileSync(m)).samples.map(s=>({...s,imagePath:path.resolve(path.dirname(m),s.image)})));
(async()=>{
 const providers=createProviders();const rows=[];const metadata={createdAt:new Date().toISOString(),manifests:manifests.map(m=>path.relative(root,m)),gapMs:gap,providers:providers.status(),identity:providers.identity('EXTRACT_FIELDS'),method:'Sequential quality check; no prefetch, no retries. Reference answers remain local and are not provider inputs. Not an OFF/ON timing benchmark.'};
 for(const sample of cases){
  if(rows.length)await new Promise(r=>setTimeout(r,gap));
  const image='data:image/jpeg;base64,'+fs.readFileSync(sample.imagePath).toString('base64');const row={id:sample.id,expected:sample.expected};const start=performance.now();
  try{
   row.ocr=await providers.run('READ_TEXT',{image,type:'RECEIPT'});row.ocrMs=performance.now()-start;
   const next=performance.now();row.extraction=await providers.run('EXTRACT_FIELDS',{text:row.ocr.result.text,type:'RECEIPT'});row.extractionMs=performance.now()-next;
   console.log(sample.id,row.extraction.result.validation.requiresReview?'NEEDS REVIEW':'OCR evidence checks passed');
  }catch(e){row.error=e.message;console.log(sample.id,e.message);}
  rows.push(row);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({metadata,rows},null,2)+'\n');
  if(/rate limit|quota reached/i.test(row.error||'')){console.log('Stopped to avoid further quota errors.');break;}
 }
})();
