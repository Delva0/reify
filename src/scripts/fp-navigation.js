import {parseFpUrl,fpHref,withFpState,validateFpState} from '../lib/fp-links.js';
import {fpSessionKey,validateFpSession,rememberFpReading,rememberFpInstance} from '../lib/fp-session.js';
import {fileBrowserStateKey,readFileBrowserState} from '../lib/file-browser-state.js';
import {parseLineRanges} from '../lib/code-props.js';
import {raiseFloatingPanel,floatingParent,floatingLayer,setFloatingParent} from './floating-panels.js';
import {notice} from '../lib/dom.js';

const types=new Map();let entries=[],initialized=false,nextId=0,saveFrame,announcedState,activeScope,changingPage=false;
let readings=new Map(),archive=new Map();
const orderedEntries=()=>[...entries].sort((a,b)=>floatingLayer(a.handle.panel)-floatingLayer(b.handle.panel));
export const floatingPanelState=()=>orderedEntries().filter(entry=>entry.modal).map(entry=>entry.state);
export function appendFpState(current,incoming){return validateFpState([...current,...incoming]);}
export function registerFpType(type,open){types.set(type,open);}
export function enhanceFloatingLinks(root){
 for(const link of root.querySelectorAll('a[href]')){
  try{
   const target=parseFpUrl(link.dataset.fpTarget||link.getAttribute('href'),location.href);if(!target)continue;
   const parents=[];for(let panel=link.closest('[data-floating-panel]');panel;panel=floatingParent(panel)){const entry=entries.find(entry=>entry.handle.panel===panel);if(entry)parents.unshift(entry.state);}
   if(!parents.length)continue;
   link.dataset.fpTarget=fpHref(target);link.href=withFpState(location.href,validateFpState([...parents,...target])).href;
   link.removeAttribute('data-link-kind');
  }catch{}
 }
}
const legacyStorageKey=()=>`floating-panels-v1:${document.body.dataset.repositoryName}@${document.body.dataset.commit}`;
const pageScope=()=>({repository:document.body.dataset.repositoryName,commit:document.body.dataset.commit,pathname:location.pathname});
const storageKey=()=>{const scope=activeScope||pageScope();return fpSessionKey(scope.repository,scope.commit,scope.pathname);};
function ownerEntry(panel){for(let ancestor=panel;ancestor;ancestor=floatingParent(ancestor)){const entry=entries.find(entry=>entry.handle.panel===ancestor);if(entry)return entry;}}
function capture(entry){const snapshot=entry.handle?.snapshot?.()||{};rememberFpReading(readings,entry.state,entry.handle?.readingSnapshot?.()||snapshot);rememberFpInstance(archive,entry,snapshot);return snapshot;}

