import type {WebTheme} from './web-document-frame.js';
import darkreader from 'darkreader/package.json' with {type:'json'};
const revision='darkreader@'+darkreader.version+'/snapshot-1';
const limit=8,maxLength=2_000_000;
export async function webThemeKey(resource: {url: string; html: string},theme: Omit<WebTheme,'dark'>){
 const input=JSON.stringify([revision,resource.url,resource.html,theme.paper,theme.ink,theme.scroll]);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function createWebThemeCache(storage: Pick<CacheStorage,'open'> | undefined=globalThis.caches){
 const memory=new Map<string,string>();
 const remember=(key: string,html: string)=>{memory.delete(key);memory.set(key,html);while(memory.size>limit)memory.delete(memory.keys().next().value!);};
 const address=(key: string)=>new URL('/__reify/web-themes/'+key,globalThis.location?.origin||'https://reify.invalid').href;
 const open=()=>storage?.open('reify-web-themes-v1');
 return {
  async get(key: string){
   if(memory.has(key))return memory.get(key)!;
   try{const cache=await open(),response=await cache?.match(address(key));if(response){const html=await response.text();if(html.length<=maxLength){remember(key,html);return html;}}}catch{}
   return null;
  },
  async put(key: string,html: string){
   if(typeof html!=='string'||html.length>maxLength)return;
   remember(key,html);
   try{const cache=await open();if(!cache)return;await cache.delete(address(key));await cache.put(address(key),new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}}));const keys=await cache.keys();await Promise.all(keys.slice(0,-limit).map(key=>cache.delete(key)));}catch{}
  },
 };
}
