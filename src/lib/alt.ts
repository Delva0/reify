export interface AltEvent {altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; type?: string; getModifierState?(key: string): boolean}
let initialized=false,held=false;
const listeners=new Set<(held: boolean,event: AltEvent)=>void>();
export const hasAlt=(event?: AltEvent|null)=>Boolean(event?.altKey&&!event.ctrlKey&&!event.metaKey&&!event.getModifierState?.('AltGraph'));
export const altHeld=()=>held;
export function watchAlt(listener: (held: boolean,event: AltEvent)=>void){
 listeners.add(listener);
 if(!initialized){
  initialized=true;
  const update=(event: AltEvent)=>{
   const next=hasAlt(event);if(next===held)return;held=next;
   document.documentElement.classList.toggle('note-paused',held);
   for(const callback of listeners)callback(held,event);
  };
  for(const type of ['keydown','keyup','pointerover','pointermove','pointerdown','pointerup'] as const)document.addEventListener(type,update,{capture:true,passive:true});
  const reset=()=>update({type:'blur'});
  addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
 }
 return ()=>listeners.delete(listener);
}
