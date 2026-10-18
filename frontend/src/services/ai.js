const BASE = import.meta.env?.VITE_API_BASE ?? '';
let sessionId;
let pendingSession;

async function request(path, options={}) {
  const response=await fetch(`${BASE}/api/ai${path}`,{
    ...options,
    headers:{'Content-Type':'application/json',...(sessionId?{'X-AI-Session':sessionId}:{}),...options.headers},
  });
  const result=await response.json().catch(()=>({error:'Invalid backend response.'}));
  if(!response.ok)throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}
export async function getAISession(){
  if(sessionId)return request('/session');
  if(!pendingSession)pendingSession=request('/sessions',{method:'POST'}).then(result=>{sessionId=result.sessionId;return result;}).finally(()=>{pendingSession=null;});
  return pendingSession;
}
export async function setAIPrefetch(enabled){await getAISession();return request('/session',{method:'PATCH',body:JSON.stringify({enabled})});}
export async function uploadAIImage(file,type){
  await getAISession();
  if(file.size>5*1024*1024)throw new Error('Choose an image smaller than 5 MB.');
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Choose PNG, JPEG, or WebP.');
  const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read the image.'));reader.readAsDataURL(file);});
  const item=await request('/items',{method:'POST',body:JSON.stringify({name:file.name,type,image})});
  return {...item,preview:image};
}
export async function runAIAction(itemId,action){await getAISession();return request(`/items/${encodeURIComponent(itemId)}/actions/${encodeURIComponent(action)}`,{method:'POST',body:'{}'});}
export async function resetAIRun(){
  if(sessionId)await request('/session',{method:'DELETE'});
  sessionId=undefined;
  return getAISession();
}
export async function restartExpiredAIRun(){sessionId=undefined;pendingSession=undefined;return getAISession();}
