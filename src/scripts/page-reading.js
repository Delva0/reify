import {canonicalArticlePath} from '../lib/article-pages.js';

const storageKey='reading-pages-v1';
const position=value=>value&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&value.x>=0&&value.y>=0?{x:value.x,y:value.y}:null;
const browserStorage=()=>{try{return globalThis.localStorage;}catch{return undefined;}};
export const pageReadingScope=(href,data={})=>JSON.stringify([data.repositoryName||data.repository||'',data.commit||data.version||'',canonicalArticlePath(new URL(href).pathname)]);

export function createPageReadingStore({storage=browserStorage(),limit=128,delay=250,schedule=setTimeout,cancel=clearTimeout}={}){
 const entries=new Map();let loaded=false,dirty=false,timer;
 const load=()=>{
  if(loaded)return;loaded=true;
  try{const value=JSON.parse(storage?.getItem(storageKey)||'null');if(value?.version===1&&Array.isArray(value.entries))for(const [scope,scroll]of value.entries.slice(-limit)){const valid=position(scroll);if(typeof scope==='string'&&valid)entries.set(scope,valid);}}catch{}
 };
 const flush=()=>{
  if(timer!==undefined){cancel(timer);timer=undefined;}if(!dirty)return;
  try{storage?.setItem(storageKey,JSON.stringify({version:1,entries:[...entries]}));dirty=false;}catch{}
 };
 return {
  read(scope){load();return position(entries.get(scope));},
  remember(scope,scroll){load();const valid=position(scroll);if(!valid)return;entries.delete(scope);entries.set(scope,valid);while(entries.size>limit)entries.delete(entries.keys().next().value);dirty=true;if(timer===undefined)timer=schedule(()=>{timer=undefined;flush();},delay);},
  flush,
 };
}

export function pageReadingTarget({url,scope,reason,state,stored}){
 if(url.hash&&!['reload','back_forward','popstate'].includes(reason))return null;
 const previous=state?.reifyNavigation;
 return (previous&&(!previous.scope||previous.scope===scope)&&position(previous.scroll))||position(stored);
}