function saveSession(){
 try{
  const snapshots=new Map(entries.map(entry=>[entry,capture(entry)]));
  localStorage.setItem(storageKey(),JSON.stringify({version:2,entries:orderedEntries().map(entry=>({
   id:entry.id,state:entry.state,modal:entry.modal,parentId:entry.parentId,
   snapshot:snapshots.get(entry)
  })),readings:[...readings.values()],archive:[...archive.values()]}));
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
 const identity={scope:storageKey(),ids:orderedEntries().filter(entry=>entry.modal).map(entry=>entry.id)},identityChanged=JSON.stringify(history.state?.reifyFp)!==JSON.stringify(identity);
 if((!activeScope||activeScope.pathname===location.pathname)&&(identityChanged||(historyMode&&url.href!==location.href)))history[historyMode==='push'?'pushState':'replaceState']({...history.state,reifyFp:identity},'',historyMode?url:location.href);
 saveSession();
 const encoded=fpHref(state);if(encoded!==announcedState){announcedState=encoded;document.dispatchEvent(new CustomEvent('fpchange',{detail:{state}}));}
}
function openEntry(state,{origin,saved,parentPanel,parentsReady=[]}={}){
 let id=saved?.id;
 if(!id){do{id='fp-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+(++nextId));}while(entries.some(entry=>entry.id===id)||archive.has(id));}
 parentPanel||=origin?.closest?.('[data-floating-panel]');
 let parent=ownerEntry(parentPanel);
 parent||=entries.find(entry=>entry.id===saved?.parentId);
 parentPanel||=parent?.handle.panel;
 const entry={id,key:fpHref([state]),state,modal:saved?.modal??true,parentId:parent?.id||parentPanel?.dataset?.fpSessionId||null};
 const reading=readings.get(entry.key)?.snapshot;
 entry.handle=types.get(state.type)(state.props,{
  origin,parentPanel,parentId:entry.parentId,sessionId:id,parentsReady,
  restore:saved?{...reading,...saved.snapshot,modal:entry.modal}:reading?{...reading,modal:entry.modal}:undefined,
  onStateChange:()=>{if(entries.includes(entry))scheduleSave();},
  onClose:snapshot=>{const final=snapshot||entry.handle?.snapshot?.();rememberFpReading(readings,entry.state,final);rememberFpInstance(archive,entry,final);const at=entries.indexOf(entry);if(at<0)return;entries.splice(at,1);for(const child of entries)if(child.parentId===entry.id)child.parentId=entry.parentId;sync('replace');},
  onDetach:()=>{if(!entries.includes(entry))return;entry.modal=false;sync('replace');},
  onAttach:()=>{if(!entries.includes(entry))return;entry.modal=true;sync('replace');}
 });
 entry.handle.panel.dataset.fpSessionId=id;
 if(entry.handle.ready)Promise.resolve(entry.handle.ready).then(()=>{if(entries.includes(entry))document.dispatchEvent(new CustomEvent('fpready',{detail:{panel:entry.handle.panel}}));},()=>{});
 return entry;
}

export function openFloatingPanels(state,{origin,historyMode='push'}={}){
 validateFpState([...entries.map(entry=>entry.state),...state]);for(const item of state)if(!types.has(item.type))throw Error('尚未注册 fp 类型：'+item.type);
 for(const entry of entries)capture(entry);
 for(const item of state){const entry=openEntry(item,{origin,parentsReady:entries.map(entry=>entry.handle.ready).filter(Boolean)});entries.push(entry);raiseFloatingPanel(entry.handle.panel);}
 sync(historyMode);
}

function historyIds(state){
 const saved=history.state?.reifyFp;
 return saved?.scope===storageKey()&&Array.isArray(saved.ids)&&saved.ids.length===state.length&&saved.ids.every(id=>typeof id==='string')&&new Set(saved.ids).size===saved.ids.length?saved.ids:null;
}
export function showFloatingPanels(state,{historyMode='push',origin,raise=true,instanceIds}={}){
 validateFpState(state);for(const item of state)if(!types.has(item.type))throw Error('尚未注册 fp 类型：'+item.type);
 const retained=entries.filter(entry=>!entry.modal);
 validateFpState([...retained.map(entry=>entry.state),...state]);
 const remaining=[...entries],next=[];
 for(const [at,item]of state.entries()){
  const key=fpHref([item]),id=instanceIds?.[at],index=remaining.findIndex(entry=>entry.modal&&entry.key===key&&(!id||entry.id===id));
  if(index>=0){const [entry]=remaining.splice(index,1);if(origin){setFloatingParent(entry.handle.panel,origin);entry.parentId=ownerEntry(floatingParent(entry.handle.panel))?.id||null;}next.push(entry);continue;}
  const parents=[...entries,...next].filter((entry,index,all)=>all.indexOf(entry)===index);
  const record=id&&archive.get(id),saved=id&&!entries.some(entry=>entry.id===id)?record&&fpHref([record.state])===key?{...record,modal:true}:{id,state:item,modal:true,parentId:null,snapshot:{}}:undefined;
  const parentPanel=origin?undefined:saved?parents.find(entry=>entry.id===saved.parentId)?.handle.panel:next.at(-1)?.handle.panel;
  next.push(openEntry(item,{origin,saved,parentPanel,parentsReady:parents.map(entry=>entry.handle.ready).filter(Boolean)}));
 }
 const removed=remaining.filter(entry=>entry.modal);
 entries=[...remaining.filter(entry=>!entry.modal),...next];
 const liveIds=new Set(entries.map(entry=>entry.id)),removedById=new Map(removed.map(entry=>[entry.id,entry]));
 for(const entry of entries)while(entry.parentId&&!liveIds.has(entry.parentId))entry.parentId=removedById.get(entry.parentId)?.parentId||null;
 for(const entry of removed){const snapshot=entry.handle?.snapshot?.();rememberFpReading(readings,entry.state,entry.handle?.readingSnapshot?.()||snapshot);rememberFpInstance(archive,entry,snapshot);entry.handle.close();}
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
 activeScope=pageScope();changingPage=false;announcedState=undefined;readings=new Map();archive=new Map();
 try{
  let state=parseFpUrl(location.href,location.href),session;
  try{const stored=localStorage.getItem(storageKey());if(stored!==null)session=validateFpSession(JSON.parse(stored));}catch{}
  if(session)for(const record of session.readings)rememberFpReading(readings,record.state,record.snapshot);
  if(session)for(const record of session.archive)rememberFpInstance(archive,record,record.snapshot);
  if(session)state=restoreSession(session,state);
  if(state===null){
   if(document.body.dataset.repositoryName&&document.body.dataset.commit)try{const stored=localStorage.getItem(legacyStorageKey());if(stored!==null)state=validateFpState(JSON.parse(stored));}catch{state=[];}
   if(state===null){const saved=readFileBrowserState(fileBrowserStateKey(document.body.dataset.repositoryName,document.body.dataset.commit));state=saved.file?[{type:'code',props:{file:saved.file,ranges:parseLineRanges(saved.lines||'')}}]:[];}
  }
  showFloatingPanels(state,{historyMode:'replace',raise:!session,instanceIds:historyIds(state)});
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
   const state=parseFpUrl(link.dataset?.fpTarget||link.getAttribute('href'),location.href);if(!state)return;
   event.preventDefault();openFloatingPanels(state,{origin:link});
  }catch(error){event.preventDefault();notice(error.message);}
 });
 const saveBeforeLeave=()=>{if(!changingPage)saveSession();};addEventListener('pagehide',saveBeforeLeave);addEventListener('beforeunload',saveBeforeLeave);
 document.addEventListener('reify:before-navigate',event=>{const pending=Promise.resolve().then(suspendPage);event.detail?.waitUntil?.(pending);});
 document.addEventListener('reify:after-navigate',restorePage);
 addEventListener('popstate',()=>{if(changingPage||activeScope?.pathname!==location.pathname)return;try{const state=parseFpUrl(location.href,location.href)||[];showFloatingPanels(state,{historyMode:false,instanceIds:historyIds(state)});}catch(error){showFloatingPanels([],{historyMode:'replace'});notice(error.message);}});
 restorePage();
}
