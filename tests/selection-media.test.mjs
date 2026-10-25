import assert from 'node:assert/strict';
import test from 'node:test';
import {selectionPaintRanges} from '../src/lib/selection-paint.js';
import {initSelection,retainSelection,releaseSelection} from '../src/lib/selection.js';

const media=(tag,start,end,parent=null)=>({tag,start,end,parent,matches:selector=>selector.split(',').includes(tag),contains(node){for(let current=node;current;current=current.parent)if(current===this)return true;return false;}});
const root=(elements=[])=>({nodeType:1,matches:()=>false,closest:()=>null,querySelectorAll:selector=>elements.filter(element=>element.matches(selector))});
class SelectionRange{
 constructor(parent,start=0,end=100){this.commonAncestorContainer=parent;this.startContainer=parent;this.endContainer=parent;this.startOffset=start;this.endOffset=end;}
 get collapsed(){return this.startOffset===this.endOffset;}
 cloneRange(){return new SelectionRange(this.commonAncestorContainer,this.startOffset,this.endOffset);}
 intersectsNode(node){return this.startOffset<node.end&&this.endOffset>node.start;}
 setEndBefore(node){this.endOffset=node.start;if(this.endOffset<this.startOffset)this.startOffset=this.endOffset;}
 setStartAfter(node){this.startOffset=node.end;if(this.startOffset>this.endOffset)this.endOffset=this.startOffset;}
 getClientRects(){throw Error('Media exclusion never measures selection geometry');}
}
const spans=range=>selectionPaintRanges(range).map(piece=>[piece.startOffset,piece.endOffset]);

test('only paint ranges skip images; the original selection and clipboard span stay intact',()=>{
 const image=media('img',30,50),range=new SelectionRange(root([image]));
 assert.deepEqual(spans(range),[[0,30],[50,100]]);
 assert.deepEqual([range.startOffset,range.endOffset],[0,100]);assert(range.intersectsNode(image),'the real range still includes the original image for normal copy operations');
});

test('images at selection edges and nested picture content do not leak back into painting',()=>{
 const picture=media('picture',30,70),image=media('img',40,60,picture),parent=root([picture,image]);
 assert.deepEqual(spans(new SelectionRange(parent)),[[0,30],[70,100]]);
 assert.deepEqual(spans(new SelectionRange(root([image]),45,100)),[[60,100]]);
 assert.deepEqual(spans(new SelectionRange(root([image]),0,45)),[[0,40]]);
 assert.deepEqual(spans(new SelectionRange(root([image]),40,60)),[]);
 const adjacent=root([media('img',20,40),media('canvas',40,70)]);
 assert.deepEqual(spans(new SelectionRange(adjacent)),[[0,20],[70,100]],'adjacent media never introduce an empty painted range');
});

test('text-only and KaTeX selections retain the original single-range path',()=>{
 const range=new SelectionRange(root([media('svg',20,40)]));
 assert.equal(selectionPaintRanges(range)[0],range,'inline formula SVG is not treated as a replaced image');
 const outside=new SelectionRange(root([media('img',70,80)]),0,50);
 assert.equal(selectionPaintRanges(outside)[0],outside);
});

test('ordinary and retained annotation selection share the same image-free highlight',()=>{
 const originals=new Map(),install=(name,value)=>{originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});},events=new Map();let constructed=0;
 const image=media('img',30,50),range=new SelectionRange(root([image])),selection={rangeCount:1,isCollapsed:false,getRangeAt:()=>range,removeAllRanges(){throw Error('native Selection must remain untouched');},addRange(){throw Error('native Selection must remain untouched');}};
 try{
  install('CSS',{highlights:new Map()});install('Highlight',class{constructor(...ranges){this.ranges=ranges;constructed++;}});
  install('document',{documentElement:{classList:{toggle(){}}},addEventListener:(type,fn)=>events.set(type,fn)});install('getSelection',()=>selection);
  initSelection();events.get('selectionchange')();const painted=CSS.highlights.get('reader-selection');
  assert.deepEqual(painted.ranges.map(piece=>[piece.startOffset,piece.endOffset]),[[0,30],[50,100]]);
  const count=constructed;retainSelection(range);assert.equal(CSS.highlights.get('reader-selection'),painted);assert.equal(constructed,count,'opening an annotation editor does not repaint a different region');
  events.get('selectionchange')();assert.equal(CSS.highlights.get('reader-selection'),painted);assert.equal(selection.getRangeAt(0),range);
  releaseSelection();assert.equal(CSS.highlights.size,0);
 }finally{for(const [name,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
});
