import {sidebarDefinitions} from '../lib/sidebar-state.js';
const controllers=new Map();
export function disposeSidebar(id){controllers.get(id)?.dispose();}
export function initSidebar(id,onVisibility){
 const definition=sidebarDefinitions[id],panel=document.querySelector(definition.panel),toggle=document.querySelector(definition.toggle),existing=controllers.get(id);
 if(existing?.panel===panel&&existing?.toggle===toggle){if(onVisibility)existing.onVisibility=onVisibility;existing.sync();return existing;}
 existing?.dispose();if(!panel||!toggle)return;
 const controller={panel,toggle,onVisibility};
 const root=document.documentElement,wide=matchMedia('(min-width:1200px)');let collapsed=root.getAttribute(definition.attribute)==='true';
 if(!root.hasAttribute(definition.attribute))try{collapsed=localStorage.getItem(definition.storage)==='true';}catch{}
 const sync=()=>{
  root.setAttribute(definition.attribute,String(collapsed));
  const visible=wide.matches?!collapsed:panel.classList.contains('is-open'),label=visible?definition.closeLabel:definition.openLabel;
  toggle.setAttribute('aria-expanded',String(visible));toggle.setAttribute('aria-label',label);toggle.dataset.tip=label;controller.onVisibility?.(visible);
 };
 const closeOverlay=()=>{panel.classList.remove('is-open');sync();};
 const click=()=>{if(wide.matches){collapsed=!collapsed;try{localStorage.setItem(definition.storage,String(collapsed));}catch{}}else panel.classList.toggle('is-open');sync();};
 const keydown=event=>{if(event.key==='Escape'&&!wide.matches){closeOverlay();toggle.focus();}};
 toggle.addEventListener('click',click);panel.addEventListener('keydown',keydown);wide.addEventListener('change',sync);
 Object.assign(controller,{sync,closeOverlay,dispose(){toggle.removeEventListener?.('click',click);panel.removeEventListener?.('keydown',keydown);wide.removeEventListener?.('change',sync);if(controllers.get(id)===controller)controllers.delete(id);}});
 controllers.set(id,controller);sync();return controller;
}
