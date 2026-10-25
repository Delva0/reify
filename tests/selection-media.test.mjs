import assert from 'node:assert/strict';
import test from 'node:test';
import {selectionPaint,selectionPaintRanges} from '../src/lib/selection-paint.js';
import {initSelection,retainSelection,releaseSelection} from '../src/lib/selection.js';

const media=(tag,start,end,parent=null)=>{const classes=new Set();return {tag,start,end,parent,classes,classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},matches:selector=>selector.split(',').includes(tag),contains(node){for(let current=node;current;current=current.parent)if(current===this)return true;return false;}};};
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
 assert.deepEqual(selectionPaint(new SelectionRange(parent)).media,[image],'picture selection outlines its rendered image exactly once');
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

test('ordinary, retained and image-only selections share image outlines without changing native Selection',()=>{
 const originals=new Map(),install=(name,value)=>{originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});},events=new Map();let constructed=0;
 const image=media('img',30,50),range=new SelectionRange(root([image]));let current=range;
 const selection={rangeCount:1,isCollapsed:false,getRangeAt:()=>current,removeAllRanges(){throw Error('native Selection must remain untouched');},addRange(){throw Error('native Selection must remain untouched');}};
 try{
  install('CSS',{highlights:new Map()});install('Highlight',class{constructor(...ranges){this.ranges=ranges;constructed++;}});
  install('document',{documentElement:{classList:{toggle(){}}},addEventListener:(type,fn)=>events.set(type,fn)});install('getSelection',()=>selection);
  initSelection();events.get('selectionchange')();const painted=CSS.highlights.get('reader-selection');
  assert.deepEqual(painted.ranges.map(piece=>[piece.startOffset,piece.endOffset]),[[0,30],[50,100]]);
  assert(image.classes.has('selection-media'),'an image included in the real selection has a visible outline');
  const count=constructed;retainSelection(range);assert.equal(CSS.highlights.get('reader-selection'),painted);assert.equal(constructed,count,'opening an annotation editor does not repaint a different region');
  selection.isCollapsed=true;events.get('selectionchange')();assert.equal(CSS.highlights.get('reader-selection'),painted);assert.equal(selection.getRangeAt(0),range);
  assert(image.classes.has('selection-media'),'retained annotation ranges keep the image outline after editor focus changes');
  releaseSelection();assert.equal(CSS.highlights.size,0);assert(!image.classes.has('selection-media'));
  selection.isCollapsed=false;current=new SelectionRange(range.commonAncestorContainer,30,50);events.get('selectionchange')();
  assert.deepEqual(CSS.highlights.get('reader-selection').ranges,[],'an image-only selection needs no text highlight');
  assert(image.classes.has('selection-media'),'an image-only range still has a visible outline');
  const other=media('img',70,90);current=new SelectionRange(root([image,other]),70,90);events.get('selectionchange')();
  assert(!image.classes.has('selection-media'));assert(other.classes.has('selection-media'),'changing the real range updates only the selected images');
  selection.isCollapsed=true;events.get('selectionchange')();assert(!other.classes.has('selection-media'));assert.equal(CSS.highlights.size,0);
 }finally{for(const [name,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
});
