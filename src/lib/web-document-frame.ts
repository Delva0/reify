import type {bindNativeClose} from './native-close.js';
export interface WebTheme {dark: boolean; paper?: string; ink?: string; scroll?: string}
export interface WebDocumentBootstrapOptions {token: string; theme: WebTheme; anchor?: string; scrollbars?: string; cached?: boolean; externalLinks?: string[]}
interface ThemeEngine {setFetchMethod(fetcher: (url: string)=>Promise<Response>): void; enable(theme: {darkSchemeBackgroundColor?: string; darkSchemeTextColor?: string; scrollbarColor: string},fixes: {disableStyleSheetsProxy: boolean}): void}
declare const DarkReader: ThemeEngine | undefined;
// Executed inside the sandboxed preview, never in the blog document.
export function webDocumentBootstrap({token,theme,anchor,scrollbars='',cached=false,externalLinks=[]}: WebDocumentBootstrapOptions,bindClose?: typeof bindNativeClose){
 const send=(type: string,detail: Record<string,unknown>={})=>parent.postMessage({type,token,...detail},'*');
 const external=new Set(externalLinks);
 let currentTheme=theme,generated=cached,cacheTimer: ReturnType<typeof setTimeout> | undefined,checkpoint: ReturnType<typeof setTimeout> | undefined,closed=false,lastSnapshot: string | undefined;
 const themeStyles=()=>[...document.querySelectorAll<HTMLStyleElement>('style.darkreader:not([data-reify-theme-guard]):not([data-reify-scrollbars])')];
 const applyStyles=()=>{
  const styles=themeStyles();generated||=styles.some(style=>Boolean(style.sheet?.cssRules.length));
  for(const style of styles)style.disabled=!currentTheme.dark;
  if(generated||!currentTheme.dark)document.documentElement.removeAttribute('data-reify-pending');
 };
 const cacheSnapshot=async()=>{
  if(closed||!generated||!currentTheme.dark||cached)return;
  const state=currentTheme,clone=document.documentElement.cloneNode(true) as HTMLElement,live=[...document.querySelectorAll('style')],copies=[...clone.querySelectorAll<HTMLStyleElement>('style')];
  live.forEach((style,index)=>{if(style.classList.contains('darkreader'))try{copies[index].textContent=[...style.sheet!.cssRules].map(rule=>rule.cssText).join('\n');}catch{}});
  clone.querySelectorAll('script,meta[http-equiv="Content-Security-Policy"],[data-reify-theme-guard],[data-reify-scrollbars]').forEach(node=>node.remove());
  clone.querySelectorAll('[nonce]').forEach(node=>node.removeAttribute('nonce'));
  clone.removeAttribute('data-reify-pending');
  let html='<!doctype html>'+clone.outerHTML;
  const blobs=[...new Set(html.match(/\bblob:[^\s"'()<>;&]+/g)||[])];
  try{await Promise.all(blobs.map(async url=>{const response=await fetch(url),blob=await response.blob(),data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(Error('Invalid data URL'));reader.onerror=reject;reader.readAsDataURL(blob);});html=html.replaceAll(url,data);}));}catch{return;}
  if(closed||currentTheme!==state||!state.dark||html===lastSnapshot)return;
  lastSnapshot=html;send('reify:web-cache',{html,theme:state});
 };
 const scheduleCache=()=>{clearTimeout(cacheTimer);cacheTimer=setTimeout(()=>cacheSnapshot().catch(()=>{}),200);};
 const paint=(state: WebTheme)=>{
  const root=document.documentElement;
  root.dataset.reifyTheme=state.dark?'dark':'light';
  if(state.dark&&!generated)root.setAttribute('data-reify-pending','');
  for(const [name,value]of [['--scroll-thumb',state.scroll],['--reify-paper',state.paper],['--reify-ink',state.ink]] as const)if(value)root.style.setProperty(name,value);
  if(state.dark&&!generated&&typeof DarkReader!=='undefined')try{
   DarkReader.setFetchMethod(url=>fetch(url,{credentials:'omit'}));
   DarkReader.enable({darkSchemeBackgroundColor:state.paper,darkSchemeTextColor:state.ink,scrollbarColor:''},{disableStyleSheetsProxy:true});scheduleCache();
  }catch{send('reify:web-error');}
  applyStyles();
 };
 try{
  const closeRequests=bindClose?.(()=>send('reify:web-close'),{onPriority:pending=>send('reify:web-close-priority',{pending})});
  paint(currentTheme);
  document.querySelector('[data-reify-theme-engine]')?.addEventListener('load',()=>paint(currentTheme),{once:true});
  const style=document.createElement('style');style.textContent=scrollbars;style.className='darkreader';style.setAttribute('data-reify-scrollbars','');document.head.append(style);
  const observer=new MutationObserver(()=>{applyStyles();scheduleCache();});
  if(!cached)observer.observe(document.head,{childList:true,subtree:true,characterData:true});
  addEventListener('load',scheduleCache,{once:true});checkpoint=setTimeout(scheduleCache,1500);
  addEventListener('pagehide',()=>{closed=true;closeRequests?.dispose();clearTimeout(cacheTimer);clearTimeout(checkpoint);observer.disconnect();},{once:true});
  addEventListener('message',(event: MessageEvent<unknown>)=>{
   const data=event.data;if(!data||typeof data!=='object'||!('token'in data)||!('type'in data))return;
   if(event.source!==parent||data.token!==token)return;
   if(data.type==='reify:web-theme'){if(!('theme'in data)||!data.theme||typeof data.theme!=='object'||!('dark'in data.theme)||typeof data.theme.dark!=='boolean')return;const dark=data.theme.dark,next=data.theme;currentTheme={dark,paper:'paper'in next&&typeof next.paper==='string'?next.paper:undefined,ink:'ink'in next&&typeof next.ink==='string'?next.ink:undefined,scroll:'scroll'in next&&typeof next.scroll==='string'?next.scroll:undefined};paint(currentTheme);}
   if(data.type==='reify:web-close-priority')closeRequests?.setPriority('pending'in data&&data.pending===true);
  });
  document.addEventListener('click',event=>{
   const target=event.target,link=target&&'closest'in target&&typeof target.closest==='function'?(target as Element).closest<HTMLAnchorElement>('a[href]'):null;if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.hasAttribute('download'))return;
   const url=new URL(link.href);if(!/^https?:$/.test(url.protocol))return;
   const key=new URL(url);key.hash='';if(external.has(key.href))return;
   const base=new URL(document.baseURI);
   if(url.origin===base.origin&&url.pathname===base.pathname&&url.search===base.search&&url.hash){
    let id;try{id=decodeURIComponent(url.hash.slice(1));}catch{}const target=document.getElementById(id||'');if(target){event.preventDefault();target.scrollIntoView();return;}
   }
   event.preventDefault();send('reify:web-link',{href:url.href});
  });
  if(anchor){let id;try{id=decodeURIComponent(anchor);}catch{}document.getElementById(id||'')?.scrollIntoView();}
  send('reify:web-ready');
 }catch{send('reify:web-error');}
}
