// Also serialized into isolated HTML documents: keep this function self-contained.
interface NativeCloseWatcher extends EventTarget {destroy(): void}
declare const CloseWatcher: {new(): NativeCloseWatcher} | undefined;
export function bindNativeClose(close: (event: Event) => void,{active=()=>true,onPriority=(_value: boolean)=>{}}: {active?: () => unknown; onPriority?: (value: boolean) => void}={}){
 let watcher: NativeCloseWatcher | undefined,closing=false,pending=false,disposed=false,escape: KeyboardEvent | undefined;
 const sync=()=>{
  if(disposed||typeof CloseWatcher!=='function'||closing)return;
  if(pending||!active()){escape=undefined;watcher?.destroy();watcher=undefined;return;}
  if(watcher)return;
  const current=watcher=new CloseWatcher();
  current.addEventListener('close',event=>{
   if(watcher!==current)return;escape=undefined;watcher=undefined;closing=true;
   try{close(event);}finally{queueMicrotask(()=>{closing=false;sync();});}
  });
 };
 const setPriority=(value: boolean)=>{value=Boolean(value);if(pending===value)return;pending=value;sync();onPriority(value);};
 const keydown=(event: KeyboardEvent)=>{
  if(event.defaultPrevented||event.isComposing||event.repeat)return;
  const key=event.key.toLowerCase(),find=!event.altKey&&(((event.ctrlKey||event.metaKey)&&(key==='g'||key==='f'&&!event.shiftKey))||key==='f3'&&!event.ctrlKey&&!event.metaKey);
  if(find){setPriority(true);return;}
  if(event.key!=='Escape'||pending||document.hasFocus?.()===false||!active())return;
  // Some browser hosts expose CloseWatcher without delivering every close
  // request. Keep the keydown until keyup so the native path gets first use.
  if(typeof CloseWatcher==='function'){escape=event;return;}
  close(event);event.preventDefault();event.stopPropagation();
 };
 const keyup=(event: KeyboardEvent)=>{
  if(event.key!=='Escape'||event.isComposing)return;
  if(pending){escape=undefined;setPriority(false);return;}
  const request=escape;escape=undefined;
  if(!request||request.defaultPrevented||document.hasFocus?.()===false||!active())return;
  watcher?.destroy();watcher=undefined;closing=true;
  try{close(event);}finally{queueMicrotask(()=>{closing=false;sync();});}
 };
 addEventListener('keydown',keydown);addEventListener('keyup',keyup);sync();
 return {sync,setPriority,get priority(){return pending;},dispose(){disposed=true;watcher?.destroy();watcher=undefined;removeEventListener('keydown',keydown);removeEventListener('keyup',keyup);}};
}
