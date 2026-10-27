import {eventElement,eventNode} from './event-target.js';
import {positionTip} from '../lib/position-tip.js';
export function initTips(){
 const tip=document.querySelector<HTMLElement>('#control-tip');if(!tip)return;
 const selector='[data-tip],[data-tip-overflow],.icon-button[aria-label],.tree-branch[aria-label],[role=separator][aria-label]:not(.tree-resize-handle)';
 let active: HTMLElement | null= null,keyboard=false;
 const hide=()=>{if(active){const ids=(active.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==tip.id);if(ids.length)active.setAttribute('aria-describedby',ids.join(' '));else active.removeAttribute('aria-describedby');}active=null;tip.hidden=true;};
 const position=()=>{if(active?.isConnected)positionTip(tip,[active.getBoundingClientRect()]);else hide();};
 const show=(trigger: HTMLElement)=>{hide();const overflow=trigger.hasAttribute('data-tip-overflow'),label=overflow?(trigger.querySelector('[data-tip-label]')||trigger):null;if(label&&label.scrollWidth<=label.clientWidth)return;active=trigger;tip.textContent=label?.textContent||trigger.dataset.tip||(trigger.classList.contains('tree-branch')?(trigger.getAttribute('aria-expanded')==='true'?'收起分支':'展开分支'):trigger.getAttribute('aria-label'));if(!tip.textContent)return;const ids=new Set((trigger.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(tip.id);trigger.setAttribute('aria-describedby',[...ids].join(' '));tip.hidden=false;position();};
 document.addEventListener('pointerover',event=>{const trigger=eventElement(event)?.closest<HTMLElement>(selector);if(trigger&&!event.buttons&&!trigger.contains(eventNode(event.relatedTarget)))show(trigger);});
 document.addEventListener('pointerout',event=>{if(active?.contains(eventNode(event.target))&&!active.contains(eventNode(event.relatedTarget)))hide();});
 document.addEventListener('focusin',event=>{const trigger=eventElement(event)?.closest<HTMLElement>(selector);if(trigger&&keyboard)show(trigger);});
 document.addEventListener('focusout',event=>{if(active?.contains(eventNode(event.target)))hide();});
 document.addEventListener('tipchange',event=>{if(active&&event.target===active)show(active);});
 document.addEventListener('panelresize',event=>{if(active&&eventNode(event.target)?.contains(active))position();});
 document.addEventListener('pointerdown',()=>{keyboard=false;hide();},true);
 document.addEventListener('reify:before-navigate',hide);
 document.addEventListener('keydown',event=>{keyboard=event.key==='Tab';if(event.key==='Escape')hide();},true);
 document.addEventListener('keyup',event=>{if(event.key==='Tab')keyboard=false;},true);
 document.addEventListener('scroll',position,{capture:true,passive:true});addEventListener('resize',position);addEventListener('blur',hide);
}
