import assert from 'node:assert/strict';
import {toggleReaderAnnotation} from '../dist/scripts/reader-annotation.js';
import {watchAlt} from '../dist/lib/alt.js';

const saved=new Map(),events=new Map();let selected=false,measurements=0;
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
const register=(type,fn,options)=>{if(!events.has(type))events.set(type,[]);events.get(type).push({fn,capture:options===true||options?.capture});};
class Node{
 constructor(own=false){this.own=own;this.nodeType=1;this.hidden=true;this.value='';this.style={};this.dataset={};this.classList={toggle(){},remove(){}};}
 closest(){return this.own?this:null;}setAttribute(){}addEventListener(){}
}
const page=new Node(),button=new Node(true),editor=new Node(true),input=new Node(true),control=new Node(true),children=new Map([['textarea',input],['.reader-annotation-kind',control],['[role=status]',control],['[data-reader-annotation-confirm]',control],['[data-reader-annotation-cancel]',control]]);
editor.querySelector=selector=>children.get(selector);
const reachedSelection=Error('normal text selection reached layout');
const range={commonAncestorContainer:page,toString:()=>selected?'selected text':'',cloneRange(){return this;},getClientRects(){measurements++;throw reachedSelection;}};
const fire=(type,extra={})=>{const event={type,target:page,key:'',button:0,buttons:0,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,...extra};for(const {fn}of [...events.get(type)||[]].sort((a,b)=>Number(b.capture)-Number(a.capture)))fn(event);};
try{
 install('Element',Node);install('document',{documentElement:page,querySelector:selector=>({'.reader-annotation-mode':button,'.reader-annotation-editor':editor}[selector]||null),addEventListener:register});
 install('localStorage',{getItem:()=>null,setItem(){},removeItem(){}});
 install('addEventListener',()=>{});install('getSelection',()=>({rangeCount:1,isCollapsed:!selected,getRangeAt:()=>range}));
 watchAlt(()=>{});toggleReaderAnnotation();selected=true;
 fire('pointerdown',{altKey:true});fire('pointerup',{altKey:true});fire('keyup',{key:'Alt'});
 assert.equal(measurements,0);assert(editor.hidden,'Alt selection leaves the editor closed after release');
 fire('pointerdown',{altKey:true});fire('keyup',{key:'Alt'});fire('pointerup');
 assert.equal(measurements,0,'releasing Alt before the mouse does not produce a delayed editor');
 fire('pointerdown');fire('keydown',{key:'Alt',altKey:true});fire('keyup',{key:'Alt'});fire('pointerup');
 assert.equal(measurements,0,'Alt pressed during the drag suppresses that selection gesture');
 fire('pointerdown',{altKey:true});fire('keyup',{key:'Alt'});fire('keydown',{key:'Shift',shiftKey:true});fire('pointerup');assert.equal(measurements,0,'Shift during the same drag cannot undo Alt suppression');
 fire('pointerdown');assert.throws(()=>fire('pointerup'),error=>error===reachedSelection,'the next ordinary selection still opens normally');assert.equal(measurements,1);
 fire('keydown',{key:'Alt',altKey:true});fire('keydown',{key:'Shift',altKey:true,shiftKey:true});fire('keydown',{key:'ArrowRight',altKey:true,shiftKey:true});fire('keyup',{key:'ArrowRight',altKey:true,shiftKey:true});fire('keyup',{key:'Alt',shiftKey:true});fire('keyup',{key:'Shift'});
 assert.equal(measurements,1,'Alt keyboard selection does not open on later Shift release');
 fire('keydown',{key:'Shift',shiftKey:true});fire('keydown',{key:'Tab',shiftKey:true});fire('keyup',{key:'Shift'});assert.equal(measurements,1,'Shift+Tab navigation does not reopen a selection editor');
 fire('keydown',{key:'Shift',shiftKey:true});fire('keydown',{key:'ArrowRight',shiftKey:true});assert.throws(()=>fire('keyup',{key:'Shift'}),error=>error===reachedSelection);assert.equal(measurements,2,'a fresh ordinary keyboard selection still works');
 toggleReaderAnnotation();selected=false;toggleReaderAnnotation();selected=true;
 fire('keydown',{key:'Alt',altKey:true});toggleReaderAnnotation();toggleReaderAnnotation(range);assert.equal(measurements,2,'entering annotation mode while Alt is held keeps plain selection');fire('keyup',{key:'Alt'});
 assert(editor.hidden);console.log('Alt pointer and keyboard selections never open or defer the reader editor; ordinary selection remains available');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
