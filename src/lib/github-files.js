import {treeOrder} from '../vendor/ghloc-web/tree-order.js';

export const MAX_SOURCE_BYTES=2*1024*1024;
const memory=new Map();
const encode=encodeURIComponent;
export const encodeFilePath=path=>path.split('/').map(encode).join('/');

export function fileError(response){
 if(response.status===403||response.status===429){
  const reset=Number(response.headers.get('x-ratelimit-reset'));
  return Error(reset?`请求额度已用尽，${new Date(reset*1000).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} 后重试`:'资源读取受限，请稍后重试');
 }
 return Error(response.status===404?'未找到该文件':`文件读取失败（${response.status}）`);
}
export function indexTree(data,repository,commit){
 if(data.repository!==repository||data.commit!==commit)throw Error('目录清单与文章版本不一致');
 if(!Array.isArray(data.entries))throw Error('目录清单无效');
 const directories=new Map([['',[]]]),seen=new Set();
 for(const entry of data.entries){
  if(typeof entry.path!=='string'||entry.path.split('/').some(part=>!part||part==='.'||part==='..')||!['tree','blob','commit'].includes(entry.type)||seen.has(entry.path))throw Error('目录清单无效');
  seen.add(entry.path);if(entry.type==='tree')directories.set(entry.path,[]);
 }
 for(const entry of data.entries){
  const slash=entry.path.lastIndexOf('/'),parent=slash<0?'':entry.path.slice(0,slash),children=directories.get(parent);
  if(!children)throw Error('目录清单缺少父目录');
  children.push({...entry,path:entry.path.slice(slash+1)});
 }
 for(const children of directories.values())children.sort(treeOrder);
 return directories;
}
export async function readRepositoryTree(url,repository,commit,{fetcher=fetch}={}){
 const key=url+':'+repository+':'+commit;
 if(memory.has(key))return memory.get(key);
 const pending=(async()=>{
  const response=await fetcher(url,{cache:'force-cache',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`目录清单读取失败（${response.status}）`);
  return indexTree(await response.json(),repository,commit);
 })();
 memory.set(key,pending);
 try{return await pending;}catch(error){memory.delete(key);throw error;}
}

// Adapted from ghloc-web's raw file loader and immutable cache.
const files=new Map();
export async function readFile(url,size,{fetcher=fetch}={}){
 if(size>MAX_SOURCE_BYTES)return {kind:'unsupported',message:'文件超过 2 MiB，请在网页查看'};
 if(files.has(url))return files.get(url);
 const pending=(async()=>{
  const response=await fetcher(url,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw fileError(response);
  const type=response.headers.get('content-type')||'';
  if(Number(response.headers.get('content-length'))>MAX_SOURCE_BYTES){await response.body?.cancel();return {kind:'unsupported',message:'文件超过 2 MiB，请在网页查看'};}
  // Read with a hard byte cap even when a server omits Content-Length.
  const reader=response.body.getReader(),chunks=[];let bytes=0;
  while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_SOURCE_BYTES){await reader.cancel();return {kind:'unsupported',message:'文件超过 2 MiB，请在网页查看'};}chunks.push(value);}
  const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
  if(type.startsWith('image/')&&!type.includes('svg'))return {kind:'image',blob:new Blob([buffer],{type})};
  if(buffer.subarray(0,8192).includes(0))return {kind:'unsupported',message:'二进制文件，请在网页查看'};
  try{return {kind:'text',text:new TextDecoder('utf-8',{fatal:true}).decode(buffer),contentType:type};}catch{return {kind:'unsupported',message:'此文件不是 UTF-8 文本，请在网页查看'};}
 })();
 files.set(url,pending);
 try{const result=await pending;while(files.size>12)files.delete(files.keys().next().value);return result;}catch(error){files.delete(url);throw error;}
}
