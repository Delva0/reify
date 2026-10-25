import {parseFpUrl,fpHref,withFpState,validateFpState} from '../lib/fp-links.js';
import {fpSessionKey,validateFpSession} from '../lib/fp-session.js';
import {fileBrowserStateKey,readFileBrowserState} from '../lib/file-browser-state.js';
import {parseLineRanges} from '../lib/code-props.js';
import {raiseFloatingPanel,floatingParent,floatingLayer,setFloatingParent} from './floating-panels.js';
import {notice} from '../lib/dom.js';

const types=new Map();let entries=[],initialized=false,nextId=0,saveFrame,announcedState,activeScope,changingPage=false;
const orderedEntries=()=>[...entries].sort((a,b)=>floatingLayer(a.handle.panel)-floatingLayer(b.handle.panel));
export const floatingPanelState=()=>orderedEntries().filter(entry=>entry.modal).map(entry=>entry.state);
export function appendFpState(current,incoming){const keys=new Set(incoming.map(item=>fpHref([item])));return validateFpState([...current.filter(item=>!keys.has(fpHref([item]))),...incoming]);}
export function registerFpType(type,open){types.set(type,open);}
const legacyStorageKey=()=>`floating-panels-v1:${document.body.dataset.repositoryName}@${document.body.dataset.commit}`;
const pageScope=()=>({repository:document.body.dataset.repositoryName,commit:document.body.dataset.commit,pathname:location.pathname});
const storageKey=()=>{const scope=activeScope||pageScope();return fpSessionKey(scope.repository,scope.commit,scope.pathname);};
function ownerEntry(panel){for(let ancestor=panel;ancestor;ancestor=floatingParent(ancestor)){const entry=entries.find(entry=>entry.handle.panel===ancestor);if(entry)return entry;}}

function saveSession(){
 try{
  localStorage.setItem(storageKey(),JSON.stringify({version:2,entries:orderedEntries().map(entry=>({
   id:entry.id,state:entry.state,modal:entry.modal,parentId:entry.parentId,
   snapshot:entry.handle?.snapshot?.()||{}
  }))}));
 }catch{}
}
function scheduleSave(){
 if(changingPage||saveFrame!==undefined)return;
 const save=()=>{saveFrame=undefined;sync('replace');};
 if(typeof requestAnimationFrame==='function')saveFrame=requestAnimationFrame(save);
 else{saveFrame=true;queueMicrotask(save);}
}
function sync(historyMode){
 const state=floatingPanelState(),url=withFpState(location.href,state);
 if(historyMode&&(!activeScope||activeScope.pathname===location.pathname)&&url.href!==location.href)history[historyMode==='push'?'pushState':'replaceState'](history.state,'',url);
 saveSession();
 const encoded=fpHref(state);if(encoded!==announcedState){announcedState=encoded;document.dispatchEvent(new CustomEvent('fpchange',{detail:{state}}));}
}
function openEntry(state,{origin,saved,parentPanel,parentsReady=[]}={}){
 let id=saved?.id;
 if(!id){do{id='fp-'+(++nextId);}while(entries.some(entry=>entry.id===id));}
 parentPanel||=origin?.closest?.('[data-floating-panel]');
 let parent=ownerEntry(parentPanel);
 parent||=entries.find(entry=>entry.id===saved?.parentId);
 parentPanel||=parent?.handle.panel;
 const entry={id,key:fpHref([state]),state,modal:saved?.modal??true,parentId:parent?.id||parentPanel?.dataset?.fpSessionId||null};
 entry.handle=types.get(state.type)(state.props,{
  origin,parentPanel,parentId:entry.parentId,sessionId:id,parentsReady,
  restore:saved?{...saved.snapshot,modal:entry.modal}:undefined,
  onStateChange:()=>{if(entries.includes(entry))scheduleSave();},
  onClose:()=>{const at=entries.indexOf(entry);if(at<0)return;entries.splice(at,1);for(const child of entries)if(child.parentId===entry.id)child.parentId=entry.parentId;sync('replace');},
  onDetach:()=>{if(!entries.includes(entry))return;entry.modal=false;sync('replace');},
  onAttach:()=>{if(!entries.includes(entry))return;entry.modal=true;sync('replace');}
 });
 entry.handle.panel.dataset.fpSessionId=id;
 if(entry.handle.ready)Promise.resolve(entry.handle.ready).then(()=>{if(entries.includes(entry))document.dispatchEvent(new CustomEvent('fpready',{detail:{panel:entry.handle.panel}}));},()=>{});
 return entry;
}

