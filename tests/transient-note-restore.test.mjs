import assert from 'node:assert/strict';
import {initAnnotations} from '../dist/scripts/annotations.js';
import {transientSession,nodeReference} from '../dist/lib/transient-session.js';

const saved=new Map(),storage=new Map(),events=new Map();
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
class Node{
 constructor(){this.nodeType=1;this.childNodes=[];this.dataset={};this.style={};this.hidden=false;this.attributes=new Map();this.handlers=new Map();this.classList={add(){},remove(){},toggle(){}};}
 append(...children){for(const child of children){if(child.parentNode)child.parentNode.childNodes.splice(child.parentNode.childNodes.indexOf(child),1);child.parentNode=this;child.parentElement=this;this.childNodes.push(child);}}
 closest(selector){for(let node=this;node;node=node.parentNode)if((selector==='[data-floating-panel]'||selector==='[data-floating-layer]')&&node.floating)return node;return null;}
 setAttribute(name,value){this.attributes.set(name,value);}getAttribute(name){return this.attributes.get(name);}hasAttribute(name){return this.attributes.has(name);}removeAttribute(name){this.attributes.delete(name);}
 addEventListener(type,fn){this.handlers.set(type,fn);}contains(node){return node===this||this.childNodes.some(child=>child.contains(node));}
 getClientRects(){return [{left:100,right:200,top:100,bottom:120,width:100,height:20}];}
 get offsetHeight(){return 60;}get offsetWidth(){return 300;}
}
const body=new Node(),parent=new Node(),trigger=new Node(),description=new Node(),page=new Node();parent.floating=true;parent.dataset.fpSessionId='parent-session';trigger.dataset.noteDescription='A precise note';parent.append(trigger);body.append(parent);description.id='note-description';description.floating=true;description.hidden=true;body.dataset={repositoryName:'owner/repo',commit:'A'};let visibleParents=[parent];
const register=(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn);};
const fire=(type,event={})=>{for(const fn of events.get(type)||[])fn({type,...event});};
try{
 install('Element',Node);install('location',new URL('https://example.test/article.html'));install('innerWidth',1000);install('innerHeight',800);
 install('document',{body,documentElement:new Node(),activeElement:page,querySelector:selector=>selector==='#note-description'?description:null,querySelectorAll:selector=>selector==='[data-fp-session-id]'?visibleParents:[],addEventListener:register});
 install('addEventListener',()=>{});install('localStorage',{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)});
 const session=transientSession('note');session.write({trigger:nodeReference(trigger),geometry:{left:'73px',top:'211px',width:'300px',scrollTop:17},modal:false});
 initAnnotations();await Promise.resolve();
 assert(!description.hidden);assert(description.hasAttribute('data-pinned'));assert.equal(description.textContent,'A precise note');assert.equal(description.style.left,'73px');assert.equal(description.style.top,'211px');assert.equal(description.scrollTop,17);assert.equal(description.dataset.floatingParent,'parent-session');
 description.style.left='81px';description.style.top='201px';fire('reify:before-navigate');
 fire('sourcechange',{target:{matches:()=>true,contains:()=>true}});
 assert(description.hidden);assert.equal(session.read().geometry.left,'81px','suspending A saves its latest coordinates without clearing the old key');
 globalThis.location=new URL('https://example.test/B.html');body.dataset={repositoryName:'other/repo',commit:'B'};visibleParents=[];const sessionB=transientSession('note');
 fire('reify:after-navigate');assert(description.hidden,'B does not inherit A note');assert.equal(sessionB.read(),null);assert.equal(session.read().geometry.top,'201px');
 fire('reify:before-navigate');globalThis.location=new URL('https://example.test/article.html');body.dataset={repositoryName:'owner/repo',commit:'A'};fire('reify:after-navigate');
 assert(description.hidden,'returning to A waits until its source FP has loaded');assert.equal(session.read().geometry.left,'81px','the pending restore does not erase A');
 visibleParents=[parent];fire('fpready',{detail:{panel:parent}});
 assert(!description.hidden);assert(description.hasAttribute('data-pinned'));assert.equal(description.style.left,'81px');assert.equal(description.style.top,'201px');assert.equal(description.textContent,'A precise note');assert.equal(document.activeElement,page,'navigation restore does not take focus');assert.equal(sessionB.read(),null);
 fire('pointerdown',{target:page,altKey:false});
 assert(description.hidden);assert.equal(session.read(),null,'an explicitly closed restored note is not reopened on the next refresh');
 console.log('Pinned notes preserve page-scoped geometry across incremental A/B/A navigation, wait for their parent FP, and clear only on explicit dismissal.');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
