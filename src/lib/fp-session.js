import {validateFpState,fpHref} from './fp-links.js';

export const fpSessionKey=(repository,commit,pathname)=>`floating-panels-v2:${repository}@${commit}:${pathname}`;
export const fpReadingLimit=48;
export function readingSnapshot(snapshot){
 if(!snapshot||typeof snapshot!=='object')return null;
 const state={};for(const name of ['wrap','documentWrap','documentMode','documents','scroll'])if(snapshot[name]!==undefined)state[name]=snapshot[name];
 return Object.keys(state).length?state:null;
}
export function rememberFpReading(cache,state,snapshot){
 const reading=readingSnapshot(snapshot);if(!reading)return;
 const key=fpHref([state]);cache.delete(key);cache.set(key,{state,snapshot:reading});while(cache.size>fpReadingLimit)cache.delete(cache.keys().next().value);
}
export function rememberFpInstance(cache,entry,snapshot){
 if(!entry?.id)return;
 const previous=cache.get(entry.id);
 cache.delete(entry.id);cache.set(entry.id,{id:entry.id,state:entry.state,modal:entry.modal,parentId:entry.parentId||null,snapshot:{...previous?.snapshot,...snapshot}});
 while(cache.size>fpReadingLimit)cache.delete(cache.keys().next().value);
}

export function validateFpSession(value){
 if(!value||value.version!==2||!Array.isArray(value.entries))throw Error('FP 会话无效');
 validateFpState(value.entries.map(entry=>entry?.state));
 const ids=new Set();
 const entries=value.entries.map(entry=>{
  if(typeof entry.id!=='string'||!entry.id||entry.id.length>128||ids.has(entry.id)||typeof entry.modal!=='boolean')throw Error('FP 会话标识无效');
  ids.add(entry.id);
  if(entry.parentId!==null&&entry.parentId!==undefined&&typeof entry.parentId!=='string')throw Error('FP 父级标识无效');
  if(entry.snapshot!==undefined&&(!entry.snapshot||typeof entry.snapshot!=='object'||Array.isArray(entry.snapshot)))throw Error('FP 快照无效');
  return {id:entry.id,state:entry.state,modal:entry.modal,parentId:entry.parentId||null,snapshot:entry.snapshot||{}};
 });
 const pending=new Map(entries.map(entry=>[entry.id,entry])),ordered=[];
 for(const entry of entries)if(!ids.has(entry.parentId))entry.parentId=null;
 while(pending.size){
  let advanced=false;
  for(const [id,entry]of pending)if(!entry.parentId||!pending.has(entry.parentId)){ordered.push(entry);pending.delete(id);advanced=true;}
  if(!advanced)throw Error('FP 父级关系包含循环');
 }
 const readings=[];
 if(Array.isArray(value.readings))for(const record of value.readings.slice(-fpReadingLimit))try{
  validateFpState([record?.state]);const snapshot=readingSnapshot(record.snapshot);if(snapshot)readings.push({state:record.state,snapshot});
 }catch{}
 const archive=[];
 if(Array.isArray(value.archive))for(const entry of value.archive.slice(-fpReadingLimit))try{
  validateFpState([entry?.state]);
  if(typeof entry.id!=='string'||!entry.id||entry.id.length>128||typeof entry.modal!=='boolean'||(entry.parentId!=null&&typeof entry.parentId!=='string')||!entry.snapshot||typeof entry.snapshot!=='object'||Array.isArray(entry.snapshot))continue;
  archive.push({id:entry.id,state:entry.state,modal:entry.modal,parentId:entry.parentId||null,snapshot:entry.snapshot});
 }catch{}
 return {version:2,entries:ordered,readings,archive};
}
