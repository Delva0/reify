import assert from 'node:assert/strict';
import test from 'node:test';
import {
 floatingLayer,floatingParent,floatingBlocked,registerFloatingPanel,unregisterFloatingPanel,
 setFloatingParent,setFloatingModal,raiseFloatingPanel
} from '../dist/scripts/floating-panels.js';

const globals=new Map();
const install=(name,value)=>{globals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
class Element{
 constructor(name,tag='DIV'){this.name=name;this.id=name;this.tagName=tag;this.dataset={};this.style={};this.attributes=new Map();this.listeners=new Map();this.children=[];this.hidden=false;this.open=true;this.inert=false;}
 setAttribute(name,value){this.attributes.set(name,String(value));}
 hasAttribute(name){return this.attributes.has(name);}
 getAttribute(name){return this.attributes.get(name)??null;}
 removeAttribute(name){this.attributes.delete(name);}
 addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(listener);}
 removeEventListener(type,listener){this.listeners.set(type,(this.listeners.get(type)||[]).filter(value=>value!==listener));}
 dispatchEvent(event){if(!event.target)Object.defineProperty(event,'target',{value:this});for(const listener of this.listeners.get(event.type)||[])listener(event);return true;}
 append(node){node.remove();this.children.push(node);node.parentElement=this;}
 remove(){if(this.parentElement){const siblings=this.parentElement.children;siblings.splice(siblings.indexOf(this),1);this.parentElement=null;}}
 closest(selector){for(let node=this;node;node=node.parentElement){if(selector==='[data-floating-panel]'&&node.hasAttribute(selector.slice(1,-1)))return node;if(selector==='[data-floating-layer]'&&node.dataset.floatingLayer!==undefined)return node;}return null;}
 contains(node){for(let current=node;current;current=current.parentElement)if(current===this)return true;return false;}
}

