import {isRecord} from './data-types.js';
export interface FileBrowserState {expanded: string[]; suffix: string|null; file: string|null; lines: string|null}
export type BrowserStorage=Pick<Storage,'getItem'|'setItem'>;
export const fileBrowserStateKey=(repository: string,commit: string)=>`file-browser-v1:${repository}@${commit}`;
const browserStorage=()=>{try{return globalThis.localStorage;}catch{return undefined;}};
export function readFileBrowserState(key: string,storage: BrowserStorage|undefined=browserStorage()): FileBrowserState{
 const empty: FileBrowserState={expanded:[],suffix:null,file:null,lines:null};
 try{
  const data: unknown=JSON.parse(storage?.getItem(key)||'null');if(!isRecord(data))return empty;
  return {expanded:Array.isArray(data.expanded)?[...new Set(data.expanded.filter((path): path is string=>typeof path==='string'))]:[],suffix:typeof data.suffix==='string'?data.suffix:null,file:typeof data.file==='string'?data.file:null,lines:typeof data.lines==='string'?data.lines:null};
 }catch{return empty;}
}
export function saveFileBrowserState(key: string,state: {expanded: Iterable<string>; suffix?: string|null; file?: string|null; lines?: string|null},storage: BrowserStorage|undefined=browserStorage()){
 try{storage?.setItem(key,JSON.stringify({expanded:[...state.expanded],suffix:state.suffix||null,file:state.file||null,lines:state.lines||null}));}catch{}
}