export function showFloatingPanels(state,{historyMode='push',origin,raise=true}={}){
 validateFpState(state);for(const item of state)if(!types.has(item.type))throw Error('尚未注册 fp 类型：'+item.type);
 const keys=new Set(state.map(item=>fpHref([item]))),retained=entries.filter(entry=>!entry.modal&&!keys.has(entry.key));
 validateFpState([...retained.map(entry=>entry.state),...state]);
 const remaining=[...entries],next=[];
 for(const item of state){
  const key=fpHref([item]),index=remaining.findIndex(entry=>entry.key===key);
  if(index>=0){const [entry]=remaining.splice(index,1);if(origin){setFloatingParent(entry.handle.panel,origin);entry.parentId=ownerEntry(floatingParent(entry.handle.panel))?.id||null;}if(!entry.modal){entry.modal=true;entry.handle.restore?.({modal:true});}next.push(entry);continue;}
  const parents=[...entries,...next].filter((entry,index,all)=>all.indexOf(entry)===index);
  next.push(openEntry(item,{origin,parentPanel:origin?undefined:next.at(-1)?.handle.panel,parentsReady:parents.map(entry=>entry.handle.ready).filter(Boolean)}));
 }
 const removed=remaining.filter(entry=>entry.modal);
 entries=[...remaining.filter(entry=>!entry.modal),...next];
 const liveIds=new Set(entries.map(entry=>entry.id)),removedById=new Map(removed.map(entry=>[entry.id,entry]));
 for(const entry of entries)while(entry.parentId&&!liveIds.has(entry.parentId))entry.parentId=removedById.get(entry.parentId)?.parentId||null;
 for(const entry of removed)entry.handle.close();
 if(raise)for(const entry of next)raiseFloatingPanel(entry.handle.panel);
 sync(historyMode);
}

function restoreSession(session,state){
 const keys=state&&new Set(state.map(item=>fpHref([item])));
 for(const saved of session.entries){
  if(saved.modal&&keys&&!keys.has(fpHref([saved.state])))continue;
  if(!types.has(saved.state.type))continue;
  entries.push(openEntry(saved.state,{saved,parentsReady:entries.map(entry=>entry.handle.ready).filter(Boolean)}));
 }
 return state||session.entries.filter(entry=>entry.modal).map(entry=>entry.state);
}
function restorePage(){
 activeScope=pageScope();changingPage=false;announcedState=undefined;
 try{
  let state=parseFpUrl(location.href,location.href),session;
  try{const stored=localStorage.getItem(storageKey());if(stored!==null)session=validateFpSession(JSON.parse(stored));}catch{}
  if(session)state=restoreSession(session,state);
  if(state===null){
   if(document.body.dataset.repositoryName&&document.body.dataset.commit)try{const stored=localStorage.getItem(legacyStorageKey());if(stored!==null)state=validateFpState(JSON.parse(stored));}catch{state=[];}
   if(state===null){const saved=readFileBrowserState(fileBrowserStateKey(document.body.dataset.repositoryName,document.body.dataset.commit));state=saved.file?[{type:'code',props:{file:saved.file,ranges:parseLineRanges(saved.lines||'')}}]:[];}
  }
  showFloatingPanels(state,{historyMode:'replace',raise:!session});
 }catch(error){showFloatingPanels([],{historyMode:'replace'});notice(error.message);}
}
function suspendPage(){
 if(changingPage)return;
 saveSession();changingPage=true;if(typeof cancelAnimationFrame==='function')cancelAnimationFrame(saveFrame);saveFrame=undefined;
 const previous=entries;entries=[];for(const entry of previous)entry.handle.close();announcedState=undefined;
}
export function initFpNavigation(){
 if(initialized)return;initialized=true;
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
  try{
   let state=parseFpUrl(link.getAttribute('href'),location.href);if(!state)return;
   event.preventDefault();if(link.closest('[data-floating-panel]'))state=appendFpState(floatingPanelState(),state);
   showFloatingPanels(state,{origin:link});
  }catch(error){event.preventDefault();notice(error.message);}
 });
 const saveBeforeLeave=()=>{if(!changingPage)saveSession();};addEventListener('pagehide',saveBeforeLeave);addEventListener('beforeunload',saveBeforeLeave);
 document.addEventListener('reify:before-navigate',event=>{const pending=Promise.resolve().then(suspendPage);event.detail?.waitUntil?.(pending);});
 document.addEventListener('reify:after-navigate',restorePage);
 addEventListener('popstate',()=>{if(changingPage||activeScope?.pathname!==location.pathname)return;try{showFloatingPanels(parseFpUrl(location.href,location.href)||[],{historyMode:false});}catch(error){showFloatingPanels([],{historyMode:'replace'});notice(error.message);}});
 restorePage();
}
