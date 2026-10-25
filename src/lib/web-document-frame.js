// Executed inside the sandboxed preview, never in the blog document.
export function webDocumentBootstrap({token,theme,anchor,scrollbars,cached=false}){
 const send=(type,detail={})=>parent.postMessage({type,token,...detail},'*');
 let currentTheme=theme,generated=cached,cacheTimer,checkpoint,closed=false,lastSnapshot;
 const themeStyles=()=>[...document.querySelectorAll('style.darkreader:not([data-reify-theme-guard]):not([data-reify-scrollbars])')];
 const applyStyles=()=>{
  const styles=themeStyles();generated||=styles.some(style=>style.sheet?.cssRules.length);
  for(const style of styles)style.disabled=!currentTheme.dark;
  if(generated||!currentTheme.dark)document.documentElement.removeAttribute('data-reify-pending');
 };
 const cacheSnapshot=async()=>{
  if(closed||!generated||!currentTheme.dark||cached)return;
  const state=currentTheme,clone=document.documentElement.cloneNode(true),live=[...document.querySelectorAll('style')],copies=[...clone.querySelectorAll('style')];
  live.forEach((style,index)=>{if(style.classList.contains('darkreader'))try{copies[index].textContent=[...style.sheet.cssRules].map(rule=>rule.cssText).join('\n');}catch{}});
  clone.querySelectorAll('script,meta[http-equiv="Content-Security-Policy"],[data-reify-theme-guard],[data-reify-scrollbars]').forEach(node=>node.remove());
  clone.querySelectorAll('[nonce]').forEach(node=>node.removeAttribute('nonce'));
  clone.removeAttribute('data-reify-pending');
  let html='<!doctype html>'+clone.outerHTML;
  const blobs=[...new Set(html.match(/\bblob:[^\s"'()<>;&]+/g)||[])];
  try{await Promise.all(blobs.map(async url=>{const response=await fetch(url),blob=await response.blob(),data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});html=html.replaceAll(url,data);}));}catch{return;}
  if(closed||currentTheme!==state||!state.dark||html===lastSnapshot)return;
  lastSnapshot=html;send('reify:web-cache',{html,theme:state});
 };
 const scheduleCache=()=>{clearTimeout(cacheTimer);cacheTimer=setTimeout(()=>cacheSnapshot().catch(()=>{}),200);};
 const paint=state=>{
  const root=document.documentElement;
  root.dataset.reifyTheme=state.dark?'dark':'light';
  if(state.dark&&!generated)root.setAttribute('data-reify-pending','');
  for(const [name,value]of [['--scroll-thumb',state.scroll],['--reify-paper',state.paper],['--reify-ink',state.ink]])if(value)root.style.setProperty(name,value);
  if(state.dark&&!generated&&typeof DarkReader!=='undefined')try{
   DarkReader.setFetchMethod(url=>fetch(url,{credentials:'omit'}));
   DarkReader.enable({darkSchemeBackgroundColor:state.paper,darkSchemeTextColor:state.ink,scrollbarColor:''},{disableStyleSheetsProxy:true});scheduleCache();
  }catch{send('reify:web-error');}
  applyStyles();
 };
 try{
  paint(currentTheme);
  document.querySelector('[data-reify-theme-engine]')?.addEventListener('load',()=>paint(currentTheme),{once:true});
  const style=document.createElement('style');style.textContent=scrollbars;style.className='darkreader';style.setAttribute('data-reify-scrollbars','');document.head.append(style);
  const observer=new MutationObserver(()=>{applyStyles();scheduleCache();});
  if(!cached)observer.observe(document.head,{childList:true,subtree:true,characterData:true});
  addEventListener('load',scheduleCache,{once:true});checkpoint=setTimeout(scheduleCache,1500);
  addEventListener('pagehide',()=>{closed=true;clearTimeout(cacheTimer);clearTimeout(checkpoint);observer.disconnect();},{once:true});
  addEventListener('message',event=>{if(event.source===parent&&event.data?.token===token&&event.data.type==='reify:web-theme'){currentTheme=event.data.theme;paint(currentTheme);}});
  document.addEventListener('click',event=>{
   const link=event.target.closest?.('a[href]');if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.hasAttribute('download'))return;
   const url=new URL(link.href);if(!/^https?:$/.test(url.protocol))return;
   const base=new URL(document.baseURI);
   if(url.origin===base.origin&&url.pathname===base.pathname&&url.search===base.search&&url.hash){
    let id;try{id=decodeURIComponent(url.hash.slice(1));}catch{}const target=document.getElementById(id);if(target){event.preventDefault();target.scrollIntoView();return;}
   }
   event.preventDefault();send('reify:web-link',{href:url.href});
  });
  if(anchor){let id;try{id=decodeURIComponent(anchor);}catch{}document.getElementById(id)?.scrollIntoView();}
  send('reify:web-ready');
 }catch{send('reify:web-error');}
}
