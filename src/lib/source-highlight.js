let worker,next=0;const jobs=new Map();
export function highlightSource(text,language){
 if(!worker){
  worker=new Worker(new URL('../workers/source-highlight.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{const job=jobs.get(data.id);if(!job)return;if(data.error){for(const pending of jobs.values())pending.reject(Error('代码高亮加载失败'));jobs.clear();worker.terminate();worker=undefined;}else{jobs.delete(data.id);job.resolve(data.html);}};
  worker.onerror=()=>{for(const job of jobs.values())job.reject(Error('代码高亮加载失败'));jobs.clear();worker.terminate();worker=undefined;};
 }
 return new Promise((resolve,reject)=>{const id=++next;jobs.set(id,{resolve,reject});worker.postMessage({id,text,language});});
}
