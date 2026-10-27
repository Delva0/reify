import {isRecord} from '../lib/data-types.js';
import type {ReadingContext} from '../lib/data-types.js';
interface SourceFile {path: string; text?: string; [key: string]: unknown}
interface SourceData {sha: string; files: SourceFile[]; index: Map<string,SourceFile>; [key: string]: unknown}
const snapshots=new Map<string,Promise<SourceData>>(),highlights=new Map<string,Promise<string>>();
const sourceUrl=(context?: ReadingContext)=>(context===undefined?document.body.dataset.sourceUrl:context.sourceUrl)||'/data/source-data.json';
function sourceData(value: unknown): SourceData{
 if(!isRecord(value)||typeof value.sha!=='string'||!Array.isArray(value.files))throw Error('Invalid source data');
 const files: SourceFile[]=value.files.map((entry: unknown)=>{if(!isRecord(entry)||typeof entry.path!=='string'||entry.text!==undefined&&typeof entry.text!=='string')throw Error('Invalid source data file');return {...entry,path:entry.path,text:entry.text};});
 return {...value,sha:value.sha,files,index:new Map(files.map(file=>[file.path,file]))};
}
export function loadSourceData(context?: ReadingContext): Promise<SourceData>{
 const url=sourceUrl(context);let pending=snapshots.get(url);
 if(!pending){pending=fetch(url).then(response=>{if(!response.ok)throw Error('Source data HTTP '+response.status);return response.json() as Promise<unknown>;}).then(sourceData).catch(error=>{snapshots.delete(url);throw error;});snapshots.set(url,pending);}return pending;
}
export async function bundledSource(file: string,context: ReadingContext=document.body.dataset){
 if(!context.sourceUrl)return null;const data=await loadSourceData(context);if(data.sha!==context.commit)return null;
 const source=data.index.get(file);if(typeof source?.text!=='string')return null;const key=data.sha+':'+file;
 if(!highlights.has(key))highlights.set(key,fetch('/data/highlight/'+encodeURIComponent(data.sha)+'/'+file.split('/').map(encodeURIComponent).join('/')+'.html').then(response=>{if(!response.ok)throw Error('Source highlight HTTP '+response.status);return response.text();}).catch(error=>{highlights.delete(key);throw error;}));
 const html=await highlights.get(key)!;const pre=new DOMParser().parseFromString(html,'text/html').querySelector('pre');if(!pre)throw Error('Invalid source highlight');pre.classList.add('astro-code');return pre;
}
export async function sourceText(file: string,context?: ReadingContext){return (await loadSourceData(context)).index.get(file)?.text;}
