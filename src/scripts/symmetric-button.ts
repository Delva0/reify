import {eventElement} from './event-target.js';
export function initSymmetricButtons(){
 document.addEventListener('click',event=>{
  if(event.detail>0)eventElement(event)?.closest<HTMLElement>('.symmetric-part')?.blur();
 });
}
