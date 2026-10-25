const panels=new Map(),background=new Map();let initialized=false,closeWatcher,nativeClosing=false,browserClosePending=false,sequence=0;
const editorLayer=2147483000,titleLayer=2147483647;
export const floatingLayer=panel=>panel?.dataset?.floatingLayer==='title'?Infinity:panel?.dataset?.floatingLayer==='editor'?editorLayer:Number(panel?.dataset?.floatingLayer||0);
export const floatingParent=panel=>panels.get(panel)?.parent||null;
const parentLabel=(panel,parent)=>{panel.dataset.floatingParent=parent?.dataset?.fpSessionId||parent?.id||'';};
const visible=panel=>panel.isConnected!==false&&!panel.hidden&&(panel.tagName!=='DIALOG'||panel.open);
const ordered=()=>[...panels].reverse().filter(([panel])=>visible(panel)&&!panel.hasAttribute?.('data-floating-persistent')).sort(([a],[b])=>floatingLayer(b)-floatingLayer(a)).map(([panel,record])=>[panel,record.close]);
function syncLayers(){
 const normal=[...panels].filter(([,record])=>!record.priority),ordered=[],visited=new Set();
 const visit=entry=>{const [panel]=entry;if(visited.has(panel))return;visited.add(panel);ordered.push(entry);for(const child of normal.filter(([,record])=>record.parent===panel).sort((a,b)=>a[1].order-b[1].order))visit(child);};
 for(const entry of normal.filter(([,record])=>!normal.some(([panel])=>panel===record.parent)).sort((a,b)=>a[1].order-b[1].order))visit(entry);
 for(const entry of normal)visit(entry);
 ordered.forEach(([panel],index)=>{panel.dataset.floatingLayer=String(10+index*2);if(panel.style)panel.style.zIndex=panel.dataset.floatingLayer;});
 for(const [panel,record]of panels){
  if(record.priority){panel.dataset.floatingLayer=record.priority;if(panel.style)panel.style.zIndex=String(record.priority==='title'?titleLayer:editorLayer);}
  const active=record.modal&&visible(panel);
  if(active&&!record.backdrop&&document.createElement&&document.body?.append){
   const backdrop=record.backdrop=document.createElement('div');backdrop.className='floating-backdrop';backdrop.setAttribute('aria-hidden','true');
   backdrop.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;if(record.onBackdrop)record.onBackdrop();else setFloatingModal(panel,false);});
   document.body.append(backdrop);
  }
  if(record.backdrop){const hidden=!active;if(record.backdrop.hidden!==hidden)record.backdrop.hidden=hidden;record.backdrop.dataset.floatingLayer=String(floatingLayer(panel)-1);record.backdrop.style.zIndex=String(floatingLayer(panel)-1);}
 }
 const modal=[...panels].filter(([panel,record])=>record.modal&&visible(panel)).sort(([a],[b])=>floatingLayer(b)-floatingLayer(a))[0]?.[0],barrier=modal?floatingLayer(modal):0;
 document.documentElement?.classList?.toggle('floating-modal-active',Boolean(modal));
 const affected=[...(document.querySelectorAll?.('main,.repo-tree,.github-files')||[]),...panels.keys()];
 for(const node of affected){const blocked=Boolean(modal)&&floatingLayer(node)<barrier;if(blocked){if(!background.has(node))background.set(node,node.inert);node.inert=true;}else if(background.has(node)){node.inert=background.get(node);background.delete(node);}}
 syncCloseWatcher();
}
export function setFloatingParent(panel,origin){
 const record=panels.get(panel);if(!record)return;
 const element=origin?.nodeType===3?origin.parentElement:origin,parent=panels.has(element)?element:element?.closest?.('[data-floating-panel]');
 for(let ancestor=parent;ancestor;ancestor=panels.get(ancestor)?.parent)if(ancestor===panel)return;
 const changed=record.parent!==(parent||null);record.parent=parent||null;parentLabel(panel,parent);syncLayers();if(changed)record.onChange?.();
}
export function setFloatingModal(panel,modal){
 const record=panels.get(panel);if(!record)return;
 const changed=record.modal!==Boolean(modal);record.modal=Boolean(modal);if(panel.dataset.modal!==String(record.modal))panel.dataset.modal=String(record.modal);panel.setAttribute?.('aria-modal',String(record.modal));syncLayers();if(changed)record.onChange?.();
}
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
 const focus=event=>{
  const layer=floatingLayer(event.target instanceof Element?event.target.closest('[data-floating-layer]'):null);
  for(const [panel,close]of ordered())if(panel.dataset.floatingDismiss!=='explicit'&&floatingLayer(panel)>layer)close(event);
  const panel=event.target instanceof Element?event.target.closest('[data-floating-panel]'):null;if(panels.has(panel))raiseFloatingPanel(panel);
 };
 document.addEventListener('pointerdown',focus,true);document.addEventListener('focusin',focus,true);
 if(typeof MutationObserver==='function'&&document.body)new MutationObserver(syncLayers).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','open','data-floating-persistent']});
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
export function registerFloatingPanel(panel,close,{parent,priority,onBackdrop,onChange}={}){if(priority!==undefined&&!['title','editor'].includes(priority))throw Error('Unknown floating priority: '+priority);panels.set(panel,{close,parent:null,priority:priority||(['title','editor'].includes(panel.dataset?.floatingLayer)?panel.dataset.floatingLayer:null),modal:panel.dataset?.modal==='true',onBackdrop,onChange,order:++sequence});initLayers();if(parent)setFloatingParent(panel,parent);else syncLayers();}
export function unregisterFloatingPanel(panel){const record=panels.get(panel);record?.backdrop?.remove();panels.delete(panel);for(const [childPanel,child]of panels)if(child.parent===panel){child.parent=record?.parent||null;parentLabel(childPanel,child.parent);child.onChange?.();}if(background.has(panel)){panel.inert=background.get(panel);background.delete(panel);}syncLayers();}
export function raiseFloatingPanel(panel){const chain=[];for(let current=panel;current&&panels.has(current);current=panels.get(current).parent)chain.unshift(current);for(const current of chain)panels.get(current).order=++sequence;syncLayers();panels.get(panel)?.onChange?.();}
export function initFloatingPanels(){initLayers();}
