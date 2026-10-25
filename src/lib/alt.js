let initialized=false,held=false;
const listeners=new Set();
export const hasAlt=event=>Boolean(event?.altKey&&!event.ctrlKey&&!event.metaKey&&!event.getModifierState?.('AltGraph'));
export const altHeld=()=>held;
export function watchAlt(listener){
 listeners.add(listener);
 if(!initialized){
  initialized=true;
  const update=event=>{
   const next=hasAlt(event);if(next===held)return;held=next;
   document.documentElement.classList.toggle('note-paused',held);
   for(const callback of listeners)callback(held,event);
  };
  for(const type of ['keydown','keyup','pointerover','pointermove','pointerdown','pointerup'])document.addEventListener(type,update,{capture:true,passive:true});
  const reset=()=>update({type:'blur'});
  addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
 }
 return ()=>listeners.delete(listener);
}
