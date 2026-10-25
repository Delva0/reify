let worker,next=0;const pending=new Map(),cache=new Map();
export async function renderFileDocument(source,options){
 const key=JSON.stringify(options)+'\0'+source;
 if(!cache.has(key)){
  if(!worker){
   worker=new Worker(new URL('../workers/document-render.js',import.meta.url),{type:'module'});
   const fail=error=>{for(const job of pending.values())job.reject(error);pending.clear();worker.terminate();worker=undefined;};
   worker.onmessage=({data})=>{const job=pending.get(data.job);if(!job)return;pending.delete(data.job);data.error?job.reject(Error(data.error)):job.resolve(data.html);};
   worker.onerror=()=>fail(Error('文档解析器未能加载，请使用源码视图'));
  }
  cache.set(key,new Promise((resolve,reject)=>{const job=++next;pending.set(job,{resolve,reject});worker.postMessage({job,source,options});}).catch(error=>{cache.delete(key);throw error;}));
  if(cache.size>32)cache.delete(cache.keys().next().value);
 }
 const html=await cache.get(key);return new DOMParser().parseFromString(html,'text/html').querySelector('[data-file-document]');
}
