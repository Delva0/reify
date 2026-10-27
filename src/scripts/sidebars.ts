import {sidebarDefinitions} from '../lib/sidebar-state.js';
type SidebarId=keyof typeof sidebarDefinitions;
export interface SidebarController {panel: HTMLElement; toggle: HTMLElement; onVisibility?: (visible: boolean)=>void; sync(): void; closeOverlay(): void; dispose(): void}
const controllers=new Map<SidebarId,SidebarController>();
export function disposeSidebar(id: SidebarId){controllers.get(id)?.dispose();}
export function initSidebar(id: SidebarId,onVisibility?: (visible: boolean)=>void){
 const definition=sidebarDefinitions[id],panel=document.querySelector<HTMLElement>(definition.panel),toggle=document.querySelector<HTMLElement>(definition.toggle),existing=controllers.get(id);
 if(existing?.panel===panel&&existing?.toggle===toggle){if(onVisibility)existing.onVisibility=onVisibility;existing.sync();return existing;}
 existing?.dispose();if(!panel||!toggle)return;
 const root=document.documentElement,wide=matchMedia('(min-width:1200px)');let collapsed=root.getAttribute(definition.attribute)==='true';
 if(!root.hasAttribute(definition.attribute))try{collapsed=localStorage.getItem(definition.storage)==='true';}catch{}
 const sync=()=>{
  root.setAttribute(definition.attribute,String(collapsed));
  const visible=wide.matches?!collapsed:panel.classList.contains('is-open'),label=visible?definition.closeLabel:definition.openLabel;
  toggle.setAttribute('aria-expanded',String(visible));toggle.setAttribute('aria-label',label);toggle.dataset.tip=label;controller.onVisibility?.(visible);
 };
 const closeOverlay=()=>{panel.classList.remove('is-open');sync();};
 const click=()=>{if(wide.matches){collapsed=!collapsed;try{localStorage.setItem(definition.storage,String(collapsed));}catch{}}else panel.classList.toggle('is-open');sync();};
 const keydown=(event: KeyboardEvent)=>{if(event.key==='Escape'&&!wide.matches){closeOverlay();toggle.focus();}};
 toggle.addEventListener('click',click);panel.addEventListener('keydown',keydown);wide.addEventListener('change',sync);
 const controller: SidebarController={panel,toggle,onVisibility,sync,closeOverlay,dispose(){toggle.removeEventListener('click',click);panel.removeEventListener('keydown',keydown);wide.removeEventListener('change',sync);if(controllers.get(id)===controller)controllers.delete(id);}};
 controllers.set(id,controller);sync();return controller;
}
