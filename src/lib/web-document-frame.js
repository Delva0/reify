// Executed inside the sandboxed preview, never in the blog document.
export function webDocumentBootstrap({token,theme,anchor,scrollbars}){
 const send=(type,detail={})=>parent.postMessage({type,token,...detail},'*');
 const paint=state=>{
  const root=document.documentElement;
  root.dataset.reifyTheme=state.dark?'dark':'light';root.style.setProperty('--scroll-thumb',state.scroll);
  if(typeof DarkReader==='undefined')return;
  try{if(state.dark)DarkReader.enable({darkSchemeBackgroundColor:state.paper,darkSchemeTextColor:state.ink,scrollbarColor:''},{disableStyleSheetsProxy:true});else DarkReader.disable();}catch{send('reify:web-error');}
 };
 try{
  let currentTheme=theme;
  const initializeTheme=()=>{try{if(typeof DarkReader!=='undefined')DarkReader.setFetchMethod(url=>fetch(url,{credentials:'omit'}));paint(currentTheme);}catch{send('reify:web-error');}};
  initializeTheme();
  document.querySelector('[data-reify-theme-engine]')?.addEventListener('load',initializeTheme,{once:true});
  const style=document.createElement('style');style.textContent=scrollbars;document.head.append(style);
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
