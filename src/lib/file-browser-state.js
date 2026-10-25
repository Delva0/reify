export const fileBrowserStateKey=(repository,commit)=>`file-browser-v1:${repository}@${commit}`;
const browserStorage=()=>{try{return globalThis.localStorage;}catch{return undefined;}};
export function readFileBrowserState(key,storage=browserStorage()){
 const empty={expanded:[],suffix:null,file:null,lines:null};
 try{
  const data=JSON.parse(storage?.getItem(key)||'null');if(!data||typeof data!=='object')return empty;
  return {expanded:Array.isArray(data.expanded)?[...new Set(data.expanded.filter(path=>typeof path==='string'))]:[],suffix:typeof data.suffix==='string'?data.suffix:null,file:typeof data.file==='string'?data.file:null,lines:typeof data.lines==='string'?data.lines:null};
 }catch{return empty;}
}
export function saveFileBrowserState(key,state,storage=browserStorage()){
 try{storage?.setItem(key,JSON.stringify({expanded:[...state.expanded],suffix:state.suffix||null,file:state.file||null,lines:state.lines||null}));}catch{}
}
