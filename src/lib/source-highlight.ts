import type {HighlightRequest, HighlightResponse} from './data-types.js';
let worker: Worker | undefined,next=0;const jobs=new Map<number, {resolve: (html: string) => void; reject: (error: Error) => void}>();
export function highlightSource(text: string,language: string): Promise<string>{
 if(!worker){
  worker=new Worker(new URL('../workers/source-highlight.js',import.meta.url),{type:'module'});
  worker.onmessage=({data}: MessageEvent<HighlightResponse>)=>{const job=jobs.get(data.id);if(!job)return;if(data.html===undefined){for(const pending of jobs.values())pending.reject(Error('代码高亮加载失败'));jobs.clear();worker?.terminate();worker=undefined;}else{jobs.delete(data.id);job.resolve(data.html);}};
  worker.onerror=()=>{for(const job of jobs.values())job.reject(Error('代码高亮加载失败'));jobs.clear();worker?.terminate();worker=undefined;};
 }
 return new Promise<string>((resolve,reject)=>{const id=++next;jobs.set(id,{resolve,reject});worker!.postMessage({id,text,language} satisfies HighlightRequest);});
}
