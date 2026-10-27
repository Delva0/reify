import assert from 'node:assert/strict';
import {createModalInteraction} from '../dist/scripts/modal-interaction.js';

const globals=new Map(),install=(name,value)=>{globals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
const listeners=new Map(),nodes=[];let focused=true,guard;
class Node{
 constructor(name,parent=null,tabIndex=0){this.name=name;this.parent=parent;this.tabIndex=tabIndex;this.dataset={};this.isConnected=true;nodes.push(this);}
 contains(node){for(let current=node;current;current=current.parent)if(current===this)return true;return false;}
 matches(){return Boolean(this.disabled);}
 closest(){return this.nativeInert?this:null;}
 getClientRects(){return this.hidden?[]:[{}];}
 compareDocumentPosition(node){return nodes.indexOf(this)<nodes.indexOf(node)?4:2;}
 focus(options){assert.equal(options.preventScroll,true);document.activeElement=this;const event={target:this,stopImmediatePropagation(){this.stopped=true;}};for(const fn of listeners.get('focusin')||[]){fn(event);if(event.stopped)break;}}
}
const dispatch=(type,extra={})=>{const event={type,target:document.activeElement,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const fn of listeners.get(type)||[]){fn(event);if(event.stopped)break;}return event;};
try{
 const title=new Node('title',null,-1),titleButton=new Node('theme',title),page=new Node('page',null,-1),pageLink=new Node('page link',page),dialog=new Node('modal',null,-1),first=new Node('wrap',dialog),last=new Node('close',dialog),child=new Node('nonmodal child',null,-1),childLink=new Node('child link',child),disabled=new Node('disabled',dialog),hidden=new Node('hidden',dialog),nativeInert=new Node('native inert',dialog);
 disabled.disabled=true;hidden.hidden=true;nativeInert.nativeInert=true;
 install('document',{activeElement:last,hasFocus:()=>focused,querySelectorAll:()=>nodes,addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);}});
 guard=createModalInteraction();guard.init();guard.init();assert.equal(listeners.get('focusin').length,1);
 guard.sync(dialog,[page]);assert(guard.blocked(pageLink));assert.equal(page.dataset.floatingBlocked,'');assert(!guard.blocked(titleButton));
 dispatch('keydown',{key:'Tab'});assert.equal(document.activeElement,childLink,'a child above its modal parent remains in the keyboard sequence');
 dispatch('keydown',{key:'Tab'});assert.equal(document.activeElement,titleButton,'the reserved title stays operable and Tab wraps past background, hidden and disabled controls');
 dispatch('keydown',{key:'Tab',shiftKey:true});assert.equal(document.activeElement,childLink,'Shift+Tab follows the reverse allowed-layer sequence');
 pageLink.focus({preventScroll:true});assert.equal(document.activeElement,childLink,'programmatic focus cannot enter the blocked page');
 const added=new Node('async page link',page);added.focus({preventScroll:true});assert.equal(document.activeElement,childLink,'new background controls need no tabindex rewriting or mutation walk');
 for(const type of ['pointerdown','pointerup','click','auxclick','dblclick','contextmenu','selectstart'])assert(dispatch(type,{target:added}).defaultPrevented,type+' cannot activate a lower layer');
 assert(!listeners.has('wheel'),'modal interaction never puts native wheel scrolling behind a blocking listener');
 assert(!dispatch('click',{target:titleButton}).defaultPrevented);assert(!dispatch('click',{target:childLink}).defaultPrevented);
 for(const extra of [{key:'Escape'},{key:'f',ctrlKey:true},{key:'Tab',ctrlKey:true},{key:'Tab',metaKey:true},{key:'Tab',altKey:true},{key:'Tab',isComposing:true},{key:'Tab',defaultPrevented:true}]){const event=dispatch('keydown',extra);if(!extra.defaultPrevented)assert(!event.defaultPrevented,'native UI shortcuts and composing keys are untouched');}
 focused=false;assert(!dispatch('keydown',{key:'Tab'}).defaultPrevented);focused=true;
 guard.sync(child,[page,dialog]);assert(guard.blocked(first));first.focus({preventScroll:true});assert.equal(document.activeElement,childLink,'an upper modal blocks its parent without blocking its own content');
 guard.sync(dialog,[page]);assert(!guard.blocked(first));assert(guard.blocked(page));assert(!('floatingBlocked' in dialog.dataset));
 first.tabIndex=3;last.tabIndex=2;last.focus({preventScroll:true});dispatch('keydown',{key:'Tab'});assert.equal(document.activeElement,first,'positive tabindex values retain browser ordering');first.tabIndex=last.tabIndex=0;
 const radioA=new Node('radio A',dialog),radioB=new Node('radio B',dialog);for(const node of [radioA,radioB]){node.type='radio';node.name='choice';}radioB.checked=true;
 childLink.focus({preventScroll:true});dispatch('keydown',{key:'Tab'});assert.equal(document.activeElement,radioB,'a radio group contributes its selected control to the tab sequence');
 radioB.checked=false;radioA.checked=true;childLink.focus({preventScroll:true});dispatch('keydown',{key:'Tab'});assert.equal(document.activeElement,radioA,'the radio tab stop follows keyboard selection');
 document.activeElement=dialog;dispatch('keydown',{key:'Tab'});assert.equal(document.activeElement,first,'Tab from a static focused dialog goes to the next control');
 guard.sync(null,[]);assert(!guard.blocked(pageLink));assert(!('floatingBlocked' in page.dataset));assert(!dispatch('keydown',{key:'Tab'}).defaultPrevented);pageLink.focus({preventScroll:true});assert.equal(document.activeElement,pageLink,'background focus resumes immediately on detach');
 assert.equal(pageLink.tabIndex,0);assert.equal(added.tabIndex,0,'background tab indices are never changed');assert(nativeInert.nativeInert);
 console.log('Modal interaction preserves layer-aware Tab, reverse Tab, focus guards, dynamic content, pointer barriers and native UI shortcuts without native inert writes.');
}finally{for(const[name,descriptor]of globals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
