import type {DocumentOptions, RenderRequest, RenderResponse} from '../lib/data-types.js';
let worker: Worker | undefined,next=0;const pending=new Map<number, {resolve: (html: string) => void; reject: (error: Error) => void}>(),cache=new Map<string, Promise<string>>();
export async function renderFileDocument(source: string,options: DocumentOptions){
 const key=JSON.stringify(options)+'\0'+source;
 if(!cache.has(key)){
  if(!worker){
   worker=new Worker(new URL('../workers/document-render.js',import.meta.url),{type:'module'});
   const fail=(error: Error)=>{for(const job of pending.values())job.reject(error);pending.clear();worker?.terminate();worker=undefined;};
   worker.onmessage=({data}: MessageEvent<RenderResponse>)=>{const job=pending.get(data.job);if(!job)return;pending.delete(data.job);data.html===undefined?job.reject(Error(data.error)):job.resolve(data.html);};
   worker.onerror=()=>fail(Error('文档解析器未能加载，请使用源码视图'));
  }
  cache.set(key,new Promise<string>((resolve,reject)=>{const job=++next;pending.set(job,{resolve,reject});worker!.postMessage({job,source,options} satisfies RenderRequest);}).catch(error=>{cache.delete(key);throw error;}));
  if(cache.size>32)cache.delete(cache.keys().next().value!);
 }
 const html=await cache.get(key)!;return new DOMParser().parseFromString(html,'text/html').querySelector<HTMLElement>('[data-file-document]');
}
