import {isRecord} from '../lib/data-types.js';
type WebResource=Awaited<ReturnType<typeof prepareWebDocument>>;
import {prepareWebDocument,webDocumentKey,webEmbeddingAllowed,webDocumentHtml,webDocumentHasContent} from '../lib/web-document.js';
import scrollbarStyle from '../../public/scrollbars.css?raw';
import {createWebThemeCache,webThemeKey} from '../lib/web-theme-cache.js';
import {loadWebDocumentIndex,externalWebLinks} from './web-document-index.js';
import {requestFloatingClose,setFloatingClosePriority,watchFloatingClosePriority} from './floating-panels.js';

const resources=new Map<string,Promise<WebResource | null>>(),themes=createWebThemeCache();
export async function readWebDocument(href: string){
 const url=webDocumentKey(href);
 if(!resources.has(url))resources.set(url,(async()=>{
  const asset=(await loadWebDocumentIndex())?.pages?.[url];
  if(asset){const response=await fetch(asset);if(response.ok){const value: unknown=await response.json();if(isRecord(value)&&value.version===1&&typeof value.html==='string'&&typeof value.title==='string'&&typeof value.url==='string')return {version:1 as const,html:value.html,title:value.title,url:value.url};}}
  try{
   const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(10000)});
   if(!response.ok||!response.headers.get('content-type')?.includes('text/html')||!webEmbeddingAllowed(response.headers))return null;
   const document=await prepareWebDocument(await response.text(),response.url,{loadStyle:source=>fetch(source,{credentials:'omit',signal:AbortSignal.timeout(10000)}).then(response=>{if(!response.ok)throw Error('样式不可用');return response.text();})});
   return webDocumentHasContent(document.html)?document:null;
  }catch{return null;}
 })());
 return resources.get(url);
}

export function mountWebDocument(frame: HTMLIFrameElement,resource: WebResource,{href=resource.url,onLink}: {href?: string; onLink?: (href: string)=>void}={}){
 const token=crypto.randomUUID(),nonce=crypto.randomUUID().replaceAll('-',''),url=new URL(href);
 const theme=()=>{const root=document.documentElement,style=getComputedStyle(root);return {dark:root.dataset.theme==='dark',paper:style.getPropertyValue('--paper').trim(),ink:style.getPropertyValue('--ink').trim(),scroll:style.getPropertyValue('--scroll-thumb').trim()};};
 let done: ()=>void=()=>{},closed=false,pendingClose=false;const ready=new Promise<void>(resolve=>{done=resolve;});
 const sendClosePriority=()=>frame.contentWindow?.postMessage({type:'reify:web-close-priority',token,pending:pendingClose},'*');
 const unwatchClose=watchFloatingClosePriority(pending=>{pendingClose=pending;sendClosePriority();});
 const reveal=()=>{if(closed)return;frame.style.visibility='';clearTimeout(watchdog);done();};
 const watchdog=setTimeout(reveal,1500);
 const listener=(event: MessageEvent<unknown>)=>{
  if(!isRecord(event.data))return;
  if(event.source!==frame.contentWindow||event.data?.token!==token)return;
  if(event.data.type==='reify:web-close')requestFloatingClose(new Event('close'));
  if(event.data.type==='reify:web-close-priority'&&typeof event.data.pending==='boolean')setFloatingClosePriority(event.data.pending);
  if(event.data.type==='reify:web-link')try{const target=new URL(typeof event.data.href==='string'?event.data.href:'');if(/^https?:$/.test(target.protocol))onLink?.(target.href);}catch{}
  if(event.data.type==='reify:web-cache'&&typeof event.data.html==='string'&&isRecord(event.data.theme)){
   const html=event.data.html,palette=event.data.theme;
   webThemeKey(resource,{paper:typeof palette.paper==='string'?palette.paper:undefined,ink:typeof palette.ink==='string'?palette.ink:undefined,scroll:typeof palette.scroll==='string'?palette.scroll:undefined}).then(key=>themes.put(key,html));
  }
  if(event.data.type==='reify:web-ready'||event.data.type==='reify:web-error'){sendClosePriority();reveal();}
 };
 addEventListener('message',listener);
 frame.addEventListener('load',reveal);
 const observer=new MutationObserver(()=>frame.contentWindow?.postMessage({type:'reify:web-theme',token,theme:theme()},'*'));observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 frame.title=resource.title;frame.dataset.webDocument='';frame.referrerPolicy='no-referrer';
 frame.setAttribute('sandbox','allow-scripts allow-popups allow-popups-to-escape-sandbox');
 const render=async()=>{const state=theme();let snapshot: string | null | undefined;
  try{if(state.dark)snapshot=await themes.get(await webThemeKey(resource,state));}catch{}
  if(closed)return;const current=theme();if(!current.dark||(['paper','ink','scroll'] as const).some(key=>current[key]!==state[key]))snapshot=null;
  frame.srcdoc=webDocumentHtml(resource,{token,nonce,theme:current,engine:new URL('/assets/darkreader/darkreader.js',location.href).href,anchor:url.hash.slice(1),scrollbars:scrollbarStyle,snapshot,externalLinks:externalWebLinks()});
 };render();
 const dispose=()=>{if(closed)return;closed=true;unwatchClose();clearTimeout(watchdog);observer.disconnect();removeEventListener('message',listener);frame.removeEventListener('load',reveal);frame.removeAttribute('srcdoc');done();};
 return {ready,dispose};
}
