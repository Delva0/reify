import {encodeFilePath} from './github-files.js';
import {isWebFile,validateFileTarget} from './code-links.js';
import {sourceLanguage,languageLabel} from './code-language.js';
const decoded=value=>{try{return decodeURIComponent(value);}catch{return value;}};
export const serializeFileResources=resources=>JSON.stringify(resources).replace(/</g,'\\u003c');

export function fileResource(file,{repository,commit}={}){
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
export const fileResourceTitle=resource=>resource.title+' · '+languageLabel(resource.language);

export function createFileResourceCache(entries={}, {fetcher=fetch}={}){
 const pending=new Map();
 const read=url=>{
  const entry=entries[url];if(!entry)return Promise.resolve(null);
  if(pending.has(url))return pending.get(url);
  const request=(async()=>{
   if(!entry.asset)return entry;
   const response=await fetcher(entry.asset,{cache:'force-cache',priority:'low',signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error(`文件缓存读取失败（${response.status}）`);
   return entry.kind==='code'?{...entry,html:await response.text()}:{...entry,blob:new Blob([await response.arrayBuffer()],{type:entry.mime})};
  })().catch(error=>{pending.delete(url);throw error;});pending.set(url,request);return request;
 };
 return {read,entries,async warm(concurrency=3){const queue=Object.keys(entries);await Promise.all(Array.from({length:Math.min(concurrency,queue.length)},async()=>{while(queue.length)await read(queue.shift()).catch(()=>{});}));}};
}
