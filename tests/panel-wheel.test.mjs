import assert from 'node:assert/strict';
import {bindPanelWheel} from '../dist/scripts/panel-wheel.js';
const saved=new Map(),install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});};
let pending,reads=0,resizes=0,cancelled=0,prevented=0;const handlers=new Map();
try{
 install('requestAnimationFrame',fn=>{pending=fn;return 1;});install('cancelAnimationFrame',()=>{pending=undefined;cancelled++;});install('innerHeight',800);install('getComputedStyle',()=>({minWidth:'240px',minHeight:'51px',maxWidth:'900px',maxHeight:'600px'}));
 const panel={style:{},open:true,getBoundingClientRect(){reads++;return {width:parseFloat(this.style.width)||800,height:parseFloat(this.style.height)||500};},dispatchEvent(event){assert.equal(event.type,'panelresize');}};
 const handle={addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)};
 const stop=bindPanelWheel(panel,handle,()=>resizes++),event=(deltaY,extra={})=>({deltaY,deltaMode:0,preventDefault(){prevented++;},stopPropagation(){},...extra});
 handlers.get('wheel')(event(-100));handlers.get('wheel')(event(-100));assert.equal(reads,0,'wheel events never measure layout');assert.equal(resizes,0);pending();pending=undefined;assert.equal(reads,1);assert.equal(resizes,1);assert(parseFloat(panel.style.width)>800&&parseFloat(panel.style.height)>500);assert(parseFloat(panel.style.width)<=900&&parseFloat(panel.style.height)<=600,'wheel resize never exceeds the modal size limit');
 const width=panel.style.width;handlers.get('wheel')(event(100,{ctrlKey:true}));handlers.get('wheel')(event(100,{metaKey:true}));assert.equal(pending,undefined);assert.equal(panel.style.width,width);assert.equal(prevented,2,'browser zoom gestures are not intercepted');
 panel.style.width='241px';panel.style.height='52px';handlers.get('wheel')(event(100,{deltaMode:1}));pending();pending=undefined;assert.equal(parseFloat(panel.style.width),240);assert.equal(parseFloat(panel.style.height),51,'wheel resize honors the title-only minimum');
 handlers.get('wheel')(event(-100));stop();assert.equal(pending,undefined);assert.equal(handlers.size,0);assert(cancelled>0,'closing cancels pending resize work');
 console.log('Title wheel resize batches per frame, scales in both directions, preserves browser zoom and honors minimum size');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
