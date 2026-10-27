import {createFileResourceCache} from '../lib/file-resource.js';
import type {ResourceIndex} from '../lib/file-resource.js';
import {isRecord} from '../lib/data-types.js';
function resourceIndex(value: unknown): ResourceIndex{
 const result: ResourceIndex={};if(!isRecord(value))return result;
 for(const [url,entry]of Object.entries(value)){
  if(!isRecord(entry)||entry.asset!==undefined&&typeof entry.asset!=='string')continue;
  const asset=entry.asset;
  if(entry.kind==='code'&&typeof entry.language==='string'&&(entry.html===undefined||typeof entry.html==='string'))result[url]={kind:'code',language:entry.language,html:entry.html,asset};
  else if(entry.kind==='image'&&typeof entry.mime==='string')result[url]={kind:'image',mime:entry.mime,asset};
  else if(entry.kind==='unsupported'&&typeof entry.message==='string')result[url]={kind:'unsupported',message:entry.message,asset};
 }return result;
}
const articleEntries=()=>resourceIndex(JSON.parse(document.querySelector('#file-resources')?.textContent||'{}'));
const entries=articleEntries(),cache=createFileResourceCache(entries);let index: Promise<unknown> | undefined;
export function refreshArticleResources(){Object.assign(entries,articleEntries());}
export async function cachedFileResource(url: string){
 if(!entries[url]){index||=fetch('/data/file-cache/index.json').then(response=>response.ok?response.json() as Promise<unknown>:{}).then(data=>Object.assign(entries,resourceIndex(data))).catch(()=>{index=undefined;});await index;}
 return cache.read(url);
}
export function warmArticleResources(){
 const warm=()=>cache.warm();if('requestIdleCallback'in window)requestIdleCallback(warm,{timeout:1500});else setTimeout(warm,0);
}
