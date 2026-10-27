import {canonicalArticlePath} from '../lib/article-pages.js';
import {isRecord} from '../lib/data-types.js';
interface PageScroll {x: number; y: number}
interface ReadingScope {repositoryName?: string; repository?: string; commit?: string; version?: string}
const storageKey='reading-pages-v1';
const position=(value: unknown): PageScroll | null=>isRecord(value)&&typeof value.x==='number'&&typeof value.y==='number'&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&value.x>=0&&value.y>=0?{x:value.x,y:value.y}:null;
const browserStorage=()=>{try{return globalThis.localStorage;}catch{return undefined;}};
export const pageReadingScope=(href: string,data: ReadingScope={})=>JSON.stringify([data.repositoryName||data.repository||'',data.commit||data.version||'',canonicalArticlePath(new URL(href).pathname)]);
export function createPageReadingStore({storage=browserStorage(),limit=128,delay=250,schedule=setTimeout,cancel=clearTimeout}: {storage?: Pick<Storage,'getItem'|'setItem'>; limit?: number; delay?: number; schedule?: typeof setTimeout; cancel?: typeof clearTimeout}={}){
 const entries=new Map<string,PageScroll>();let loaded=false,dirty=false,timer: ReturnType<typeof setTimeout> | undefined;
 const load=()=>{
  if(loaded)return;loaded=true;
  try{const value: unknown=JSON.parse(storage?.getItem(storageKey)||'null');if(isRecord(value)&&value.version===1&&Array.isArray(value.entries))for(const entry of value.entries.slice(-limit)){if(!Array.isArray(entry))continue;const [scope,scroll]=entry,valid=position(scroll);if(typeof scope==='string'&&valid)entries.set(scope,valid);}}catch{}
 };
 const flush=()=>{if(timer!==undefined){cancel(timer);timer=undefined;}if(!dirty)return;try{storage?.setItem(storageKey,JSON.stringify({version:1,entries:[...entries]}));dirty=false;}catch{}};
 return {
  read(scope: string){load();return position(entries.get(scope));},
  remember(scope: string,scroll: PageScroll){load();const valid=position(scroll);if(!valid)return;entries.delete(scope);entries.set(scope,valid);while(entries.size>limit){const oldest=entries.keys().next().value;if(oldest===undefined)break;entries.delete(oldest);}dirty=true;if(timer===undefined)timer=schedule(()=>{timer=undefined;flush();},delay);},
  flush,
 };
}
export function pageReadingTarget({url,scope,reason,state,stored}: {url: URL; scope: string; reason: string; state?: unknown; stored?: unknown}){
 if(url.hash&&!['reload','back_forward','popstate'].includes(reason))return null;
 const previous=isRecord(state)&&isRecord(state.reifyNavigation)?state.reifyNavigation:null;
 return (previous&&(!previous.scope||previous.scope===scope)&&position(previous.scroll))||position(stored);
}
