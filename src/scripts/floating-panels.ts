type Close = (event?: Event) => void;
interface PanelOptions {parent?: HTMLElement | null; priority?: 'title' | 'editor'; onBackdrop?: () => void; onChange?: () => void}
interface PanelRecord extends Omit<PanelOptions,'parent'> {close: Close; parent: HTMLElement | null; modal: boolean; order: number; backdrop?: HTMLElement}
import {bindNativeClose} from '../lib/native-close.js';
import {createModalInteraction} from './modal-interaction.js';
const panels=new Map<HTMLElement,PanelRecord>(),interaction=createModalInteraction(),closePriorities=new Set<(value: boolean) => void>();let initialized=false,closeRequests: ReturnType<typeof bindNativeClose> | undefined,sequence=0;
const editorLayer=2147483000,titleLayer=2147483647;
export const floatingLayer=(panel?: HTMLElement | null)=>panel?.dataset?.floatingLayer==='title'?Infinity:panel?.dataset?.floatingLayer==='editor'?editorLayer:Number(panel?.dataset?.floatingLayer||0);
export const floatingParent=(panel: HTMLElement | null | undefined): HTMLElement | null=>(panel?panels.get(panel):undefined)?.parent||null;
export const floatingBlocked=(element: EventTarget | null)=>interaction.blocked(element);
const parentLabel=(panel: HTMLElement,parent: HTMLElement | null | undefined)=>{panel.dataset.floatingParent=parent?.dataset?.fpSessionId||parent?.id||'';};
const visible=(panel: HTMLElement)=>panel.isConnected!==false&&!panel.hidden&&(panel.tagName!=='DIALOG'||('open' in panel&&panel.open));
const ordered=()=>[...panels].reverse().filter(([panel])=>visible(panel)&&!panel.hasAttribute?.('data-floating-persistent')).sort(([a],[b])=>floatingLayer(b)-floatingLayer(a)).map(([panel,record]): [HTMLElement,Close]=>[panel,record.close]);
function syncLayers(){
 const normal=[...panels].filter(([,record])=>!record.priority),ordered: [HTMLElement,PanelRecord][]=[],visited=new Set<HTMLElement>();
 const visit=(entry: [HTMLElement,PanelRecord])=>{const [panel]=entry;if(visited.has(panel))return;visited.add(panel);ordered.push(entry);for(const child of normal.filter(([,record])=>record.parent===panel).sort((a,b)=>a[1].order-b[1].order))visit(child);};
 for(const entry of normal.filter(([,record])=>!normal.some(([panel])=>panel===record.parent)).sort((a,b)=>a[1].order-b[1].order))visit(entry);
 for(const entry of normal)visit(entry);
 ordered.forEach(([panel],index)=>{panel.dataset.floatingLayer=String(10+index*2);if(panel.style)panel.style.zIndex=panel.dataset.floatingLayer;});
 for(const [panel,record]of panels){
  if(record.priority){panel.dataset.floatingLayer=record.priority;if(panel.style)panel.style.zIndex=String(record.priority==='title'?titleLayer:editorLayer);}
  const active=record.modal&&visible(panel);
  if(active&&!record.backdrop&&document.createElement&&document.body?.append){
   const backdrop=record.backdrop=document.createElement('div');backdrop.className='floating-backdrop';backdrop.setAttribute('aria-hidden','true');
   backdrop.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;if(record.onBackdrop)record.onBackdrop();else setFloatingModal(panel,false);});
   document.body.append(backdrop);
  }
  if(record.backdrop){const hidden=!active;if(record.backdrop.hidden!==hidden)record.backdrop.hidden=hidden;record.backdrop.dataset.floatingLayer=String(floatingLayer(panel)-1);record.backdrop.style.zIndex=String(floatingLayer(panel)-1);}
 }
 const modal=[...panels].filter(([panel,record])=>record.modal&&visible(panel)).sort(([a],[b])=>floatingLayer(b)-floatingLayer(a))[0]?.[0],barrier=modal?floatingLayer(modal):0;
 document.documentElement?.classList?.toggle('floating-modal-active',Boolean(modal));
 const affected=[...(document.querySelectorAll?.<HTMLElement>('main,.repo-tree,.github-files')||[]),...panels.keys()];
 interaction.sync(modal,affected.filter(node=>modal&&floatingLayer(node)<barrier));
 closeRequests?.sync();
}
export function setFloatingParent(panel: HTMLElement,origin: Node | null | undefined){
 const record=panels.get(panel);if(!record)return;
 const element=origin?.nodeType===3?origin.parentElement:origin,parent=panels.has(element as HTMLElement)?element as HTMLElement:(element as Element | null)?.closest?.<HTMLElement>('[data-floating-panel]')||null;
 for(let ancestor: HTMLElement | null | undefined=parent;ancestor;ancestor=panels.get(ancestor)?.parent)if(ancestor===panel)return;
 const changed=record.parent!==(parent||null);record.parent=parent||null;parentLabel(panel,parent);syncLayers();if(changed)record.onChange?.();
}
export function setFloatingModal(panel: HTMLElement,modal: boolean){
 const record=panels.get(panel);if(!record)return;
 const changed=record.modal!==Boolean(modal);record.modal=Boolean(modal);if(panel.dataset.modal!==String(record.modal))panel.dataset.modal=String(record.modal);panel.setAttribute?.('aria-modal',String(record.modal));syncLayers();if(changed)record.onChange?.();
}
export const requestFloatingClose=(event?: Event)=>{if(!closeRequests?.priority)ordered()[0]?.[1](event);};
export const setFloatingClosePriority=(value: boolean)=>closeRequests?.setPriority(value);
export function watchFloatingClosePriority(listener: (value: boolean) => void){closePriorities.add(listener);listener(Boolean(closeRequests?.priority));return ()=>closePriorities.delete(listener);}
function initLayers(){
 if(initialized)return;initialized=true;
 interaction.init();
 const focus=(event: Event)=>{
  const layer=floatingLayer(event.target instanceof Element?event.target.closest<HTMLElement>('[data-floating-layer]'):null);
  for(const [panel,close]of ordered())if(panel.dataset.floatingDismiss!=='explicit'&&floatingLayer(panel)>layer)close(event);
  const panel=event.target instanceof Element?event.target.closest<HTMLElement>('[data-floating-panel]'):null;if(panel&&panels.has(panel))raiseFloatingPanel(panel);
 };
 document.addEventListener('pointerdown',focus,true);document.addEventListener('focusin',focus,true);
 if(typeof MutationObserver==='function'&&document.body)new MutationObserver(syncLayers).observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden','open','data-floating-persistent']});
 closeRequests=bindNativeClose(requestFloatingClose,{active:()=>ordered().length,onPriority:value=>{for(const listener of closePriorities)listener(value);}});
}
export function registerFloatingPanel(panel: HTMLElement,close: Close,{parent,priority,onBackdrop,onChange}: PanelOptions={}){if(priority!==undefined&&!['title','editor'].includes(priority))throw Error('Unknown floating priority: '+priority);panels.set(panel,{close,parent:null,priority:priority||(panel.dataset.floatingLayer==='title'||panel.dataset.floatingLayer==='editor'?panel.dataset.floatingLayer:undefined),modal:panel.dataset?.modal==='true',onBackdrop,onChange,order:++sequence});initLayers();if(parent)setFloatingParent(panel,parent);else syncLayers();}
export function unregisterFloatingPanel(panel: HTMLElement){const record=panels.get(panel);record?.backdrop?.remove();panels.delete(panel);interaction.release(panel);for(const [childPanel,child]of panels)if(child.parent===panel){child.parent=record?.parent||null;parentLabel(childPanel,child.parent);child.onChange?.();}syncLayers();}
export function raiseFloatingPanel(panel: HTMLElement){const chain=[];for(let current: HTMLElement | null=panel;current&&panels.has(current);current=panels.get(current)!.parent)chain.unshift(current);for(const current of chain)panels.get(current)!.order=++sequence;syncLayers();panels.get(panel)?.onChange?.();}
export function initFloatingPanels(){initLayers();}
