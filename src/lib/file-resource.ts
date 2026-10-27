import {encodeFilePath} from './github-files.js';
import {isWebFile,validateFileTarget} from './code-links.js';
import {sourceLanguage,languageLabel} from './code-language.js';
export type ResourceEntry = {asset?: string} & (
 | {kind: 'code'; language: string; html?: string}
 | {kind: 'image'; mime: string; blob?: Blob}
 | {kind: 'unsupported'; message: string}
);
export type LoadedResource = {kind: 'code'; language: string; html: string} | {kind: 'image'; mime: string; blob: Blob} | {kind: 'unsupported'; message: string};
export type ResourceIndex = Record<string, ResourceEntry>;
const decoded=(value: string)=>{try{return decodeURIComponent(value);}catch{return value;}};
export const serializeFileResources=(resources: ResourceIndex)=>JSON.stringify(resources).replace(/</g,'\\u003c');

export function fileResource(file: string,{repository,commit}: {repository?: string; commit?: string}={}){
 file=validateFileTarget(file);
 if(!isWebFile(file))return {url:`https://raw.githubusercontent.com/${repository}/${commit}/${encodeFilePath(file)}`,href:`https://github.com/${repository}/blob/${commit}/${encodeFilePath(file)}`,path:file,title:file,language:sourceLanguage(file)};
 const original=new URL(file),url=new URL(original);url.hash='';
 let title=decoded(url.host+url.pathname),path=url.pathname;
 const github=url.hostname==='github.com'&&url.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
 const raw=url.hostname==='raw.githubusercontent.com'&&url.pathname.match(/^\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
 if(github){url.hostname='raw.githubusercontent.com';url.pathname=`/${github[1]}/${github[2]}/${github[3]}/${github[4]}`;path=github[4];title=decoded(`${github[1]}/${github[2]}/${path}`);}
 else if(raw){path=raw[4];title=decoded(`${raw[1]}/${raw[2]}/${path}`);}
 return {url:url.href,href:original.href,path,title,language:sourceLanguage(path)};
}
export const fileResourceTitle=(resource: ReturnType<typeof fileResource>)=>resource.title+' · '+languageLabel(resource.language);

export function createFileResourceCache(entries: ResourceIndex={}, {fetcher=fetch}: {fetcher?: typeof fetch}={}){
 const pending=new Map<string, Promise<LoadedResource>>();
 const read=(url: string): Promise<LoadedResource | null>=>{
  const entry=entries[url];if(!entry)return Promise.resolve(null);
  if(pending.has(url))return pending.get(url)!;
  const request=(async(): Promise<LoadedResource>=>{
   if(!entry.asset){
    if(entry.kind==='unsupported')return entry;
    if(entry.kind==='code'&&typeof entry.html==='string')return {...entry,html:entry.html};
    if(entry.kind==='image'&&entry.blob instanceof Blob)return {...entry,blob:entry.blob};
    throw Error('文件缓存内容无效');
   }
   const response=await fetcher(entry.asset,{cache:'force-cache',priority:'low',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error(`文件缓存读取失败（${response.status}）`);
   if(entry.kind==='code')return {...entry,html:await response.text()};
   if(entry.kind==='image')return {...entry,blob:new Blob([await response.arrayBuffer()],{type:entry.mime})};
   return entry;
  })().catch(error=>{pending.delete(url);throw error;});pending.set(url,request);return request;
 };
 return {read,entries,async warm(concurrency=3){const queue=Object.keys(entries);await Promise.all(Array.from({length:Math.min(concurrency,queue.length)},async()=>{while(queue.length)await read(queue.shift()!).catch(()=>{});}));}};
}
