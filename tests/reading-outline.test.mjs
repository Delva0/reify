import assert from 'node:assert/strict';
import {bindReadingOutline} from '../dist/scripts/reading-outline.js';

const saved=new Map(),frames=new Map(),observers=[];let frame=0;
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
function events(){
 const listeners=new Map();return {listeners,
  addEventListener(type,fn,options){if(!listeners.has(type))listeners.set(type,new Map());listeners.get(type).set(fn,options);},
  removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
  fire(type){for(const fn of listeners.get(type)?.keys()||[])fn();},
 };
}
const flush=()=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();};
const box=(top,height)=>({top,bottom:top+height,height});
try{
 const window={...events(),scrollY:0};install('window',window);
 install('requestAnimationFrame',fn=>{frames.set(++frame,fn);return frame;});install('cancelAnimationFrame',id=>frames.delete(id));
 install('ResizeObserver',class{constructor(fn){this.fn=fn;this.targets=[];this.calls=0;observers.push(this);}observe(node){this.targets.push(node);this.calls++;}disconnect(){this.targets=[];this.disconnected=true;}});
 let headingReads=0,queries=0,outlineReads=0,linkReads=0;
 const viewport={...events(),scrollTop:0,getBoundingClientRect:()=>box(50,200)},outline={scrollTop:0,getBoundingClientRect:()=>{outlineReads++;return box(10,80);}},canvas={};
 const links=Array.from({length:128},(_,i)=>{
  const attributes=new Map();return {dataset:{heading:'h'+i},attributes,
   removeAttribute:name=>attributes.delete(name),setAttribute:(name,value)=>attributes.set(name,value),
   getBoundingClientRect:()=>{linkReads++;return box(14+i*20-outline.scrollTop,20);},
  };
 });
 const makeHeading=(id,top)=>({id,getBoundingClientRect:()=>{headingReads++;return box(50+top-viewport.scrollTop,24);}});
 let headings=links.map((link,i)=>makeHeading(link.dataset.heading,i*100));headings.push({...makeHeading('h127',1),closest:()=>({})});
 const owner=events(),article={...events(),closest:()=>owner,querySelector:()=>canvas,querySelectorAll:()=>{queries++;return headings;}};
 const controller=bindReadingOutline({article,viewport,links:()=>links,outline,offset:16});flush();
 const current=()=>links.filter(link=>link.attributes.has('aria-current'));
 assert.deepEqual(current(),[links[0]]);assert.equal(headingReads,128);assert.equal(queries,1);
 assert.deepEqual(viewport.listeners.get('scroll').values().next().value,{passive:true});
 viewport.scrollTop=350;for(let i=0;i<1000;i++)viewport.fire('scroll');assert.equal(frames.size,1,'scroll work coalesces into one frame');flush();
 assert.deepEqual(current(),[links[3]],'the nearest heading above the reading threshold is the only current link');
 assert.equal(headingReads,128,'scrolling uses cached heading offsets');assert.equal(queries,1);
 assert.equal(viewport.scrollTop,350,'revealing an outline item never scrolls document content');assert.equal(window.scrollY,0);
 viewport.scrollTop=10000;viewport.fire('scroll');flush();assert.deepEqual(current(),[links[100]]);assert(outline.scrollTop>0,'far headings reveal their own outline row');
 const reads=outlineReads+linkReads;viewport.scrollTop=10002;viewport.fire('scroll');flush();assert.equal(outlineReads+linkReads,reads,'an unchanged active heading does not read outline geometry');
 const observations=observers[0].calls;
 headings=headings.map((heading,i)=>makeHeading(heading.id,i*200));observers[0].fn();flush();assert.deepEqual(current(),[links[50]],'content resizing invalidates cached offsets');
 assert.equal(observers[0].calls,observations,'refresh does not restart unchanged ResizeObserver targets');
 headings=[makeHeading('h125',0),makeHeading('h126',100)];viewport.scrollTop=0;controller.refresh();flush();assert.deepEqual(current(),[links[125]],'an H1 page replacement refreshes headings without retaining the prior active link');
 const refreshCount=queries;for(const type of ['codewrapchange','documentmodechange','panelresize']){owner.fire(type);flush();}
 article.fire('load');flush();article.fire('readingcontentchange');flush();assert.equal(queries,refreshCount+5,'wrap, viewer resize, image and async code changes share one refresh path');
 controller.refresh();controller.dispose();assert.equal(frames.size,0);assert(observers[0].disconnected);assert.equal(viewport.listeners.get('scroll').size,0);assert.equal(owner.listeners.get('panelresize').size,0);
 viewport.fire('scroll');assert.equal(frames.size,0,'disposed documents do not retain listeners');

 let pageReads=0;const pageLinks=[0,1,2].map(i=>({dataset:{},attributes:new Map(),getAttribute:()=>'#page-'+i,removeAttribute(name){this.attributes.delete(name);},setAttribute(name,value){this.attributes.set(name,value);}}));
 const pageArticle={...events(),querySelector:()=>null,querySelectorAll:()=>pageLinks.map((_,i)=>({id:'page-'+i,getBoundingClientRect:()=>{pageReads++;return box(i*100-window.scrollY,20);}}))};
 const positions=[],page=bindReadingOutline({article:pageArticle,viewport:window,links:pageLinks,offset:()=>40,onScroll:top=>positions.push(top)});flush();
 window.scrollY=65;window.fire('scroll');flush();assert.equal(pageLinks[1].attributes.get('aria-current'),'location','page scrolling uses document-relative offsets and the header inset');assert.equal(pageReads,3);assert.deepEqual(positions,[0,65]);
 window.fire('resize');flush();assert.equal(pageReads,6);page.dispose();
 console.log('Shared reading outlines cache offsets, coalesce scrolling, reveal only their own tree and refresh after document layout changes.');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
