import assert from 'node:assert/strict';
import {bindTreeWidth,initTreeWidth} from '../dist/scripts/tree-width.js';

const saved=new Map(),windowResize=new Set(),observers=[],stored=new Map([['tree-width','300'],['github-files-width','280']]);
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
function element(bounds={left:0,right:220,width:220}){
 const attributes=new Map(),styles=new Map(),listeners=new Map(),classes=new Set(),pointers=new Set();
 return {
  attributes,styles,listeners,classes,pointers,
  style:{setProperty:(name,value)=>styles.set(name,value)},
  classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},
  setAttribute:(name,value)=>attributes.set(name,value),getAttribute:name=>attributes.get(name),
  addEventListener:(type,handler)=>listeners.set(type,handler),removeEventListener:(type,handler)=>{if(listeners.get(type)===handler)listeners.delete(type);},
  setPointerCapture:id=>pointers.add(id),hasPointerCapture:id=>pointers.has(id),releasePointerCapture:id=>pointers.delete(id),
  getBoundingClientRect:()=>bounds,
  fire(type,data={}){const event={pointerId:1,preventDefault(){this.prevented=true;},...data};listeners.get(type)?.(event);return event;},
 };
}
try{
 install('addEventListener',(type,handler)=>{if(type==='resize')windowResize.add(handler);});
 install('removeEventListener',(type,handler)=>{if(type==='resize')windowResize.delete(handler);});
 install('localStorage',{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)});
 install('ResizeObserver',class{constructor(callback){this.callback=callback;observers.push(this);}observe(target){this.target=target;}disconnect(){this.disconnected=true;}});
 const tree=element({left:100,right:320,width:220}),handle=element(),view=element();view.clientWidth=720;
 const dispose=bindTreeWidth(tree,handle,{styleTarget:view,maximum:()=>view.clientWidth-256,observe:view});
 assert.equal(view.styles.get('--tree-width'),'220px');assert.equal(tree.styles.size,0,'a nested outline writes the width to its grid owner');
 assert.equal(observers[0].target,view);
 handle.fire('pointerdown');assert(tree.classes.has('is-resizing'));
 handle.fire('pointermove',{clientX:400});assert.equal(view.styles.get('--tree-width'),'300px');
 handle.fire('pointerup');assert(!tree.classes.has('is-resizing'));assert.equal(handle.pointers.size,0);
 assert.equal(stored.size,2,'document outlines do not overwrite the two page sidebar preferences');
 view.clientWidth=400;observers[0].callback();assert.equal(view.styles.get('--tree-width'),'144px');assert.equal(handle.attributes.get('aria-valuemax'),'144');
 view.clientWidth=720;observers[0].callback();assert.equal(view.styles.get('--tree-width'),'300px','expanding the viewer restores the preferred width');
 handle.fire('dblclick');assert.equal(view.styles.get('--tree-width'),'220px');
 handle.fire('keydown',{key:'ArrowLeft'});assert.equal(view.styles.get('--tree-width'),'210px');
 handle.fire('pointerdown');handle.fire('pointermove',{clientX:0});assert.equal(view.styles.get('--tree-width'),'128px');
 dispose();assert.equal(handle.listeners.size,0);assert.equal(handle.pointers.size,0);assert(!tree.classes.has('is-resizing'));assert(observers[0].disconnected);assert.equal(windowResize.size,0);

 const left=element({left:24,right:244,width:220}),right=element({left:1196,right:1416,width:220}),leftHandle=element(),rightHandle=element();
 left.querySelector=()=>leftHandle;right.querySelector=()=>rightHandle;
 const article={getBoundingClientRect:()=>({left:400,right:1040})};
 install('document',{querySelector:selector=>({'.repo-tree':left,'.github-files':right,'.document':article})[selector],documentElement:{clientWidth:1440}});
 install('getComputedStyle',()=>({left:'24px',right:'24px'}));install('matchMedia',()=>({matches:true}));install('innerWidth',1440);
 initTreeWidth();
 assert.equal(left.styles.get('--tree-width'),'300px');assert.equal(right.styles.get('--tree-width'),'280px');
 assert.equal(leftHandle.attributes.get('aria-valuemax'),'328');assert.equal(rightHandle.attributes.get('aria-valuemax'),'328');
 leftHandle.fire('pointerdown');leftHandle.fire('pointermove',{clientX:224});leftHandle.fire('pointerup');
 rightHandle.fire('pointerdown');rightHandle.fire('pointermove',{clientX:1216});rightHandle.fire('pointerup');
 assert.equal(stored.get('tree-width'),'200');assert.equal(stored.get('github-files-width'),'200','the right sidebar keeps its mirrored drag direction');
 rightHandle.fire('keydown',{key:'ArrowRight'});assert.equal(right.styles.get('--tree-width'),'190px','the right sidebar keeps its mirrored keyboard direction');
 leftHandle.fire('dblclick');assert.equal(stored.get('tree-width'),'220');
 console.log('Shared tree widths preserve page sidebar behavior and support viewer resize, nested style owners, reset, keyboard and disposal.');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
