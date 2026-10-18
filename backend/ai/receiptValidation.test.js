const test=require('node:test');const assert=require('node:assert/strict');
const {validateReceiptFields,amountToken,hasReadableTotal}=require('./receiptValidation');
const {createProviders}=require('./providers');
const check=(fields,text)=>validateReceiptFields(fields,text);
test('accepts quoted printed amounts, preserving original punctuation',()=>{
 const r=check([{name:'TOTAL SALES',value:'Rp. 111,000',evidence:'TOTAL SALES 111,000'},{name:'tax',value:'10,091',evidence:'PBI (10%) 10,091'}],'PBI (10%) 10,091\nTOTAL SALES 111,000');
 assert.equal(r.validation.requiresReview,false);assert.equal(r.fields[0].name,'total');assert.equal(r.fields[0].value,'Rp. 111,000');
});
test('does not turn a tax percentage or a field label into an amount',()=>{
 const r=check([{name:'tax',value:'10%',evidence:'Tax (10%)'},{name:'total',value:'Total',evidence:'Total'}],'Tax (10%)\nTotal');
 assert.ok(r.fields.every(f=>f.value===null));assert.equal(r.validation.requiresReview,true);
 const percentAsNumber=check([{name:'tax',value:'10',evidence:'Tax 10% 4,545'},{name:'total',value:'50,000',evidence:'Total 50,000'}],'Tax 10% 4,545\nTotal 50,000');
 assert.equal(percentAsNumber.fields[0].value,null);
});
test('rejects invented evidence, invented numbers and coupon/item-count substitutions',()=>{
 for(const f of [
  {name:'total',value:'999',evidence:'Total 999'},
  {name:'total',value:'999',evidence:'Total 111,000'},
  {name:'total',value:'15',evidence:'Kupon 15'},
  {name:'total',value:'1',evidence:'Total Items 1'},
 ])assert.equal(check([f],'Kupon 15\nTotal Items 1\nTotal 111,000').fields[0].value,null);
});
test('missing amounts and conflicts stay unknown instead of being calculated',()=>{
 const missing=check([],'Subtotal\nTax (10%)\nTotal');
 assert.equal(missing.fields.length,3);assert.ok(missing.fields.every(f=>f.value===null));
 const conflicting=check([{name:'total',value:'10.00',evidence:'Total 10.00'},{name:'total',value:'12.00',evidence:'Total 12.00'}],'Total 10.00\nTotal 12.00');
 assert.ok(conflicting.fields.every(f=>f.value===null));assert.equal(conflicting.validation.requiresReview,true);
});
test('does not require tax when the document never states one; supports zero and signed amounts',()=>{
 assert.equal(check([{name:'total',value:'0',evidence:'Total 0'}],'Total 0').validation.requiresReview,false);
 assert.equal(amountToken('-1,234.50'),'-1,234.50');assert.equal(amountToken('10%'),null);
});
test('provider adapter returns reviewed unknowns when valid JSON contains unsupported receipt amounts',async()=>{
 const providers=createProviders({env:{GEMINI_API_KEY:'fake-test-only'},fetchImpl:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({fields:[{name:'total',value:'15',evidence:'Kupon 15'}]})}]}}]})})});
 const output=await providers.run('EXTRACT_FIELDS',{type:'RECEIPT',text:'Kupon 15\nTotal'});
 assert.equal(output.result.fields[0].value,null);assert.equal(output.result.validation.requiresReview,true);
});


test('total evidence is not confused with the same amount in subtotal',()=>{
 const r=check([{name:'subtotal',value:'11,000',evidence:'SUBTOTAL 11,000'},{name:'total',value:'11,000',evidence:'TOTAL 11,000'}],'SUBTOTAL 11,000\nTOTAL 11,000');
 assert.equal(r.validation.requiresReview,false);assert.equal(r.fields[1].value,'11,000');
});
test('optional unstated tax is not a failed or inferred amount',()=>{
 const r=check([{name:'total',value:'12.00',evidence:'Total 12.00'},{name:'tax',value:null,evidence:''}],'Total 12.00');
 assert.equal(r.validation.requiresReview,false);assert.equal(r.fields[1].status,'not-stated');
});


test('quantities and numeric tax labels are not monetary evidence',()=>{
 assert.equal(hasReadableTotal('TOTAL (Qty 2.00)'),false);
 assert.equal(hasReadableTotal('TOTAL (Qty 2.00) 60.000'),true);
 assert.equal(hasReadableTotal('Total Items 15'),false);
 const r=check([{name:'tax',value:'1',evidence:'PB1 (10%)'}],'PB1 (10%)\nTOTAL');
 assert.equal(r.fields[0].value,null);
});
