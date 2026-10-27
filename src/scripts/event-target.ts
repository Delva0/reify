/** DOM targets are checked structurally so nodes from another realm also work. */
export function isElementTarget(target: EventTarget | null): target is Element{return Boolean(target&&'closest'in target&&typeof target.closest==='function');}
export function isHtmlElementTarget(target: EventTarget | null): target is HTMLElement{return isElementTarget(target)&&'dataset'in target&&typeof target.dataset==='object'&&target.dataset!==null;}
export const elementTarget=(target: EventTarget | null)=>isElementTarget(target)?target:null;
export const eventElement=(event: Event)=>elementTarget(event.target);
export function isNodeTarget(target: EventTarget | null): target is Node{return Boolean(target&&('nodeType'in target&&typeof target.nodeType==='number'||'contains'in target&&typeof target.contains==='function'));}
export const eventNode=(target: EventTarget | null)=>isNodeTarget(target)?target:null;

export function eventBindings(){
 const disposers: (()=>void)[]=[];
 return {
  on<K extends keyof HTMLElementEventMap>(target: HTMLElement,type: K,handler: (event: HTMLElementEventMap[K])=>void,options?: boolean | AddEventListenerOptions){
   const listener=(event: Event)=>handler(event as HTMLElementEventMap[K]);
   target.addEventListener(type,listener,options);disposers.push(()=>target.removeEventListener(type,listener,options));
  },
  dispose(){for(const dispose of disposers)dispose();disposers.length=0;}
 };
}
