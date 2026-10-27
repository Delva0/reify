import assert from 'node:assert/strict';
import {initAnnotations} from '../dist/scripts/annotations.js';
import {altHeld} from '../dist/lib/alt.js';

const saved=new Map(),documentEvents=new Map(),windowEvents=new Map(),timers=new Map();
let timerId=0,underPointer;
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
const register=(map,type,fn,options)=>{if(!map.has(type))map.set(type,[]);map.get(type).push({fn,capture:options===true||options?.capture});};
const fire=(map,type,event={})=>{event={type,buttons:0,altKey:false,ctrlKey:false,metaKey:false,...event};for(const {fn}of [...map.get(type)||[]].sort((a,b)=>Number(b.capture)-Number(a.capture)))fn(event);};
class Node{
 constructor(kind,desc){this.kind=kind;this.dataset=desc?{noteDescription:desc}:{};this.attributes=new Map();this.events=new Map();this.style={};this.hidden=kind==='panel';this.id=kind==='panel'?'note-description':'';const values=new Set();this.classList={add:x=>values.add(x),remove:x=>values.delete(x),toggle:(x,on)=>on?values.add(x):values.delete(x),contains:x=>values.has(x)};}
 closest(selector){if(selector==='[data-note-description]')return this.kind==='note'?this:null;if(selector==='[data-floating-panel]')return this.kind==='panel'?this:null;return null;}
 contains(node){return node===this;}
 matches(){return underPointer===this;}
 setAttribute(name,value){this.attributes.set(name,value);}
 removeAttribute(name){this.attributes.delete(name);}
 hasAttribute(name){return this.attributes.has(name);}
 addEventListener(type,fn){register(this.events,type,fn);}
 getClientRects(){return [{left:100,top:100,right:200,bottom:120,width:100,height:20}];}
 get offsetWidth(){return 300;}get offsetHeight(){return 60;}
}
const panel=new Node('panel'),first=new Node('note','first description'),second=new Node('note','second description'),page=new Node('page'),body={append(){}};
panel.dataset.floatingLayer='85';
const key=(down,extra={})=>fire(documentEvents,down?'keydown':'keyup',{key:'Alt',target:page,altKey:down,...extra});
const over=(node,altKey=false)=>{const previous=underPointer;underPointer=node;fire(documentEvents,'pointerout',{target:previous,relatedTarget:node,altKey});fire(documentEvents,'pointerover',{target:node,relatedTarget:previous,clientX:150,clientY:110,altKey});};
const click=node=>{fire(documentEvents,'pointerdown',{target:node});fire(documentEvents,'click',{target:node});};
const flush=()=>{for(const fn of timers.values())fn();timers.clear();};
try{
 install('Element',Node);install('innerWidth',1000);install('innerHeight',800);
 install('localStorage',{getItem:()=>null,setItem(){},removeItem(){}});
 install('document',{body,documentElement:new Node('root'),activeElement:page,hidden:false,querySelector:s=>s==='#note-description'?panel:null,querySelectorAll:()=>[],elementFromPoint:()=>underPointer,addEventListener:(type,fn,options)=>register(documentEvents,type,fn,options)});
 install('addEventListener',(type,fn,options)=>register(windowEvents,type,fn,options));install('setTimeout',fn=>{timers.set(++timerId,fn);return timerId;});install('clearTimeout',id=>timers.delete(id));
 initAnnotations();
 key(true);over(first,true);assert(panel.hidden,'Alt suppresses new note hover');
 key(false);assert(!panel.hidden);assert.equal(panel.textContent,'first description','release rechecks the stationary pointer');
 const position={...panel.style};key(true);over(second,true);flush();
 assert.equal(panel.textContent,'first description','Alt holds the current transient panel while crossing other notes');assert.deepEqual(panel.style,position);assert(!panel.hasAttribute('data-pinned'),'temporary hold does not pin permanently');
 key(false);assert.equal(panel.textContent,'second description','release changes to the note under the pointer');
 key(true);over(page,true);flush();assert(!panel.hidden,'leaving the panel while holding Alt does not close it');key(false);assert(panel.hidden,'release outside closes the transient panel');
 over(first);key(true);over(panel,true);key(false);assert(!panel.hidden);assert(!panel.hasAttribute('data-pinned'),'release inside the panel keeps hover without permanent pinning');over(page);fire(panel.events,'pointerleave',{target:panel});flush();assert(panel.hidden);
 over(first);click(first);assert(panel.hasAttribute('data-pinned'));key(true);over(page,true);key(false);assert(!panel.hidden,'Alt does not unpin a deliberately pinned panel');click(page);assert(panel.hidden);
 key(true,{ctrlKey:true,getModifierState:name=>name==='AltGraph'});assert(!altHeld(),'AltGraph typing is not a pause gesture');over(first);assert(!panel.hidden);
 key(true);fire(windowEvents,'blur');assert(!altHeld());assert(panel.hidden,'window blur releases temporary state');
 key(true);over(second,false);assert(!altHeld());assert.equal(panel.textContent,'second description','pointer modifier flags recover a missed keyup');
 console.log('Alt suppresses hover, holds transient notes, rechecks on release, and preserves explicit pinning');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