test('floating panels preserve their partial-order, dismissal and modal invariants',async t=>{
 const body=new Element('body'),page=new Element('page'),left=new Element('directory'),right=new Element('files'),events=new Map(),live=new Set(),closed=[];
 left.inert=true;
 const document={body,querySelectorAll:()=>[page,left,right],createElement:tag=>new Element(tag,tag.toUpperCase()),addEventListener:(type,listener)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(listener);},dispatchEvent(event){for(const listener of events.get(event.type)||[])listener(event);}};
 const pointer=target=>{for(const listener of events.get('pointerdown')||[])listener({type:'pointerdown',target,button:0});};
 const backdrops=()=>body.children.filter(node=>node.className==='floating-backdrop'&&!node.hidden);
 let counter=0;
 const make=(name,{parent,priority,modal=false,explicit=false,onChange,onBackdrop}={})=>{
  const panel=new Element(name||'panel-'+(++counter));panel.setAttribute('data-floating-panel','');panel.dataset.fpSessionId=panel.id;panel.dataset.modal=String(modal);
  if(explicit)panel.dataset.floatingDismiss='explicit';if(priority==='title')panel.setAttribute('data-floating-persistent','');
  body.append(panel);live.add(panel);
  registerFloatingPanel(panel,()=>{closed.push(panel.name);panel.hidden=true;unregisterFloatingPanel(panel);live.delete(panel);panel.remove();},{parent,priority,onChange,onBackdrop});
  return panel;
 };
 const clean=()=>{for(const panel of [...live]){unregisterFloatingPanel(panel);panel.remove();}live.clear();closed.length=0;assert.equal(backdrops().length,0);};
 try{
  install('Element',Element);install('document',document);install('addEventListener',()=>{});
  install('MutationObserver',class{observe(){}disconnect(){}});install('CloseWatcher',undefined);

  await t.test('reserved title and editor strata stay above ordinary descendants',()=>{
   const title=make('title',{priority:'title'}),editor=make('editor',{priority:'editor'}),root=make('root'),child=make('child',{parent:root}),later=make('later');
   for(const panel of [root,child,later])assert(floatingLayer(panel)<floatingLayer(editor));
   assert(floatingLayer(editor)<floatingLayer(title));assert(floatingLayer(child)>floatingLayer(root));
   raiseFloatingPanel(root);raiseFloatingPanel(child);raiseFloatingPanel(later);
   assert(floatingLayer(root)<floatingLayer(child));assert(floatingLayer(later)<floatingLayer(editor));assert(floatingLayer(editor)<floatingLayer(title));
   const titleSource=make('from-title',{parent:title}),editorSource=make('from-editor',{parent:editor});
   assert(floatingLayer(titleSource)<floatingLayer(editor),'source identity does not promote content into the reserved strata');
   assert(floatingLayer(editorSource)<floatingLayer(editor));clean();
  });

  await t.test('detaching the child leaves it above its modal parent and backdrop',()=>{
   const title=make('title',{priority:'title'}),a=make('a',{modal:true,explicit:true}),b=make('b',{parent:a,modal:true,explicit:true});
   assert.equal(backdrops().length,2);assert(floatingBlocked(page));assert(floatingBlocked(a));assert(!floatingBlocked(b));assert(!floatingBlocked(title));
   const before=[floatingLayer(a),floatingLayer(b)];setFloatingModal(b,false);
   assert.deepEqual([floatingLayer(a),floatingLayer(b)],before,'mode does not determine order');
   assert.equal(floatingParent(b),a);assert.equal(backdrops().length,1);assert(floatingLayer(b)>floatingLayer(a));
   assert(floatingLayer(b)>Number(backdrops()[0].style.zIndex));assert(floatingBlocked(page));assert(!floatingBlocked(a));assert(!floatingBlocked(b));
   const content=new Element('child-content');b.append(content);pointer(content);pointer(a);
   assert(live.has(b));assert(floatingLayer(b)>floatingLayer(a));assert(!floatingBlocked(b),'focusing the parent does not bury or disable its detached child');
   setFloatingModal(b,true);assert.equal(backdrops().length,2);setFloatingModal(b,false);setFloatingModal(a,false);
   assert.equal(backdrops().length,0);assert(!floatingBlocked(page));assert(left.inert,'pre-existing inert state is preserved');clean();
  });

  await t.test('detaching releases background interaction without rewriting native inert',()=>{
   let value=page.inert,writes=0;Object.defineProperty(page,'inert',{configurable:true,get:()=>value,set:next=>{value=next;writes++;}});
   const a=make('dragged',{modal:true,explicit:true});assert(floatingBlocked(page));
   pointer(a);raiseFloatingPanel(a);assert.equal(writes,0,'modal layers never invalidate the native inert accessibility subtree');
   document.dispatchEvent({type:'paneldragstart',target:a});setFloatingModal(a,false);
   assert.equal(backdrops().length,0);assert.equal(a.dataset.modal,'false');assert(!floatingBlocked(page),'background activation is immediate, without deferred inert work on release');
   document.dispatchEvent({type:'paneldragend',target:a});assert.equal(writes,0);assert(left.inert,'pre-existing inert state survives drag release');
   setFloatingModal(a,true);document.dispatchEvent({type:'paneldragstart',target:a});assert(floatingBlocked(page));
   unregisterFloatingPanel(a);live.delete(a);a.remove();assert(!floatingBlocked(page),'closing a captured panel cannot leave the background disabled');
   clean();Object.defineProperty(page,'inert',{configurable:true,writable:true,value:false});
  });

  await t.test('each modal owns the backdrop immediately below its own layer',()=>{
   const a=make('modal-a',{modal:true}),b=make('modal-b',{parent:a,modal:true});
   assert.deepEqual(backdrops().map(node=>Number(node.style.zIndex)).sort((x,y)=>x-y),[floatingLayer(a)-1,floatingLayer(b)-1]);
   const upper=backdrops().find(node=>Number(node.style.zIndex)===floatingLayer(b)-1);
   upper.dispatchEvent({type:'click',button:0});assert.equal(b.dataset.modal,'false');assert.equal(a.dataset.modal,'true');assert.equal(backdrops().length,1);
   assert(floatingLayer(b)>floatingLayer(a));clean();
  });

  await t.test('focusing x closes only higher temporary panels',()=>{
   const title=make('title',{priority:'title'}),a=make('a',{explicit:true}),b=make('b',{parent:a,explicit:true}),note=make('note',{parent:b}),editor=make('editor',{parent:note,priority:'editor'});
   pointer(note);assert.deepEqual(closed,['editor']);assert(live.has(a)&&live.has(b)&&live.has(note));
   pointer(a);assert.deepEqual(closed,['editor','note']);assert(live.has(b),'an explicit child stays above its focused parent');assert(floatingLayer(b)>floatingLayer(a));
   pointer(title);assert.deepEqual(closed,['editor','note']);assert(live.has(a)&&live.has(b));
   const another=make('another-note',{parent:b});pointer(page);assert(closed.includes(another.name));assert(live.has(a)&&live.has(b));clean();
  });

  await t.test('cycles are rejected and closing a parent reparents surviving children',()=>{
   const grand=make('grand'),parent=make('parent',{parent:grand}),child=make('child',{parent});
   setFloatingParent(grand,child);assert.equal(floatingParent(grand),null,'a descendant cannot become its ancestor');
   setFloatingParent(parent,parent);assert.equal(floatingParent(parent),grand,'self-parenting leaves the existing edge intact');
   unregisterFloatingPanel(parent);live.delete(parent);parent.remove();
   assert.equal(floatingParent(child),grand);assert(floatingLayer(child)>floatingLayer(grand));assert.equal(child.dataset.floatingParent,grand.dataset.fpSessionId);
   clean();
  });

  await t.test('layer changes notify session persistence',()=>{
   let changes=0;const parent=make('parent'),child=make('child',{modal:true,parent,onChange:()=>changes++});
   let before=changes;raiseFloatingPanel(child);assert(changes>before,'focus order changes are observable');
   before=changes;setFloatingModal(child,false);assert(changes>before,'mode changes are observable');
   before=changes;setFloatingParent(child,null);assert(changes>before,'parent changes are observable');clean();
  });

  await t.test('many forests retain parent dominance through focus and mode permutations',()=>{
   let seed=197;const next=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};
   for(let graph=0;graph<8;graph++){
    const nodes=[];
    for(let index=0;index<12;index++)nodes.push(make('g'+graph+'-'+index,{parent:index&&next(4)!==0?nodes[next(index)]:null,explicit:true}));
    for(let step=0;step<80;step++){
     const node=nodes[next(nodes.length)];if(next(2))raiseFloatingPanel(node);else setFloatingModal(node,next(2)===1);
     const layers=nodes.map(floatingLayer);assert.equal(new Set(layers).size,nodes.length,'normal panels occupy a strict total extension of the forest');
     for(const child of nodes){const parent=floatingParent(child);if(parent)assert(floatingLayer(child)>floatingLayer(parent),'every forest edge remains increasing');}
    }
    clean();
   }
  });
 }finally{
  clean();for(const [name,descriptor]of globals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
 }
});
