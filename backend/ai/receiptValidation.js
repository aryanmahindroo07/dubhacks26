// Evidence checks constrain what extraction may assert. They cannot prove that
// OCR faithfully represents the image or that a document is authentic.
const LABELS = {
  total: /\b(?:grand\s*total|total|amount\s+due|balance\s+due|jumlah\s+bayar)\b/i,
  subtotal: /\b(?:sub\s*total|subttl)\b/i,
  tax: /\b(?:tax|vat|ppn|pbi|pb[\s-]*1|gst)\b/i,
};
const normalize = text => String(text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
function amountToken(value) {
  if(typeof value !== 'string')return null;
  const match=normalize(value).match(/^(?:(?:Rp\.?|[A-Z]{3}|[$€£¥₹])\s*)?([-+]?\d+(?:[.,]\d+)*)(?:\s*(?:[A-Z]{3}|Rp\.?))?$/i);
  return match?.[1] ?? null;
}
function tokensIn(line) {
  line=line
    // "Qty 2" / "Qty: 2.00" are counts, never money.
    .replace(/\b(?:qty|quantity)\s*[:=]?\s*\d+(?:[.,]\d+)*/gi,'')
    // "Items 3" / "Items: 3" are counts only when the number is a whole number;
    // "ITEMS 13.20" keeps its amount.
    .replace(/\bitems?\s*[:=]?\s*\d+(?![.,]?\d)/gi,'')
    // "3 items" / "2 pcs"
    .replace(/\b\d+\s*(?:items?|pcs)\b/gi,'')
    .replace(/\bPB[-\s]?1\b/gi,'PB');
  return [...line.matchAll(/[-+]?\d+(?:[.,]\d+)*/g)].filter(m=>!/^\s*%/.test(line.slice(m.index+m[0].length))).map(m=>m[0]);
}
const isLabelLine=line=>Object.keys(LABELS).some(key=>matchesLabel(key,line));
// OCR often puts a right-aligned amount on the line after its label
// ("TOTAL" then "13.20"). Join such pairs so the amount stays tied to its label.
function withJoinedLines(lines) {
  const joined=[];
  lines.forEach((line,i)=>{
    const next=lines[i+1];
    if(next&&isLabelLine(line)&&tokensIn(line).length===0&&amountToken(next))joined.push(`${line} ${next}`);
  });
  return {all:[...lines,...joined],joined:new Set(joined)};
}
const ocrLines=text=>String(text||'').split(/\r?\n/).map(normalize).filter(Boolean);
function matchesLabel(name,line) {
  if(!LABELS[name].test(line))return false;
  return name!=='total'||!(/\b(?:sub\s*total|subttl|total\s+(?:items?|qty|quantity|tax|vat|ppn|disc(?:ount)?))\b/i.test(line));
}
function canonicalName(name) {
  const key=name.toLowerCase().replace(/[^a-z]/g,'');
  if(['total','totalamount','totalprice','totalsales','grandtotal','amountdue'].includes(key))return 'total';
  if(['subtotal','subtotalprice','subtotalamount','subttl'].includes(key))return 'subtotal';
  if(['tax','taxamount','taxprice','totaltax','vat','ppn','pbi','pb'].includes(key))return 'tax';
  return name.trim();
}
function validateReceiptFields(fields,text) {
  const lines=ocrLines(text);
  const {all:candidates,joined}=withJoinedLines(lines);
  const issues=[];
  const checked=fields.map(field=>{
    const name=canonicalName(field.name);const key=name.toLowerCase();const evidence=normalize(field.evidence);
    let reason;
    const fits=line=>!LABELS[key]||matchesLabel(key,line);
    const line=evidence&&([...joined].find(line=>line.includes(evidence)&&fits(line))||candidates.find(line=>line===evidence&&fits(line))||candidates.find(line=>line.includes(evidence)&&fits(line))||lines.find(line=>line===evidence));
    const notStated=field.value===null&&LABELS[key]&&key!=='total'&&!lines.some(line=>matchesLabel(key,line));
    if(notStated) {}
    else if(field.value===null)reason='Value was not readable or not stated in OCR.';
    else if(!line)reason='Supporting text does not match an OCR line.';
    else if(LABELS[key]) {
      const token=amountToken(field.value);
      if(!token)reason='Expected a printed amount, not a label or percentage.';
      else if(!matchesLabel(key,line))reason='OCR evidence does not identify this amount field.';
      else if(!tokensIn(evidence).includes(token)&&!(joined.has(line)&&tokensIn(line).includes(token)))reason='Amount is not present in the quoted OCR evidence.';
    } else if(!normalize(evidence).includes(normalize(field.value)))reason='Value is not present in the quoted OCR evidence.';
    if(reason)issues.push({field:name,reason});
    return {name,value:reason?null:field.value,evidence:line?field.evidence:'',reason,...(reason&&field.value!==null?{proposedValue:field.value}:{}),status:notStated?'not-stated':reason?'needs-review':'supported-by-ocr'};
  });
  for(const key of Object.keys(LABELS)) {
    const matching=checked.filter(f=>f.name.toLowerCase()===key);
    if(!matching.length&&(key==='total'||lines.some(line=>matchesLabel(key,line)))) {
      const reason='Expected amount was not extracted; review the image.';
      checked.push({name:key,value:null,evidence:'',status:'needs-review'});issues.push({field:key,reason});
    }
    const distinct=new Set(matching.filter(f=>f.value!==null).map(f=>amountToken(f.value)));
    if(distinct.size>1) {
      matching.forEach(f=>{f.value=null;f.status='needs-review';});
      issues.push({field:key,reason:'Conflicting extracted amounts; review the image.'});
    }
  }
  return {fields:checked,validation:{requiresReview:issues.length>0,issues,note:'Checked against OCR text only. Verify important amounts against the image.'}};
}
function hasReadableTotal(text) {
  return withJoinedLines(ocrLines(text)).all.some(line=>matchesLabel('total',line)&&tokensIn(line).length>0);
}
module.exports={validateReceiptFields,amountToken,hasReadableTotal};
