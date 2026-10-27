import type {DocumentState,LineRange} from '../lib/data-types.js';
import {isRecord,errorMessage} from '../lib/data-types.js';
import {required} from '../lib/dom.js';
export interface DocumentPage {href: string; html?: string; context?: Record<string,string>; [key: string]: unknown}
export interface DocumentPayload {pages: DocumentPage[]; anchors: Record<string,string>; currentPage?: number}
export type DocumentPageLoader = (page: DocumentPage,index: number) => string | Partial<DocumentPage> | Promise<string | Partial<DocumentPage>>;
interface SourceRange {from: number; to: number}
interface SourceEntry extends SourceRange {node: HTMLElement}
interface DocumentController {target(range: LineRange,navigate: boolean): HTMLElement | null; navigateAnchor(id: string): HTMLElement | null | Promise<HTMLElement | null>; position(): {line: number} | null; restore(position: {line: number}): void; snapshot(): DocumentState; restoreState(state?: DocumentState): void | Promise<void>; data(): Partial<DocumentPayload>; release(): void}
function parsePayload(raw: string | undefined): DocumentPayload | undefined {
 try{
  const value: unknown=JSON.parse(raw||'null');if(!isRecord(value)||!Array.isArray(value.pages)||!isRecord(value.anchors)||!Object.values(value.anchors).every(item=>typeof item==='string'))return;
  const pages: DocumentPage[]=[];
  for(const page of value.pages){
   if(!isRecord(page)||typeof page.href!=='string'||page.html!==undefined&&typeof page.html!=='string')return;
   const context=isRecord(page.context)?Object.fromEntries(Object.entries(page.context).filter((entry): entry is [string,string]=>typeof entry[1]==='string')):undefined;
   pages.push({...page,href:page.href,html:page.html,context});
  }
  const anchors=Object.fromEntries(Object.entries(value.anchors).map(([id,href])=>[id,String(href)]));
  const currentPage=typeof value.currentPage==='number'&&Number.isInteger(value.currentPage)&&value.currentPage>=0&&value.currentPage<pages.length?value.currentPage:undefined;
  return {...value,pages,anchors,currentPage};
 }catch{return;}
}
import {hydrateReadingContent} from './reading-content.js';
import {registerArticleBlocks} from './article-pages.js';
import {codeBlockDefinition} from '../lib/code-block.js';
import {readingContent} from '../lib/reading-content.js';
import {readFile} from '../lib/github-files.js';
import {bindTreeWidth} from './tree-width.js';
import {readingPosition,restoreReadingPosition,sourceLineEntries,rangeBackground} from '../lib/reading-position.js';
import {syncCodeWrap} from './code-controls.js';
import {toggleTreeBranch} from './tree-branches.js';
import {bindReadingOutline} from './reading-outline.js';
const views=new WeakMap<HTMLElement,DocumentController>(),owners=new WeakSet<HTMLElement>(),pageLoaders=new WeakMap<HTMLElement,DocumentPageLoader>();
export function registerDocumentPageLoader(view: HTMLElement,loader: DocumentPageLoader){pageLoaders.set(view,loader);}
export function cloneDocumentView(view: HTMLElement){const clone=view.cloneNode(true) as HTMLElement,loader=pageLoaders.get(view),data=views.get(view)?.data();if(data)clone.dataset.documentData=JSON.stringify(data);if(loader)pageLoaders.set(clone,loader);return clone;}
async function hydrateDocumentCode(block: HTMLElement){
 if(!block.hasAttribute('data-document-code'))return;block.removeAttribute('data-document-code');
 try{
  const definition=codeBlockDefinition(block);if(!definition)throw Error('代码块定义无效');let text=definition.code;
  if(definition.src){const content=await readFile(definition.src);if(content.kind!=='text')throw Error('CodeBlock src 必须是文本文件');text=content.text;}
  if(text===undefined)throw Error('代码块缺少源码');
  const {highlightSource}=await import('../lib/source-highlight.js'),html=await highlightSource(text,definition.language),pre=new DOMParser().parseFromString(html,'text/html').querySelector<HTMLElement>('pre');
  if(!pre)throw Error('代码高亮加载失败');pre.classList.add('astro-code');const {decorateCode}=await import('./code-annotations.js');await decorateCode(pre,definition);
  if(block.isConnected){required(':scope > pre',block).replaceWith(pre);block.dispatchEvent(new Event('readingcontentchange',{bubbles:true}));}
 }catch(error){if(block.isConnected)required(':scope > pre',block).textContent=errorMessage(error);}
}
export function setDocumentMode(root: HTMLElement,rendered: boolean){
 const view=root.querySelector<HTMLElement>(':scope > [data-source-document],:scope > [data-file-document]'),pre=root.querySelector<HTMLElement>(':scope > pre'),head=root.querySelector<HTMLElement>(':scope > .code-header,:scope > .dialog-head'),button=head?.querySelector<HTMLElement>('[data-code-document]');
 if(!view||!button)return;
 const documentView=view.matches('[data-file-document]')?view:view.querySelector<HTMLElement>('[data-file-document]'),controller=documentView?views.get(documentView):undefined,previous=root.dataset.documentMode;
 const position=previous&&previous!==(rendered?'rendered':'source')?(previous==='rendered'?controller?.position():readingPosition(pre,sourceLineEntries(pre))):null;
 root.dataset.documentMode=rendered?'rendered':'source';view.hidden=!rendered;if(pre)pre.hidden=rendered;
 button.hidden=false;button.setAttribute('aria-pressed',String(!rendered));button.setAttribute('aria-label',rendered?'源码':'文档');button.dataset.tip=rendered?'源码':'文档';
 const wrap=head!.querySelector<HTMLElement>('[data-code-wrap]'),ranges=head!.querySelector<HTMLElement>('[data-code-ranges]');syncCodeWrap(wrap,root);if(ranges)ranges.hidden=root.dataset.hasRanges!=='true';
 if(position){if(rendered)controller?.restore(position);else restoreReadingPosition(pre,sourceLineEntries(pre),position);}
 root.dispatchEvent(new CustomEvent('documentmodechange',{detail:{rendered,synchronized:Boolean(position)}}));
}
export function mountDocumentView(view: HTMLElement | null | undefined,owner=view?.closest<HTMLElement>('.code-block,[data-code-viewer]'),ranges?: LineRange[]){
 if(!view||views.has(view))return;
 const selectedRanges=ranges||codeBlockDefinition(owner)?.ranges||[];
 const payload=parsePayload(view.dataset.documentData);
 const article=view.querySelector<HTMLElement>('[data-document-content]'),scrollPositions=new Map<number,number>(),parsedPages=new Map<number,Document>(),pageSources=new Map<number,SourceRange[]>(),rangePages=new Map<string,number>(),rangeTargets=new Map<string,{match: HTMLElement | null; nearest: HTMLElement | null}>(),loadingPages=new Map<number,Promise<void>>();if(!article)return;let current=payload?.currentPage||0,sources: SourceEntry[]=[],revision=0,active=true,restoringState: DocumentState | undefined;
 const pageDocument=(index: number)=>{if(!payload)return null;if(typeof payload.pages[index].html!=='string')return null;if(!parsedPages.has(index))parsedPages.set(index,new DOMParser().parseFromString(payload.pages[index].html!,'text/html'));return parsedPages.get(index)!;};
 const loadPage=(index: number)=>{if(!payload)return;
  if(typeof payload.pages[index].html==='string')return;
  if(!loadingPages.has(index)){
   const loader=pageLoaders.get(view);if(!loader)throw Error('文档章节不可用');
   loadingPages.set(index,Promise.resolve().then(()=>loader(payload.pages[index],index)).then(result=>{Object.assign(payload.pages[index],typeof result==='string'?{html:result}:result);rangePages.clear();}).finally(()=>loadingPages.delete(index)));
  }
  return loadingPages.get(index);
 };
 const source=(node: HTMLElement)=>({from:Number(node.dataset.mdxLine),to:Number(node.dataset.mdxEndLine||node.dataset.mdxLine)});
 const intersects=(source: SourceRange,range: SourceRange)=>source.from<=range.to&&source.to>=range.from;
 const release=registerArticleBlocks((id: string)=>{
  if(!payload)return null;
  const index=payload.pages.findIndex(page=>page.href===payload.anchors[id]),indices=index<0?payload.pages.keys():[index];
  const blockAt=(index: number)=>{const document=pageDocument(index),block=document?.getElementById(id)||[...document?.querySelectorAll<HTMLElement>('[data-code-reference]')||[]].find(node=>node.dataset.codeReference===id);return block?.matches('.code-block,template[data-code-definition]')?block:null;};
  if(index>=0){const loading=loadPage(index);return loading?loading.then(()=>blockAt(index)):blockAt(index);}
  for(const index of indices){const block=blockAt(index);if(block)return block;}
  return null;
 });
 const indexSources=()=>{
  sources=[...article.querySelectorAll<HTMLElement>('[data-mdx-line]')].filter(node=>node.closest('[data-file-document]')===view).map(node=>({node,...source(node)}));
  pageSources.set(current,sources.map(({from,to})=>({from,to})));rangeTargets.clear();
 };
 let rangeFrame: number | undefined;
 const markRanges=()=>{if(!selectedRanges.length||rangeFrame!==undefined)return;rangeFrame=requestAnimationFrame(()=>{rangeFrame=undefined;const canvas=article?.querySelector<HTMLElement>(':scope > .document');if(canvas)canvas.style.setProperty('--document-range-background',rangeBackground(canvas,sources,selectedRanges));});};
 const selectPage=(index: number): void | Promise<void>=>{
  if(!payload)return;
  const ticket=++revision;
  if(index===current)return;
  const show=()=>{
   if(!active||ticket!==revision)return;
   scrollPositions.set(current,article.scrollTop);for(const nested of article.querySelectorAll<HTMLElement>('[data-file-document]'))unmountDocumentView(nested);
   article.innerHTML=readingContent(payload.pages[index].html!);current=index;
   if(payload.pages[index].context)view.dataset.readingContext=JSON.stringify(payload.pages[index].context);
   hydrate();article.scrollTop=scrollPositions.get(index)||0;outlineSpy.refresh();
   view.dispatchEvent(new CustomEvent('documentpagechange',{bubbles:true}));
  };
  const loading=loadPage(index);if(loading)return loading.then(show);show();
 };
 const rangePage=(range: SourceRange,key: string)=>{
  if(!payload)return -1;
  if(!rangePages.has(key))rangePages.set(key,payload.pages.findIndex((_page,index)=>{
   if(!pageSources.has(index)){const document=pageDocument(index);if(!document)return false;pageSources.set(index,[...document.querySelectorAll<HTMLElement>('[data-mdx-line]')].filter(node=>!node.closest('[data-file-document]')).map(source));}
   return pageSources.get(index)!.some(item=>intersects(item,range));
  }));
  return rangePages.get(key)!;
 };
 const target=(range: LineRange,navigate: boolean)=>{
  if(!article)return null;const key=range.from+':'+range.to;
  if(navigate){const page=rangePage(range,key);if(page>=0)selectPage(page);}
  if(!rangeTargets.has(key)){
   const match=sources.find(item=>intersects(item,range))?.node||null;
   rangeTargets.set(key,{match,nearest:match||sources.find(item=>item.from>=range.from)?.node||sources.at(-1)?.node||null});
  }
  const cached=rangeTargets.get(key)!;return navigate?cached.nearest:cached.match;
 };
 const hydrate=()=>{if(!article)return;hydrateReadingContent(article);indexSources();markRanges();rangeObserver?.disconnect();rangeObserver?.observe(article);const canvas=article.querySelector<HTMLElement>(':scope > .document');if(canvas)rangeObserver?.observe(canvas);for(const block of article.querySelectorAll<HTMLElement>('[data-document-code]'))hydrateDocumentCode(block);for(const nested of article.querySelectorAll<HTMLElement>('[data-file-document]'))mountDocumentView(nested);outlineSpy.refresh();};
 const navigateAnchor=(id: string): HTMLElement | null | Promise<HTMLElement | null>=>{
  if(!payload)return null;
  const index=payload.pages.findIndex(page=>page.href===payload.anchors[id]);if(index<0)return null;
  // An explicit location supersedes an in-flight reading-cache restore.
  restoringState=undefined;
  const locate=()=>{
   if(!active||current!==index)return null;
   const target=article.querySelector<HTMLElement>('#'+CSS.escape(id));
   if(target)article.scrollTop=Math.max(0,article.scrollTop+target.getBoundingClientRect().top-article.getBoundingClientRect().top-16);
   outlineSpy.refresh();return target;
  };
  const loading=selectPage(index);return loading?loading.then(locate):locate();
 };
 const click=(event: MouseEvent)=>{
  if((event.target instanceof Element?(event.target as Element).closest('[data-file-document]'):null)!==view)return;
  const branch=(event.target instanceof Element?event.target.closest<HTMLElement>('.document-outline .tree-branch'):null);if(branch){toggleTreeBranch(branch,event);return;}
  const link=(event.target as Element).closest('a[href]'),href=link?.getAttribute('href');if(!payload||!href?.startsWith('#')||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
  let id;try{id=decodeURIComponent(href.slice(1));}catch{return;}if(!Object.hasOwn(payload.anchors,id))return;
  event.preventDefault();
  const loading=navigateAnchor(id);if(loading instanceof Promise)loading.catch(error=>view.dispatchEvent(new CustomEvent('documenterror',{detail:error})));
 };
 const outline=view.querySelector<HTMLElement>(':scope > .document-outline'),releaseWidth=bindTreeWidth(outline,outline?.querySelector<HTMLElement>(':scope > .tree-resize-handle'),{styleTarget:view,maximum:()=>Math.min(480,view.clientWidth-256),observe:view});
 const outlineSpy=bindReadingOutline({article,viewport:article,links:()=>view.querySelectorAll<HTMLElement>('.document-outline a[data-heading]'),outline:outline?.querySelector<HTMLElement>(':scope > .repo-tree-content'),offset:16});
 const rangeObserver=selectedRanges.length?new ResizeObserver(markRanges):null;
 if(article)rangeObserver?.observe(article);
 const restore=(position: {line: number})=>{
  const range={from:Math.floor(position.line),to:Math.ceil(position.line)};
  let page=rangePage(range,'position:'+range.from);
  if(payload&&page<0)page=payload.pages.findLastIndex((_item,index)=>pageSources.get(index)?.some(item=>item.from<=position.line));
  if(page>=0)selectPage(page);
  restoreReadingPosition(article,sources,position);
  outlineSpy.refresh();
 };
 const snapshot=()=>restoringState||({page:current,scroll:[...scrollPositions],top:article?.scrollTop||0,left:article?.scrollLeft||0});
 const restoreState=(state?: DocumentState)=>{
  if(!state)return;restoringState=state;
  if(Array.isArray(state.scroll))for(const [index,top]of state.scroll)if(Number.isInteger(index)&&Number.isFinite(top))scrollPositions.set(index,top);
  const apply=()=>{if(!active||restoringState!==state)return;if(article&&Number.isFinite(state.top))article.scrollTop=state.top;if(article&&Number.isFinite(state.left))article.scrollLeft=state.left;restoringState=undefined;outlineSpy.refresh();};
  const loading=Number.isInteger(state.page)&&state.page>=0&&state.page<(payload?.pages.length||1)?selectPage(state.page):null;
  if(loading)return loading.then(apply,error=>{if(restoringState===state)restoringState=undefined;view.dispatchEvent(new CustomEvent('documenterror',{detail:error}));});apply();
 };
 views.set(view,{target,navigateAnchor,position:()=>readingPosition(article,sources),restore,snapshot,restoreState,data:()=>({...payload,currentPage:current}),release(){active=false;revision++;release();releaseWidth();outlineSpy.dispose();rangeObserver?.disconnect();cancelAnimationFrame(rangeFrame ?? 0);view.removeEventListener('click',click);view.removeEventListener('load',markRanges,true);}});
 view.addEventListener('click',click);
 view.addEventListener('load',markRanges,true);
 hydrate();
 if(owner&&!owners.has(owner)){owners.add(owner);owner.querySelector<HTMLElement>(':scope > .code-header [data-code-document],:scope > .dialog-head [data-code-document]')?.addEventListener('click',()=>setDocumentMode(owner,owner.dataset.documentMode!=='rendered'));}
 if(owner)setDocumentMode(owner,owner.dataset.documentMode!=='source');
}
export function unmountDocumentView(view: HTMLElement){for(const nested of view.querySelectorAll<HTMLElement>('[data-file-document]'))unmountDocumentView(nested);views.get(view)?.release();views.delete(view);}
export const documentRangeTarget=(view: HTMLElement | null,range: LineRange,navigate=false)=>view?views.get(view)?.target(range,navigate):null;
export const navigateDocumentAnchor=(view: HTMLElement,id: string)=>views.get(view)?.navigateAnchor(id);
export const documentViewState=(view: HTMLElement)=>views.get(view)?.snapshot();
export const restoreDocumentViewState=(view: HTMLElement,state?: DocumentState)=>views.get(view)?.restoreState(state);
export function initDocumentViews(){for(const view of document.querySelectorAll<HTMLElement>('[data-file-document]'))mountDocumentView(view);}
