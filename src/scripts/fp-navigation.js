import {parseFpUrl,fpHref,withFpState,validateFpState} from '../lib/fp-links.js';
import {fileBrowserStateKey,readFileBrowserState} from '../lib/file-browser-state.js';
import {parseLineRanges} from '../lib/code-props.js';
import {notice} from '../lib/dom.js';

const types=new Map();let entries=[],initialized=false;
export const floatingPanelState=()=>entries.map(entry=>entry.state);
export function appendFpState(current,incoming){const keys=new Set(incoming.map(item=>fpHref([item])));return [...current.filter(item=>!keys.has(fpHref([item]))),...incoming];}
export function registerFpType(type,open){types.set(type,open);}
const storageKey=()=>`floating-panels-v1:${document.body.dataset.repositoryName}@${document.body.dataset.commit}`;
function sync(historyMode){
 const state=floatingPanelState(),url=withFpState(location.href,state);
 if(historyMode&&url.href!==location.href)history[historyMode==='push'?'pushState':'replaceState'](history.state,'',url);
 try{localStorage.setItem(storageKey(),JSON.stringify(state));}catch{}
 entries.forEach((entry,index)=>{entry.handle.panel.dataset.floatingLayer=String(70+index);entry.handle.panel.style.zIndex=String(70+index);});
 document.dispatchEvent(new CustomEvent('fpchange',{detail:{state}}));
}
export function showFloatingPanels(state,{historyMode='push',origin}={}){
 validateFpState(state);for(const item of state)if(!types.has(item.type))throw Error('尚未注册 fp 类型：'+item.type);
 const remaining=[...entries],next=[];
 for(const item of state){
  const key=fpHref([item]),index=remaining.findIndex(entry=>entry.key===key);
  if(index>=0){next.push(...remaining.splice(index,1));continue;}
  const entry={key,state:item};
  entry.handle=types.get(item.type)(item.props,{origin,parentsReady:next.map(entry=>entry.handle.ready).filter(Boolean),onClose:()=>{
   const at=entries.indexOf(entry);if(at<0)return;entries.splice(at,1);sync('replace');
  },onDetach:()=>{
   const at=entries.indexOf(entry);if(at<0)return;entries.splice(at,1);sync('replace');
  },onAttach:()=>{
   if(entries.includes(entry))return;validateFpState([...floatingPanelState(),entry.state]);entries.push(entry);sync('replace');
  }});next.push(entry);
 }
 entries=next;for(const entry of remaining)entry.handle.close();sync(historyMode);
}
export function initFpNavigation(){
 if(initialized)return;initialized=true;
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
  let state;try{state=parseFpUrl(link.getAttribute('href'),location.href);}catch(error){event.preventDefault();notice(error.message);return;}
  if(!state)return;event.preventDefault();if(link.closest('[data-floating-panel]'))state=appendFpState(floatingPanelState(),state);showFloatingPanels(state,{origin:link.closest('[data-mdx-line]')});
 });
 addEventListener('popstate',()=>{try{showFloatingPanels(parseFpUrl(location.href,location.href)||[],{historyMode:false});}catch(error){showFloatingPanels([],{historyMode:'replace'});notice(error.message);}});
 try{
  let state=parseFpUrl(location.href,location.href);
  if(state===null){
   try{const stored=localStorage.getItem(storageKey());if(stored!==null)state=validateFpState(JSON.parse(stored));}catch{state=[];}
   if(state===null){const saved=readFileBrowserState(fileBrowserStateKey(document.body.dataset.repositoryName,document.body.dataset.commit));state=saved.file?[{type:'code',props:{file:saved.file,ranges:parseLineRanges(saved.lines||'')}}]:[];}
  }
  showFloatingPanels(state,{historyMode:'replace'});
 }catch(error){showFloatingPanels([],{historyMode:'replace'});notice(error.message);}
}
