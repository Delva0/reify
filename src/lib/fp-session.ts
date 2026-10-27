import type {FpState,FpSession,PanelSnapshot,SessionEntry,ReadingEntry,PanelBox,DocumentState} from './data-types.js';
import {isRecord} from './data-types.js';
import {normalizeCodeBlock} from './code-block.js';
import {validateFpState,fpHref} from './fp-links.js';

export const fpSessionKey=(repository: string | undefined,commit: string | undefined,pathname: string)=>`floating-panels-v2:${repository}@${commit}:${pathname}`;
export const fpReadingLimit=48;
export function readingSnapshot(snapshot: PanelSnapshot | null | undefined){
 if(!snapshot||typeof snapshot!=='object')return null;
 const state: PanelSnapshot={};for(const name of ['wrap','documentWrap','documentMode','documents','scroll'] as const)if(snapshot[name]!==undefined)Object.assign(state,{[name]:snapshot[name]});
 return Object.keys(state).length?state:null;
}
export function rememberFpReading(cache: Map<string, ReadingEntry>,state: FpState,snapshot: PanelSnapshot | null | undefined){
 const reading=readingSnapshot(snapshot);if(!reading)return;
 const key=fpHref([state]);cache.delete(key);cache.set(key,{state,snapshot:reading});while(cache.size>fpReadingLimit)cache.delete(cache.keys().next().value!);
}
export function rememberFpInstance(cache: Map<string, SessionEntry>,entry: Omit<SessionEntry, "snapshot">,snapshot: PanelSnapshot | undefined){
 if(!entry?.id)return;
 const previous=cache.get(entry.id);
 cache.delete(entry.id);cache.set(entry.id,{id:entry.id,state:entry.state,modal:entry.modal,parentId:entry.parentId||null,snapshot:{...previous?.snapshot,...snapshot}});
 while(cache.size>fpReadingLimit)cache.delete(cache.keys().next().value!);
}

export function validateFpSession(value: unknown): FpSession{
 if(!isRecord(value)||value.version!==2||!Array.isArray(value.entries))throw Error('FP 会话无效');
 const states=validateFpState(value.entries.map((entry: unknown)=>isRecord(entry)?entry.state:undefined));
 const ids=new Set<string>();
 const entries: SessionEntry[]=value.entries.map((entry: unknown,index)=>{
  if(!isRecord(entry)||typeof entry.id!=='string'||!entry.id||entry.id.length>128||ids.has(entry.id)||typeof entry.modal!=='boolean')throw Error('FP 会话标识无效');
  ids.add(entry.id);
  if(entry.parentId!==null&&entry.parentId!==undefined&&typeof entry.parentId!=='string')throw Error('FP 父级标识无效');
  if(entry.snapshot!==undefined&&(!entry.snapshot||typeof entry.snapshot!=='object'||Array.isArray(entry.snapshot)))throw Error('FP 快照无效');
  return {id:entry.id,state:states[index],modal:entry.modal,parentId:entry.parentId||null,snapshot:parsePanelSnapshot(entry.snapshot||{})};
 });
 const pending=new Map(entries.map(entry=>[entry.id,entry])),ordered: SessionEntry[]=[];
 for(const entry of entries)if(!entry.parentId||!ids.has(entry.parentId))entry.parentId=null;
 while(pending.size){
  let advanced=false;
  for(const [id,entry]of pending)if(!entry.parentId||!pending.has(entry.parentId)){ordered.push(entry);pending.delete(id);advanced=true;}
  if(!advanced)throw Error('FP 父级关系包含循环');
 }
 const readings: ReadingEntry[]=[];
 if(Array.isArray(value.readings))for(const record of value.readings.slice(-fpReadingLimit))try{
  if(!isRecord(record))continue;const [state]=validateFpState([record.state]);const snapshot=readingSnapshot(parsePanelSnapshot(record.snapshot));if(snapshot)readings.push({state,snapshot});
 }catch{}
 const archive: SessionEntry[]=[];
 if(Array.isArray(value.archive))for(const entry of value.archive.slice(-fpReadingLimit))try{
  if(!isRecord(entry))continue;const [state]=validateFpState([entry.state]);
  if(!isRecord(entry)||typeof entry.id!=='string'||!entry.id||entry.id.length>128||typeof entry.modal!=='boolean'||(entry.parentId!=null&&typeof entry.parentId!=='string')||!entry.snapshot||typeof entry.snapshot!=='object'||Array.isArray(entry.snapshot))continue;
  archive.push({id:entry.id,state,modal:entry.modal,parentId:entry.parentId||null,snapshot:parsePanelSnapshot(entry.snapshot)});
 }catch{}
 return {version:2,entries:ordered,readings,archive};
}

export function parsePanelSnapshot(value: unknown): PanelSnapshot {
 if(!isRecord(value))throw Error('FP 快照无效');
 const result: PanelSnapshot={};
 const known=new Set(['modal','wrap','documentWrap','documentMode','box','lastNonModalBox','lastExpandedHeight','scroll','documents','resourceContext','definition']);
 for(const [key,entry]of Object.entries(value))if(!known.has(key))result[key]=entry;
 for(const key of ['modal','wrap','documentWrap'] as const)if(typeof value[key]==='boolean')result[key]=value[key];
 if(typeof value.documentMode==='string')result.documentMode=value.documentMode;
 const box=(raw: unknown): raw is PanelBox=>isRecord(raw)&&['left','top','width','height'].every(key=>typeof raw[key]==='number'&&Number.isFinite(raw[key]))&&Number(raw.width)>0&&Number(raw.height)>0;
 for(const key of ['box','lastNonModalBox'] as const)if(box(value[key]))result[key]=value[key];
 if(typeof value.lastExpandedHeight==='number'&&Number.isFinite(value.lastExpandedHeight))result.lastExpandedHeight=value.lastExpandedHeight;
 if(Array.isArray(value.scroll))result.scroll=value.scroll.filter((item: unknown): item is {top: number; left: number}=>isRecord(item)&&typeof item.top==='number'&&Number.isFinite(item.top)&&typeof item.left==='number'&&Number.isFinite(item.left));
 if(Array.isArray(value.documents))result.documents=value.documents.map((item: unknown)=>{
  if(!isRecord(item)||typeof item.page!=='number'||!Number.isInteger(item.page)||typeof item.top!=='number'||typeof item.left!=='number'||!Array.isArray(item.scroll))return undefined;
  const scroll: [number,number][]=item.scroll.filter((pair: unknown): pair is [number,number]=>Array.isArray(pair)&&pair.length===2&&pair.every(value=>typeof value==='number'&&Number.isFinite(value)));
  return {page:item.page,top:item.top,left:item.left,scroll} satisfies DocumentState;
 });
 if(isRecord(value.resourceContext))result.resourceContext=Object.fromEntries(Object.entries(value.resourceContext).filter((entry): entry is [string,string]=>typeof entry[1]==='string'));
 if(isRecord(value.definition))result.definition=normalizeCodeBlock({...value.definition,lines:value.definition.ranges||[]});
 return result;
}
