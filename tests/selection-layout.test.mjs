import assert from 'node:assert/strict';
import {initSelection,retainSelection,releaseSelection} from '../src/lib/selection.js';

const listeners=new Map(),classes=new Set(),saved=new Map();
let currentRange,collapsed=false,constructed=0;
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
const range=(region)=>({
 commonAncestorContainer:{nodeType:1,closest:()=>region==='editor'?{}:null},
 startContainer:{region,offset:'start'},startOffset:1,endContainer:{region,offset:'end'},endOffset:9,
 cloneRange(){return {...this};},getClientRects(){throw Error('Selection rendering must not measure layout');},
});
try{
 install('CSS',{highlights:new Map()});
 install('Highlight',class{constructor(...ranges){this.ranges=ranges;constructed++;}});
 install('document',{documentElement:{classList:{toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}},addEventListener:(type,fn)=>listeners.set(type,fn)});
 install('getSelection',()=>({rangeCount:currentRange?1:0,isCollapsed:collapsed,getRangeAt:()=>currentRange}));
 install('addEventListener',type=>listeners.set(type,()=>{}));
 install('getComputedStyle',()=>{throw Error('Selection rendering must not measure layout');});
 initSelection();
 for(const region of ['article','code with notes','formula with notes','note float panel','float panel to article','article to header']){
  currentRange=range(region);listeners.get('selectionchange')();
  const visible=CSS.highlights.get('reader-selection'),before=constructed;
  assert(classes.has('selection-painted'),region+': browser highlight is visible during ordinary selection');
  assert.equal(visible.ranges.length,1,region+': the original range remains intact');
  assert.equal(visible.ranges[0].startContainer,currentRange.startContainer);
  assert.equal(visible.ranges[0].endContainer,currentRange.endContainer);
  retainSelection(currentRange.cloneRange());
  assert.equal(CSS.highlights.get('reader-selection'),visible,region+': entering annotation keeps the exact existing browser highlight');
  assert.equal(constructed,before,region+': entering annotation does not rebuild highlighting');
  currentRange=range('editor');listeners.get('selectionchange')();
  assert.equal(CSS.highlights.get('reader-selection'),visible,region+': editor focus leaves retained highlighting untouched');
  releaseSelection();assert.equal(CSS.highlights.size,0);assert(!classes.has('selection-painted'));
 }
 currentRange=range('article');retainSelection(currentRange);
 assert.equal(CSS.highlights.get('reader-selection').ranges[0].startContainer,currentRange.startContainer,'preselected text works before a selectionchange event');
 releaseSelection();currentRange=range('editor');listeners.get('selectionchange')();assert.equal(CSS.highlights.size,0,'editing text keeps its normal browser selection');
 currentRange=range('article');listeners.get('selectionchange')();collapsed=true;listeners.get('selectionchange')();assert.equal(CSS.highlights.size,0,'collapsed selection clears highlighting');
 assert(!listeners.has('resize'),'the browser tracks layout without custom resize painting');
 assert(!listeners.has('wheel'),'native Ctrl+wheel remains untouched');
 console.log('Ordinary, cross-region, and retained selections share one browser highlight without layout measurement');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
