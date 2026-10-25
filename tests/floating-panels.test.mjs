import assert from 'node:assert/strict';
import {floatingLayer,registerFloatingPanel,raiseFloatingPanel} from '../src/scripts/floating-panels.js';
const saved=new Map(),events=new Map(),windowEvents=new Map(),closed=[];
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
class Panel{
 constructor(name,layer,persistent=false){this.name=name;this.dataset=layer===undefined?{}:{floatingLayer:String(layer)};this.persistent=persistent;this.hidden=false;this.tagName=name==='code'?'DIALOG':'DIV';this.open=true;}
 closest(){return this.dataset.floatingLayer===undefined?null:this;}
 hasAttribute(name){return name==='data-floating-persistent'&&this.persistent;}
 addEventListener(){}
}
const title=new Panel('title','title',true),code=new Panel('code',70),note=new Panel('note',85),editor=new Panel('editor',200),page=new Panel('page'),directory=new Panel('directory'),future=new Panel('future',300);
const stack=[title,code,note,editor];
const reset=()=>{closed.length=0;for(const panel of stack){panel.hidden=false;panel.open=true;}future.hidden=true;};
const click=(target,expected)=>{reset();events.get('pointerdown')({target});assert.deepEqual(closed,expected,target.name+': only higher layers close');};
try{
 install('Element',Panel);install('document',{addEventListener:(type,fn)=>events.set(type,fn)});install('addEventListener',(type,fn)=>windowEvents.set(type,fn));
 for(const panel of stack)registerFloatingPanel(panel,()=>{closed.push(panel.name);panel.hidden=true;panel.open=false;});
 assert.equal(floatingLayer(title),Infinity);assert.equal(floatingLayer(page),0);
 click(editor,[]);click(note,['editor']);click(code,['editor','note']);click(title,[]);click(page,['editor','note','code']);click(directory,['editor','note','code']);
 reset();const escape=()=>windowEvents.get('keydown')({key:'Escape',preventDefault(){},stopPropagation(){}});
 const nativeEvent={key:'f',ctrlKey:true,preventDefault(){throw Error('native find must remain available');},stopPropagation(){throw Error('native find must remain available');}};
 windowEvents.get('keydown')(nativeEvent);escape();assert.deepEqual(closed,[],'fallback also yields Escape to native search');
 windowEvents.get('keyup')({key:'Escape'});assert.deepEqual(closed,[],'keyup does not close a panel');
 escape();assert.deepEqual(closed,['editor']);escape();assert.deepEqual(closed,['editor','note']);escape();assert.deepEqual(closed,['editor','note','code']);escape();assert(!title.hidden,'the persistent title is never closed');
 registerFloatingPanel(future,()=>{closed.push('future');future.hidden=true;});reset();future.hidden=false;
 events.get('pointerdown')({target:note});assert.deepEqual(closed,['future','editor'],'new higher panels use the same rule without component-specific logic');
 reset();future.hidden=false;events.get('pointerdown')({target:title});assert.deepEqual(closed,[],'title stays highest when future layers are added');
 reset();for(const panel of stack)if(panel!==title)panel.hidden=true;future.hidden=true;
 const detached=new Panel('detached',60),otherDetached=new Panel('other-detached',60);
 for(const panel of [detached,otherDetached]){panel.dataset.floatingDismiss='explicit';registerFloatingPanel(panel,()=>{closed.push(panel.name);panel.hidden=true;});}
 events.get('pointerdown')({target:page});assert.deepEqual(closed,[],'non-modal viewers remain while the page is used');
 raiseFloatingPanel(detached);escape();assert.deepEqual(closed,['detached'],'Escape closes the raised non-modal viewer first');
 escape();assert.deepEqual(closed,['detached','other-detached']);
 closed.length=0;code.hidden=false;code.open=true;code.dataset.floatingDismiss='explicit';
 events.get('pointerdown')({target:page});assert.deepEqual(closed,[],'modal viewers also ignore background dismissal');
 escape();assert.deepEqual(closed,['code'],'explicit dismissal still supports Escape');
 console.log('Floating layers close only higher panels; page, title, Escape, and future panels follow one policy');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
