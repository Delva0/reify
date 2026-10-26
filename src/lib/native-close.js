// Also serialized into isolated HTML documents: keep this function self-contained.
export function bindNativeClose(close,{active=()=>true,onPriority=()=>{}}={}){
 let watcher,closing=false,pending=false,disposed=false;
 const sync=()=>{
  if(disposed||typeof CloseWatcher!=='function'||closing)return;
  if(pending||!active()){watcher?.destroy();watcher=undefined;return;}
  if(watcher)return;
  const current=watcher=new CloseWatcher();
  current.addEventListener('close',event=>{
   if(watcher!==current)return;watcher=undefined;closing=true;
   try{close(event);}finally{queueMicrotask(()=>{closing=false;sync();});}
  });
 };
 const setPriority=value=>{value=Boolean(value);if(pending===value)return;pending=value;sync();onPriority(value);};
 const keydown=event=>{
  if(event.defaultPrevented||event.isComposing||event.repeat)return;
  const key=event.key.toLowerCase(),find=!event.altKey&&(((event.ctrlKey||event.metaKey)&&(key==='g'||key==='f'&&!event.shiftKey))||key==='f3'&&!event.ctrlKey&&!event.metaKey);
  if(find){setPriority(true);return;}
  if(typeof CloseWatcher==='function'||event.key!=='Escape'||pending||document.hasFocus?.()===false||!active())return;
  close(event);event.preventDefault();event.stopPropagation();
 };
 const keyup=event=>{if(event.key==='Escape'&&!event.isComposing&&pending)setPriority(false);};
 addEventListener('keydown',keydown);addEventListener('keyup',keyup);sync();
 return {sync,setPriority,get priority(){return pending;},dispose(){disposed=true;watcher?.destroy();watcher=undefined;removeEventListener('keydown',keydown);removeEventListener('keyup',keyup);}};
}
