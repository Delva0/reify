import {sidebarDefinitions} from '../lib/sidebar-state.js';
export function initSidebar(id,onVisibility){
 const definition=sidebarDefinitions[id],panel=document.querySelector(definition.panel),toggle=document.querySelector(definition.toggle);if(!panel||!toggle)return;
 const root=document.documentElement,wide=matchMedia('(min-width:1200px)');let collapsed=root.getAttribute(definition.attribute)==='true';
 if(!root.hasAttribute(definition.attribute))try{collapsed=localStorage.getItem(definition.storage)==='true';}catch{}
 const sync=()=>{
  root.setAttribute(definition.attribute,String(collapsed));
  const visible=wide.matches?!collapsed:panel.classList.contains('is-open'),label=visible?definition.closeLabel:definition.openLabel;
  toggle.setAttribute('aria-expanded',String(visible));toggle.setAttribute('aria-label',label);toggle.dataset.tip=label;onVisibility?.(visible);
 };
 const closeOverlay=()=>{panel.classList.remove('is-open');sync();};
 toggle.addEventListener('click',()=>{if(wide.matches){collapsed=!collapsed;try{localStorage.setItem(definition.storage,String(collapsed));}catch{}}else panel.classList.toggle('is-open');sync();});
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'&&!wide.matches){closeOverlay();toggle.focus();}});
 wide.addEventListener('change',sync);sync();return {sync,closeOverlay};
}
