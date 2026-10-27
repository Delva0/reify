import assert from 'node:assert/strict';
import test from 'node:test';
import {syncCodeWrap,toggleCodeWrap} from '../dist/scripts/code-controls.js';
import {readingPosition} from '../dist/lib/reading-position.js';

test('one wrap control switches the active rendered/source view with independent state and a shared reading anchor',()=>{
 const saved=new Map(),install=(key,value)=>{saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
 class Node{
  constructor(){this.dataset={};this.attributes={};this.children=[];}
  setAttribute(name,value){this.attributes[name]=value;}append(node){this.children.push(node);}replaceChildren(...nodes){this.children=nodes;}dispatchEvent(){}
 }
 try{
  install('document',{createElementNS:()=>new Node()});
  install('CustomEvent',class extends Event{constructor(type,options){super(type,options);this.detail=options.detail;}});
  const button=new Node(),events=[],view={},root={dataset:{documentMode:'rendered'},dispatchEvent:event=>events.push(event),querySelector:selector=>selector==='[data-document-content]'?rendered:source};
  const rendered={scrollTop:900,scrollLeft:0,closest:()=>view,getBoundingClientRect:()=>({top:100}),querySelectorAll:()=>[paragraph]};
  const paragraph={dataset:{mdxLine:'10',mdxEndLine:'19'},closest:()=>view,getBoundingClientRect(){const wrapped=root.dataset.documentWrap!=='false',height=wrapped?600:100,top=100+(wrapped?600:300)-rendered.scrollTop;return {top,bottom:top+height,height};}};
  const source={scrollTop:240,scrollLeft:180,getBoundingClientRect:()=>({top:100}),querySelectorAll:selector=>selector==='.source-line'?rows:[]};
  const rows=Array.from({length:100},(_,index)=>({getBoundingClientRect(){const height=root.dataset.wrap==='true'?40:20,top=100+24+index*height-source.scrollTop;return {top,bottom:top+height,height};}}));
  const renderedEntries=[{node:paragraph,from:10,to:19}],position=readingPosition(rendered,renderedEntries);
  syncCodeWrap(button,root);assert.equal(button.hidden,false);assert.equal(button.attributes['aria-pressed'],'true');assert.equal(button.dataset.tip,'取消换行','rendered prose defaults to wrapping');
  toggleCodeWrap(button,root);assert.equal(root.dataset.documentWrap,'false');assert.equal(root.dataset.wrap,undefined);assert.equal(button.dataset.tip,'自动换行');
  assert(Math.abs(readingPosition(rendered,renderedEntries).line-position.line)<1e-8,'turning rendered wrapping off retains the same source position');
  rendered.scrollLeft=190;toggleCodeWrap(button,root);assert.equal(rendered.scrollLeft,0);assert.equal(root.dataset.documentWrap,'true');assert(Math.abs(readingPosition(rendered,renderedEntries).line-position.line)<1e-8);
  root.dataset.documentMode='source';syncCodeWrap(button,root);assert.equal(button.attributes['aria-pressed'],'false','source mode restores its own independent wrap state');
  const sourceEntries=rows.map((node,index)=>({node,from:index+1,to:index+1})),sourcePosition=readingPosition(source,sourceEntries);
  toggleCodeWrap(button,root);assert.equal(root.dataset.wrap,'true');assert.equal(root.dataset.documentWrap,'true');assert.equal(source.scrollLeft,0);assert(Math.abs(readingPosition(source,sourceEntries).line-sourcePosition.line)<1e-8);
  assert.deepEqual(events.map(event=>[event.type,event.detail]),[['codewrapchange',{rendered:true,enabled:false}],['codewrapchange',{rendered:true,enabled:true}],['codewrapchange',{rendered:false,enabled:true}]]);
 }finally{for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
});
