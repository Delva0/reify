import {validateFpState} from './fp-links.js';

export const fpSessionKey=(repository,commit,pathname)=>`floating-panels-v2:${repository}@${commit}:${pathname}`;

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
 return {version:2,entries:ordered};
}
