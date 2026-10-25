const panels=new Map();let initialized=false,closeWatcher,nativeClosing=false,browserClosePending=false;
export const floatingLayer=panel=>panel?.dataset?.floatingLayer==='title'?Infinity:Number(panel?.dataset?.floatingLayer||0);
const visible=panel=>!panel.hidden&&(panel.tagName!=='DIALOG'||panel.open);
const ordered=()=>[...panels].reverse().filter(([panel])=>visible(panel)&&!panel.hasAttribute('data-floating-persistent')).sort(([a],[b])=>floatingLayer(b)-floatingLayer(a));
function syncCloseWatcher(){
 if(typeof CloseWatcher!=='function'||nativeClosing)return;
 if(browserClosePending||!ordered().length){closeWatcher?.destroy();closeWatcher=undefined;return;}
 if(closeWatcher)return;
 const watcher=closeWatcher=new CloseWatcher();
 watcher.addEventListener('close',event=>{
  if(closeWatcher!==watcher)return;
  closeWatcher=undefined;nativeClosing=true;
  try{ordered()[0]?.[1](event);}
  finally{queueMicrotask(()=>{nativeClosing=false;syncCloseWatcher();});}
 });
}
function initLayers(){
 if(initialized)return;initialized=true;
 document.addEventListener('pointerdown',event=>{
  const layer=floatingLayer(event.target instanceof Element?event.target.closest('[data-floating-layer]'):null);
  for(const [panel,close]of ordered())if(panel.dataset.floatingDismiss!=='explicit'&&floatingLayer(panel)>layer)close(event);
 },true);
 if(typeof CloseWatcher==='function')new MutationObserver(syncCloseWatcher).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','open','data-floating-persistent']});
 // Native find-bar state is not exposed. Keep its Escape unclaimed until keyup,
 // including after focus returns to a page panel while the find bar stays open.
 addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.isComposing||event.repeat)return;
  const key=event.key.toLowerCase(),find=!event.altKey&&(((event.ctrlKey||event.metaKey)&&(key==='g'||key==='f'&&!event.shiftKey))||key==='f3'&&!event.ctrlKey&&!event.metaKey);
  if(find){browserClosePending=true;syncCloseWatcher();return;}
  if(typeof CloseWatcher==='function'||event.key!=='Escape'||browserClosePending||document.hasFocus?.()===false)return;
  const top=ordered()[0];if(top){top[1](event);event.preventDefault();event.stopPropagation();}
 });
 addEventListener('keyup',event=>{
  if(event.key!=='Escape'||event.isComposing||!browserClosePending)return;
  browserClosePending=false;syncCloseWatcher();
 });
}
export function registerFloatingPanel(panel,close){panels.set(panel,close);initLayers();syncCloseWatcher();}
export function unregisterFloatingPanel(panel){panels.delete(panel);syncCloseWatcher();}
export function raiseFloatingPanel(panel){const close=panels.get(panel);if(close){panels.delete(panel);panels.set(panel,close);}}
export function initFloatingPanels(){initLayers();}
