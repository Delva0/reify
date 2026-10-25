import {$,$$} from '../lib/dom.js';
import {registerFloatingPanel,setFloatingParent,raiseFloatingPanel,setFloatingModal} from './floating-panels.js';
import {altHeld,hasAlt,watchAlt} from '../lib/alt.js';
import {positionTip} from '../lib/position-tip.js';
import {transientSession,nodeReference,resolveNode,panelGeometry,restorePanelGeometry} from '../lib/transient-session.js';
import {readingContext,setReadingContext} from '../lib/reading-context.js';
let initialized=false;
export function hydrateAnnotations(root=document){
 const notes=new Map();
 for(const definitions of $$('[data-note-definitions]',root))for(const [id,desc]of Object.entries(JSON.parse(definitions.dataset.noteDefinitions)))notes.set(id,desc);
 for(const symbol of $$('[data-note]',root)){
  const desc=notes.get(symbol.dataset.note);if(!desc)throw Error('Undefined annotation: '+symbol.dataset.note);
  symbol.dataset.noteDescription=desc;symbol.classList.add('text-note');symbol.tabIndex=0;
 }
}
export function initAnnotations(){
 const description=$('#note-description');if(initialized||!description)return;initialized=true;
 let session=transientSession('note'),pending=session.read();
 let active,closeTimer,pinned=false,group=[],pointer,pointerKnown=false;
 const hold=()=>clearTimeout(closeTimer);
 const save=()=>{if(pinned&&active)session.write({trigger:nodeReference(active),geometry:panelGeometry(description),modal:description.dataset.modal==='true'});};
 const pin=()=>{if(!active||altHeld())return;pinned=true;hold();description.setAttribute('data-pinned','');save();};
 const hide=()=>{hold();pending=null;session.write(null);for(const node of group){node.classList.remove('note-active');node.removeAttribute('aria-describedby');}group=[];active=null;pinned=false;description.removeAttribute('data-pinned');description.hidden=true;description.textContent='';};
 registerFloatingPanel(description,event=>{if(event.type==='close'||event.key==='Escape'||!altHeld()&&!hasAlt(event))hide();});
 const position=()=>{
  if(!active)return;
  positionTip(description,group.flatMap(node=>[...node.getClientRects()]),300);
 };
 const show=(trigger,event)=>{
  if(pinned||altHeld()||hasAlt(event))return;
  if(event.type.startsWith('pointer')&&event.buttons)return;
  hold();if(group.includes(trigger))return;if(active)hide();active=trigger;
  const scope=trigger.closest('.code-block,[data-source-code]')||document;
  group=trigger.dataset.noteGroup===undefined?[trigger]:$$('[data-note-group]',scope).filter(node=>node.dataset.noteGroup===trigger.dataset.noteGroup);
  for(const node of group){node.classList.add('note-active');node.setAttribute('aria-describedby',description.id);}
  document.body.append(description);
  setReadingContext(description,readingContext(trigger));
  description.textContent=trigger.dataset.noteDescription;description.hidden=false;
  setFloatingParent(description,trigger);raiseFloatingPanel(description);
  trigger.setAttribute('aria-describedby',description.id);position();
 };
 const restore=()=>{
  if(!pending||active||altHeld())return;const saved=pending,trigger=resolveNode(saved.trigger);
  if(!trigger?.dataset?.noteDescription)return;
  show(trigger,{type:'restore'});pinned=true;description.setAttribute('data-pinned','');restorePanelGeometry(description,saved.geometry);setFloatingModal(description,Boolean(saved.modal));pending=null;save();
 };
 Promise.resolve().then(restore);document.addEventListener('fpready',restore);addEventListener('pagehide',save);addEventListener('beforeunload',save);
 document.addEventListener('reify:before-navigate',()=>{save();hold();for(const node of group){node.classList.remove('note-active');node.removeAttribute('aria-describedby');}group=[];active=null;pinned=false;pending=null;description.removeAttribute('data-pinned');description.hidden=true;description.textContent='';setFloatingModal(description,false);setFloatingParent(description,null);});
 document.addEventListener('reify:after-navigate',()=>{session=transientSession('note');pending=session.read();restore();});
 const deferHide=()=>{hold();if(pinned||altHeld())return;closeTimer=setTimeout(()=>{if(!pinned&&!altHeld()&&!group.some(node=>node.matches(':hover,:focus-within'))&&!description.matches(':hover'))hide();},120);};
 const track=event=>{pointerKnown=true;pointer={x:event.clientX,y:event.clientY,buttons:event.buttons};};
 const recheck=()=>{
  if(pinned||altHeld()||pointer?.buttons)return;
  const target=pointer?document.elementFromPoint(pointer.x,pointer.y):pointerKnown?null:document.activeElement;
  if(target&&description.contains(target)){hold();return;}
  const trigger=target?.closest?.('[data-note-description]');if(trigger)show(trigger,{type:'resume'});else hide();
 };
 watchAlt((paused,event)=>{if(paused)hold();else if(event.type==='blur'){pointer=null;pointerKnown=true;if(!pinned)hide();}else{restore();recheck();}});
 document.addEventListener('pointermove',track,{capture:true,passive:true});
 document.addEventListener('pointerover',event=>{track(event);const trigger=event.target.closest?.('[data-note-description]');if(trigger&&!trigger.contains(event.relatedTarget))show(trigger,event);});
 document.addEventListener('pointerout',event=>{if(!event.relatedTarget){pointerKnown=true;pointer=null;}if(active?.contains(event.target)&&!active.contains(event.relatedTarget))deferHide();});
 document.addEventListener('pointerup',event=>{track(event);recheck();});
 description.addEventListener('pointerenter',hold);description.addEventListener('pointerleave',deferHide);
 description.addEventListener('pointerdown',pin);
 document.addEventListener('click',event=>{const trigger=event.target.closest?.('[data-note-description]');if(!trigger||event.target.closest('a[href]'))return;show(trigger,event);pin();});
 document.addEventListener('focusin',event=>{if(altHeld())return;const trigger=event.target.closest?.('[data-note-description]');if(trigger)show(trigger,event);else if(active&&!pinned&&!description.contains(event.target))hide();});
 document.addEventListener('focusout',event=>{if(active?.contains(event.target))deferHide();});
 document.addEventListener('keydown',event=>{
  const trigger=event.target.closest?.('[data-note-description]');
  if(trigger&&!event.target.closest('a[href],button')&&(event.key==='Enter'||event.key===' ')){event.preventDefault();show(trigger,event);pin();}
 },true);
 for(const type of ['close','sourcechange'])document.addEventListener(type,event=>{if(event.target.matches?.('[data-code-viewer]')&&active&&event.target.contains(active))hide();},true);
 addEventListener('resize',position);document.addEventListener('scroll',event=>{if(!description.contains(event.target))position();},{capture:true,passive:true});
}
