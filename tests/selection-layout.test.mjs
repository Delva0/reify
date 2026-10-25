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
  const before=constructed;
  assert(!classes.has('selection-painted'),region+': ordinary dragging uses the synchronous native text selection');
  assert.equal(CSS.highlights.size,0,region+': ordinary dragging does not register an asynchronous text highlight');
  retainSelection(currentRange.cloneRange());
  const visible=CSS.highlights.get('reader-selection');
  assert(classes.has('selection-painted'),region+': entering annotation freezes the same range in one custom highlight');
  assert.equal(visible.ranges.length,1,region+': the original range remains intact');
  assert.equal(visible.ranges[0].startContainer,currentRange.startContainer);
  assert.equal(visible.ranges[0].endContainer,currentRange.endContainer);
  assert.equal(constructed,before+1,region+': even an unchanged native range gains its retained highlight');
  retainSelection(currentRange.cloneRange());assert.equal(CSS.highlights.get('reader-selection'),visible,region+': retaining an already frozen range does not rebuild it');
  currentRange=range('editor');listeners.get('selectionchange')();
  assert.equal(CSS.highlights.get('reader-selection'),visible,region+': editor focus leaves retained highlighting untouched');
  releaseSelection();assert.equal(CSS.highlights.size,0);assert(!classes.has('selection-painted'));
 }
 currentRange=range('article');retainSelection(currentRange);
 assert.equal(CSS.highlights.get('reader-selection').ranges[0].startContainer,currentRange.startContainer,'preselected text works before a selectionchange event');
 releaseSelection();currentRange=range('editor');listeners.get('selectionchange')();assert.equal(CSS.highlights.size,0,'editing text keeps its normal browser selection');
 currentRange=range('first code selection');listeners.get('selectionchange')();currentRange=range('second code selection');listeners.get('selectionchange')();
 assert.equal(CSS.highlights.size,0,'repeated ordinary selections stay native');assert(!classes.has('selection-painted'));
 currentRange=range('article');listeners.get('selectionchange')();collapsed=true;listeners.get('selectionchange')();assert.equal(CSS.highlights.size,0,'collapsed selection clears highlighting');
 assert(!listeners.has('resize'),'the browser tracks layout without custom resize painting');
 assert(!listeners.has('wheel'),'native Ctrl+wheel remains untouched');
 console.log('Ordinary text stays native; retained annotations preserve the same range with one highlight and no layout measurement');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
