import {treeOrder} from '../vendor/ghloc-web/tree-order.js';
import {isRecord} from './data-types.js';
export interface FileTreeEntry {path: string; type: 'tree'|'blob'|'commit'; size?: number; lines?: number; sha?: string; url?: string}
export type RepositoryDirectories=Map<string,FileTreeEntry[]>;
export type FileReadResult={kind:'unsupported';message:string}|{kind:'image';blob:Blob}|{kind:'text';text:string;contentType:string};
export const MAX_SOURCE_BYTES=2*1024*1024;
const memory=new Map<string,Promise<RepositoryDirectories>>();
export const encodeFilePath=(path: string)=>path.split('/').map(encodeURIComponent).join('/');
export function fileError(response: Pick<Response,'status'|'headers'>){
 if(response.status===403||response.status===429){
  const reset=Number(response.headers.get('x-ratelimit-reset'));
  return Error(reset?`请求额度已用尽，${new Date(reset*1000).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} 后重试`:'资源读取受限，请稍后重试');
 }
 return Error(response.status===404?'未找到该文件':`文件读取失败（${response.status}）`);
}
export function indexTree(data: unknown,repository: string,commit: string): RepositoryDirectories{
 if(!isRecord(data)||data.repository!==repository||data.commit!==commit)throw Error('目录清单与文章版本不一致');
 if(!Array.isArray(data.entries))throw Error('目录清单无效');
 const directories: RepositoryDirectories=new Map([['',[]]]),seen=new Set<string>(),entries: FileTreeEntry[]=[];
 for(const value of data.entries){
  if(!isRecord(value)||typeof value.path!=='string'||value.path.split('/').some(part=>!part||part==='.'||part==='..')||(value.type!=='tree'&&value.type!=='blob'&&value.type!=='commit')||seen.has(value.path))throw Error('目录清单无效');
  const entry: FileTreeEntry={path:value.path,type:value.type};
  for(const key of ['size','lines'] as const)if(typeof value[key]==='number')entry[key]=value[key];
  for(const key of ['sha','url'] as const)if(typeof value[key]==='string')entry[key]=value[key];
  entries.push(entry);seen.add(entry.path);if(entry.type==='tree')directories.set(entry.path,[]);
 }
 for(const entry of entries){
  const slash=entry.path.lastIndexOf('/'),parent=slash<0?'':entry.path.slice(0,slash),children=directories.get(parent);
  if(!children)throw Error('目录清单缺少父目录');
  children.push({...entry,path:entry.path.slice(slash+1)});
 }
 for(const children of directories.values())children.sort(treeOrder);
 return directories;
}
export async function readRepositoryTree(url: string,repository: string,commit: string,{fetcher=fetch}: {fetcher?: typeof fetch}={}): Promise<RepositoryDirectories>{
 const key=url+':'+repository+':'+commit;
 const cached=memory.get(key);if(cached)return cached;
 const pending=(async()=>{
  const response=await fetcher(url,{cache:'force-cache',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`目录清单读取失败（${response.status}）`);
  return indexTree(await response.json() as unknown,repository,commit);
 })();
 memory.set(key,pending);
 try{return await pending;}catch(error){memory.delete(key);throw error;}
}
const files=new Map<string,Promise<FileReadResult>>();
export async function readFile(url: string,size=0,{fetcher=fetch}: {fetcher?: typeof fetch}={}): Promise<FileReadResult>{
 if(size>MAX_SOURCE_BYTES)return {kind:'unsupported',message:'文件超过 2 MiB，请在网页查看'};
 const cached=files.get(url);if(cached)return cached;
 const pending=(async(): Promise<FileReadResult>=>{
  const response=await fetcher(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw fileError(response);
  const type=response.headers.get('content-type')||'';
  if(Number(response.headers.get('content-length'))>MAX_SOURCE_BYTES){await response.body?.cancel();return {kind:'unsupported',message:'文件超过 2 MiB，请在网页查看'};}
  if(!response.body)throw Error('文件响应没有内容');
  const reader=response.body.getReader(),chunks: Uint8Array[]=[];let bytes=0;
  while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_SOURCE_BYTES){await reader.cancel();return {kind:'unsupported',message:'文件超过 2 MiB，请在网页查看'};}chunks.push(value);}
  const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
  if(type.startsWith('image/')&&!type.includes('svg'))return {kind:'image',blob:new Blob([buffer],{type})};
  if(buffer.subarray(0,8192).includes(0))return {kind:'unsupported',message:'二进制文件，请在网页查看'};
  try{return {kind:'text',text:new TextDecoder('utf-8',{fatal:true}).decode(buffer),contentType:type};}catch{return {kind:'unsupported',message:'此文件不是 UTF-8 文本，请在网页查看'};}
 })();
 files.set(url,pending);
 try{const result=await pending;while(files.size>12)files.delete(files.keys().next().value!);return result;}catch(error){files.delete(url);throw error;}
}
