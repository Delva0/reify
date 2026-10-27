import assert from 'node:assert/strict';
import {mountDocumentView,unmountDocumentView,documentRangeTarget,documentViewState,restoreDocumentViewState,registerDocumentPageLoader,cloneDocumentView,navigateDocumentAnchor} from '../dist/scripts/document-view.js';
import {articleCodeBlock} from '../dist/scripts/article-pages.js';
import {positionArticleDocument} from '../dist/scripts/link-panels.js';

const saved=new Map(),stats={sourceQueries:0,lineReads:0,parsed:0},events=[],observers=[],resizeHandlers=new Set(),widthStyles=new Map(),handleListeners=new Map();
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
const definitions=[
 {html:'<section data-test-page="first"></section>',href:'first.html',lines:[1,10,20],nested:[45]},
 {html:'<section data-test-page="second"></section>',href:'second.html',lines:[100,102,110],nested:[120]},
];
const payload={pages:definitions.map(({html,href})=>({html,href})),anchors:{'second-block':'second.html','stable-second':'second.html','core-modes':'second.html','first-anchor':'first.html'}};
function sourceNode(line,owner,parent){
 const dataset={};
 for(const key of ['mdxLine','mdxEndLine'])Object.defineProperty(dataset,key,{get(){stats.lineReads++;return String(line);}});
 return {dataset,parentElement:parent,closest:selector=>selector==='[data-file-document]'?owner:null,getBoundingClientRect:()=>({top:line*10,bottom:line*10+10,height:10})};
}
const handle={setAttribute(){},addEventListener:(type,handler)=>handleListeners.set(type,handler),removeEventListener:type=>handleListeners.delete(type)},outline={querySelector:()=>handle,classList:{remove(){}}};
const listeners=new Map(),view={
 dataset:{documentData:JSON.stringify(payload)},
 clientWidth:720,style:{setProperty:(key,value)=>widthStyles.set(key,value)},
 querySelector:selector=>selector==='[data-document-content]'?article:selector===':scope > .document-outline'?outline:null,
 querySelectorAll:()=>[],
 addEventListener(type,handler){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(handler);},
 removeEventListener(type,handler){listeners.get(type)?.delete(handler);},
 dispatchEvent:event=>events.push(event.type),
};
const canvas={style:{setProperty(name,value){this[name]=value;}},getBoundingClientRect:()=>({top:0})},frames=new Map();let frame=0;
const article={
 scrollTop:0,
 set innerHTML(html){this.select(definitions.find(page=>html.includes(page.html)));},
 select(page){this.nodes=page.lines.map(line=>sourceNode(line,view,this));this.nested=page.nested.map(line=>sourceNode(line,{},this));},
 querySelectorAll(selector){if(selector==='[data-mdx-line]'){stats.sourceQueries++;return [...this.nodes,...this.nested];}return [];},
 getBoundingClientRect:()=>({top:100}),
 querySelector(selector){
  if(selector===':scope > .document')return canvas;
  if(selector==='#core-modes'&&this.nodes[0].dataset.mdxLine==='100')return {getBoundingClientRect:()=>({top:700-this.scrollTop})};
  if(selector==='#first-anchor'&&this.nodes[0].dataset.mdxLine==='1')return {getBoundingClientRect:()=>({top:350-this.scrollTop})};
  return null;
 },
};
article.select(definitions[0]);
const secondBlock={dataset:{codeReference:'stable-second'},matches:selector=>selector==='.code-block,template[data-code-definition]'};
try{
 install('document',{getElementById:()=>null,querySelector:()=>null});
 install('CSS',{escape:value=>value});
 install('addEventListener',(type,handler)=>{if(type==='resize')resizeHandlers.add(handler);});
 install('removeEventListener',(type,handler)=>{if(type==='resize')resizeHandlers.delete(handler);});
 install('ResizeObserver',class{constructor(callback){this.callback=callback;observers.push(this);}observe(target){this.target=target;}disconnect(){this.disconnected=true;}});
 install('CustomEvent',class{constructor(type){this.type=type;}});
 install('requestAnimationFrame',fn=>{frames.set(++frame,fn);return frame;});install('cancelAnimationFrame',id=>frames.delete(id));
 install('DOMParser',class{parseFromString(html){
  stats.parsed++;const page=definitions.find(page=>page.html===html);
  return {
   querySelectorAll:selector=>selector==='[data-mdx-line]'?[...page.lines.map(line=>sourceNode(line,null)),...page.nested.map(line=>sourceNode(line,{}))]:selector==='[data-code-reference]'&&page===definitions[1]?[secondBlock]:[],
   getElementById:id=>page===definitions[1]&&id==='second-block'?secondBlock:null,
  };
 }});
 mountDocumentView(view,null,[{from:10,to:10,color:'yellow'}]);
 assert.equal(widthStyles.get('--tree-width'),'220px');assert.equal(observers[0].target,view,'the outline observes its owning viewer size');
 view.clientWidth=400;observers[0].callback();assert.equal(widthStyles.get('--tree-width'),'144px','narrow viewers retain room for document content');
 view.clientWidth=720;observers[0].callback();assert.equal(widthStyles.get('--tree-width'),'220px');
 assert.equal(stats.sourceQueries,1,'the visible page is indexed once during hydration');
 assert.equal(stats.parsed,0,'mounting does not parse every inactive H1 page');
 for(const fn of frames.values())fn();frames.clear();
 assert(canvas.style['--document-range-background'].includes('100px,var(--source-mark) 100px,var(--source-mark) 110px'),'range decoration paints the shared source index as one background');
 const first=article.nodes[1],reads=stats.lineReads;
 for(let i=0;i<1000;i++){
  assert.equal(documentRangeTarget(view,{from:10,to:10}),first);
  assert.equal(documentRangeTarget(view,{from:102,to:102}),null,'ranges on other H1 pages never fall back to the current last paragraph');
  assert.equal(documentRangeTarget(view,{from:45,to:45}),null,'nested document locations do not belong to their parent document');
 }
 assert.equal(stats.sourceQueries,1,'repeated range lookup never rescans the article subtree');
 assert.equal(stats.lineReads,reads,'repeated range lookup never rereads source metadata');
 assert.equal(stats.parsed,0,'reading and scroll tracking do not parse inactive pages');
 assert.equal(await articleCodeBlock('second-block'),secondBlock,'inactive code definitions resolve directly from their owning page');
 assert.equal(await articleCodeBlock('stable-second'),secondBlock,'canonical code references resolve independently of their unique DOM ids');
 assert.equal(stats.parsed,1,'block resolution parses only its owning H1 page');
 article.scrollTop=78;
 const second=documentRangeTarget(view,{from:102,to:102},true);
 assert.equal(second,article.nodes[1]);assert.notEqual(second,first);
 assert.equal(article.scrollTop,0);assert.equal(stats.sourceQueries,2);assert.equal(stats.parsed,1,'range navigation reuses the parsed page');
 assert.equal(documentRangeTarget(view,{from:10,to:10}),null,'switching H1 pages invalidates cached live targets');
 assert.equal(documentRangeTarget(view,{from:120,to:120}),null,'nested source metadata is excluded on newly hydrated pages');
 article.scrollTop=35;
 assert.equal(documentRangeTarget(view,{from:10,to:10},true),article.nodes[1]);
 assert.equal(article.scrollTop,78,'H1 navigation restores each page scroll position');
 assert.equal(stats.parsed,1,'navigating back uses the existing source index rather than parsing the initial page');
 assert.deepEqual(events,['documentpagechange','documentpagechange']);
 const queries=stats.sourceQueries;
 for(let i=0;i<100;i++)assert.equal(documentRangeTarget(view,{from:10,to:10},true),article.nodes[1]);
 assert.equal(stats.sourceQueries,queries,'repeated navigation to the current range does not rehydrate the page');
 assert.equal(documentRangeTarget(view,{from:999,to:999},true),article.nodes.at(-1),'explicit navigation may fall back to the nearest available location');
 assert.equal(documentRangeTarget(view,{from:999,to:999}),null,'the navigation fallback never contaminates scroll tracking');
 assert.equal(stats.parsed,1);
 unmountDocumentView(view);
 assert.equal(documentRangeTarget(view,{from:10,to:10}),undefined);
 assert.equal(listeners.get('click').size,0,'unmount releases the view listener');
 assert.equal(handleListeners.size,0);assert.equal(resizeHandlers.size,0);assert(observers[0].disconnected,'unmount disposes the shared outline width controller');
 assert.equal(await articleCodeBlock('second-block'),null,'unmount releases inactive block definitions');
 mountDocumentView(view,null);assert.equal(listeners.get('click').size,1,'remount installs one fresh click handler');
 unmountDocumentView(view);
 let resolvePage,loads=0;
 const original={cloneNode:()=>view};
 registerDocumentPageLoader(original,()=>{loads++;return new Promise(resolve=>{resolvePage=resolve;});});
 assert.equal(cloneDocumentView(original),view,'cloning preserves the lazy loader used by a fresh panel instance');
 view.dataset.documentData=JSON.stringify({...payload,pages:[payload.pages[0],{href:'second.html',url:'https://wiki.test/second.html'}]});
 article.select(definitions[0]);article.scrollTop=0;
 mountDocumentView(view,null);
 const state={page:1,scroll:[[0,78]],top:159,left:22};
 const restoring=restoreDocumentViewState(view,state);
 assert.equal(documentViewState(view),state,'snapshots preserve the requested H1 and offset while it is loading');
 assert.equal(article.nodes[0].dataset.mdxLine,'1','restoring does not paint a placeholder page');
 const lazyBlock=articleCodeBlock('stable-second');
 await Promise.resolve();assert.equal(loads,1,'restore and cross-H1 block lookup share one lazy load');
 resolvePage({html:definitions[1].html,context:{url:'https://wiki.test/second.html',title:'Second'}});await restoring;
 assert.equal(await lazyBlock,secondBlock);
 assert.equal(article.nodes[0].dataset.mdxLine,'100');assert.equal(article.scrollTop,159);assert.equal(article.scrollLeft,22);
 assert.equal(documentViewState(view).page,1);assert.equal(documentViewState(view).top,159);
 assert.equal(JSON.parse(view.dataset.readingContext).url,'https://wiki.test/second.html','lazy H1 switches carry the target article context for child panels and annotations');
 assert(await navigateDocumentAnchor(view,'core-modes'));
 assert.equal(article.scrollTop,584,'the shared anchor navigator positions an exact Section target in the document viewport');
 const panel={querySelector:()=>view};
 await positionArticleDocument(panel,{anchor:'first-anchor'},{origin:{},restore:{documents:[state]}});
 assert.equal(documentViewState(view).page,0);assert.equal(article.scrollTop,234,'a fresh explicit link hash wins over an existing reading cache');
 await positionArticleDocument(panel,{anchor:'core-modes'},{restore:{documents:[state]}});
 assert.equal(documentViewState(view).page,0);assert.equal(article.scrollTop,234,'restoring an existing session without a fresh link retains its reading position');
 unmountDocumentView(view);
 article.select(definitions[0]);article.scrollTop=0;mountDocumentView(view,null);
 const staleRestore=restoreDocumentViewState(view,{page:1,top:999,left:0});await Promise.resolve();
 await positionArticleDocument(panel,{anchor:'first-anchor'},{origin:{},restore:{documents:[state]}});
 resolvePage(definitions[1].html);await staleRestore;
 assert.equal(documentViewState(view).page,0);assert.equal(article.scrollTop,234,'a late lazy cache restore cannot overwrite the explicit link anchor');
 unmountDocumentView(view);
 console.log('Document range lookup caches current-page nodes and targets; H1 navigation stays lazy, isolated, and disposable.');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
