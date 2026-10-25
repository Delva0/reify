import {prepareWebDocument,webDocumentKey,webEmbeddingAllowed,webDocumentHtml,webDocumentHasContent} from '../lib/web-document.js';
import scrollbarStyle from '../../public/scrollbars.css?raw';

let index;const resources=new Map();
export async function readWebDocument(href){
 const url=webDocumentKey(href);
 if(!resources.has(url))resources.set(url,(async()=>{
  index??=fetch('/data/web-pages/index.json').then(response=>response.ok?response.json():null).catch(()=>null);
  const asset=(await index)?.pages?.[url];
  if(asset){const response=await fetch(asset);if(response.ok){const value=await response.json();if(value.version===1&&typeof value.html==='string')return value;}}
  try{
   const response=await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(10000)});
   if(!response.ok||!response.headers.get('content-type')?.includes('text/html')||!webEmbeddingAllowed(response.headers))return null;
   const document=await prepareWebDocument(await response.text(),response.url,{loadStyle:source=>fetch(source,{credentials:'omit',signal:AbortSignal.timeout(10000)}).then(response=>{if(!response.ok)throw Error('样式不可用');return response.text();})});
   return webDocumentHasContent(document.html)?document:null;
  }catch{return null;}
 })());
 return resources.get(url);
}

export function mountWebDocument(frame,resource,{href=resource.url,onLink}={}){
 const token=crypto.randomUUID(),nonce=crypto.randomUUID().replaceAll('-',''),url=new URL(href);
 const theme=()=>{const root=document.documentElement,style=getComputedStyle(root);return {dark:root.dataset.theme==='dark',paper:style.getPropertyValue('--paper').trim(),ink:style.getPropertyValue('--ink').trim(),scroll:style.getPropertyValue('--scroll-thumb').trim()};};
 let done,closed=false;const ready=new Promise(resolve=>{done=resolve;});
 const listener=event=>{
  if(event.source!==frame.contentWindow||event.data?.token!==token)return;
  if(event.data.type==='reify:web-link')try{const target=new URL(event.data.href);if(/^https?:$/.test(target.protocol))onLink?.(target.href);}catch{}
  if(event.data.type==='reify:web-ready'){frame.style.visibility='';done();}
  if(event.data.type==='reify:web-error'){frame.style.visibility='';done();}
 };
 addEventListener('message',listener);
 const observer=new MutationObserver(()=>frame.contentWindow?.postMessage({type:'reify:web-theme',token,theme:theme()},'*'));observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 frame.title=resource.title;frame.dataset.webDocument='';frame.style.visibility='hidden';frame.referrerPolicy='no-referrer';
 frame.setAttribute('sandbox','allow-scripts allow-popups allow-popups-to-escape-sandbox');
 frame.srcdoc=webDocumentHtml(resource,{token,nonce,theme:theme(),engine:new URL('/assets/darkreader/darkreader.js',location.href).href,anchor:url.hash.slice(1),scrollbars:scrollbarStyle});
 const dispose=()=>{if(closed)return;closed=true;observer.disconnect();removeEventListener('message',listener);frame.removeAttribute('srcdoc');done();};
 return {ready,dispose};
}
