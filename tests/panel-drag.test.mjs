import assert from 'node:assert/strict';
import {bindPanelDrag} from '../dist/scripts/panel-drag.js';
import {panelPosition,panelResizeCorner} from '../dist/lib/panel-position.js';
const descriptors=new Map(),install=(key,value)=>{descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
const handlers=new Map(),windowHandlers=new Map(),captured=new Set(),events=[];let detaches=0,reads=0;
try{
 install('innerWidth',1280);install('innerHeight',800);
 install('document',{querySelector:()=>({getBoundingClientRect:()=>({bottom:54})})});
 install('addEventListener',(name,fn)=>windowHandlers.set(name,fn));install('removeEventListener',name=>windowHandlers.delete(name));
 const panel={dataset:{modal:'true'},open:true,style:{},dispatchEvent:event=>events.push(event.type),getBoundingClientRect:()=>{reads++;const left=parseFloat(panel.style.left)||100,top=parseFloat(panel.style.top)||80;return {left,top,width:800,height:500,right:left+800,bottom:top+500};}};
 const handle={addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name),setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
 const event=(x,y,interactive=false)=>({pointerId:1,button:0,clientX:x,clientY:y,target:{closest:()=>interactive?{}:null},preventDefault(){}});
 const unbind=bindPanelDrag(panel,handle,box=>{++detaches;assert.equal(events.at(-1),'paneldragstart','persistence is suspended before detaching');assert.equal(reads,detaches,'detaching reuses the pointerdown geometry without measuring after writes');assert.equal(panel.style.width,undefined,'dragging does not resize the modal before detaching');panel.style.width=box.width+'px';panel.style.height=box.height+'px';panel.dataset.modal='false';});
 handlers.get('pointerdown')(event(200,100,true));handlers.get('pointermove')(event(240,140));assert.equal(detaches,0,'toolbar controls never start a drag');
 handlers.get('pointerdown')(event(200,100));handlers.get('pointermove')(event(201,101));assert.equal(detaches,0,'a title click or small pointer jitter remains modal');
 handlers.get('pointermove')(event(240,140));assert.equal(detaches,1);assert.equal(panel.style.left,'140px');assert.equal(panel.style.top,'120px');assert.equal(panel.style.width,'800px');assert.equal(panel.style.height,'500px');
 handlers.get('pointermove')(event(2000,2000));assert.equal(panel.style.left,'1900px');assert.equal(panel.style.top,'1980px','right and bottom positions can leave the viewport');
 handlers.get('pointerup')(event(2000,2000));assert.equal(captured.size,0);assert.equal(panel.dataset.modal,'false','release keeps the panel detached');
 assert.deepEqual(events,['paneldragstart','panelmove','panelmove','paneldragend']);
 globalThis.innerWidth=900;globalThis.innerHeight=600;windowHandlers.get('resize')();assert.equal(panel.style.left,'1900px');assert.equal(panel.style.top,'1980px','viewport changes never pull detached panels back');
 delete panel.style.width;handlers.get('pointerdown')(event(2000,2000));handlers.get('pointermove')(event(-200,-300));handlers.get('pointerup')(event(-200,-300));assert.equal(panel.style.left,'-300px');assert.equal(panel.style.top,'34px','the pointer stops at the header, while the window retains its 20px grab offset');
 assert.deepEqual(panelPosition(-100,-100),{left:-100,top:-100});
 const corner=panel.getBoundingClientRect();
 assert.equal(panelResizeCorner(corner.right-4,corner.bottom-4,corner),true);
 assert.equal(panelResizeCorner(corner.right-20,corner.bottom-4,corner),false);
 handlers.get('pointerdown')(event(corner.right-4,corner.bottom-4));handlers.get('pointermove')(event(corner.right+40,corner.bottom+40));assert.equal(detaches,2,'the title never captures the native resize corner, even when minimized');assert.equal(captured.size,0);
 unbind();assert.equal(handlers.size,0);assert.equal(windowHandlers.size,0);
 console.log('Panel drag: threshold, toolbar exclusion, preserved geometry, viewport bounds, release and cleanup passed');
}finally{for(const [key,descriptor]of descriptors)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
