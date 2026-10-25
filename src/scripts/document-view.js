import {hydrateReadingContent} from './reading-content.js';
import {registerArticleBlocks} from './article-pages.js';
import {codeBlockDefinition} from '../lib/code-block.js';
import {readingContent} from '../lib/reading-content.js';
import {readFile} from '../lib/github-files.js';
import {bindTreeWidth} from './tree-width.js';
import {readingPosition,restoreReadingPosition,sourceLineEntries,rangeBackground} from '../lib/reading-position.js';
const views=new WeakMap(),owners=new WeakSet();
async function hydrateDocumentCode(block){
 if(!block.hasAttribute('data-document-code'))return;block.removeAttribute('data-document-code');
 try{
  const definition=codeBlockDefinition(block);let text=definition.code;
  if(definition.src){const content=await readFile(definition.src);if(content.kind!=='text')throw Error('CodeBlock src 必须是文本文件');text=content.text;}
  const {highlightSource}=await import('../lib/source-highlight.js'),html=await highlightSource(text,definition.language),pre=new DOMParser().parseFromString(html,'text/html').querySelector('pre');
  pre.classList.add('astro-code');const {decorateCode}=await import('./code-annotations.js');await decorateCode(pre,definition);
  if(block.isConnected)block.querySelector(':scope > pre').replaceWith(pre);
 }catch(error){if(block.isConnected)block.querySelector(':scope > pre').textContent=error.message;}
}
export function setDocumentMode(root,rendered){
 const view=root.querySelector(':scope > [data-source-document],:scope > [data-file-document]'),pre=root.querySelector(':scope > pre'),head=root.querySelector(':scope > .code-header,:scope > .dialog-head'),button=head?.querySelector('[data-code-document]');
 if(!view||!button)return;
 const documentView=view.matches('[data-file-document]')?view:view.querySelector('[data-file-document]'),controller=views.get(documentView),previous=root.dataset.documentMode;
 const position=previous&&previous!==(rendered?'rendered':'source')?(previous==='rendered'?controller?.position():readingPosition(pre,sourceLineEntries(pre))):null;
 root.dataset.documentMode=rendered?'rendered':'source';view.hidden=!rendered;if(pre)pre.hidden=rendered;
 button.hidden=false;button.setAttribute('aria-pressed',String(!rendered));button.setAttribute('aria-label',rendered?'源码':'文档');button.dataset.tip=rendered?'源码':'文档';
 const wrap=head.querySelector('[data-code-wrap]'),ranges=head.querySelector('[data-code-ranges]');if(wrap)wrap.hidden=rendered;if(ranges)ranges.hidden=root.dataset.hasRanges!=='true';
 if(position){if(rendered)controller?.restore(position);else restoreReadingPosition(pre,sourceLineEntries(pre),position);}
 root.dispatchEvent(new CustomEvent('documentmodechange',{detail:{rendered,synchronized:Boolean(position)}}));
}
export function mountDocumentView(view,owner=view.closest('.code-block,[data-code-viewer]'),ranges){
 if(!view||views.has(view))return;
 ranges||=codeBlockDefinition(owner)?.ranges||[];
 let payload;try{payload=JSON.parse(view.dataset.documentData||'null');}catch{}
 const article=view.querySelector('[data-document-content]'),scrollPositions=new Map(),parsedPages=new Map(),pageSources=new Map(),rangePages=new Map(),rangeTargets=new Map();let current=0,sources=[];
 const pageDocument=index=>{if(!parsedPages.has(index))parsedPages.set(index,new DOMParser().parseFromString(payload.pages[index].html,'text/html'));return parsedPages.get(index);};
 const source=node=>({from:Number(node.dataset.mdxLine),to:Number(node.dataset.mdxEndLine||node.dataset.mdxLine)});
 const intersects=(source,range)=>source.from<=range.to&&source.to>=range.from;
 const release=registerArticleBlocks(id=>{
  if(!payload)return null;
  const index=payload.pages.findIndex(page=>page.href===payload.anchors[id]),indices=index<0?payload.pages.keys():[index];
  for(const index of indices){const block=pageDocument(index).getElementById(id);if(block?.matches('.code-block,template[data-code-definition]'))return block;}
  return null;
 });
 const indexSources=()=>{
  sources=[...article.querySelectorAll('[data-mdx-line]')].filter(node=>node.closest('[data-file-document]')===view).map(node=>({node,...source(node)}));
  pageSources.set(current,sources.map(({from,to})=>({from,to})));rangeTargets.clear();
 };
 let rangeFrame;
 const markRanges=()=>{if(!ranges.length||rangeFrame!==undefined)return;rangeFrame=requestAnimationFrame(()=>{rangeFrame=undefined;const canvas=article?.querySelector(':scope > .document');if(canvas)canvas.style.setProperty('--document-range-background',rangeBackground(canvas,sources,ranges));});};
 const selectPage=index=>{
  if(!payload||index===current)return;
  scrollPositions.set(current,article.scrollTop);for(const nested of article.querySelectorAll('[data-file-document]'))unmountDocumentView(nested);
  article.innerHTML=readingContent(payload.pages[index].html);current=index;hydrate();article.scrollTop=scrollPositions.get(index)||0;
  view.dispatchEvent(new CustomEvent('documentpagechange',{bubbles:true}));
 };
 const rangePage=(range,key)=>{
  if(!payload)return -1;
  if(!rangePages.has(key))rangePages.set(key,payload.pages.findIndex((page,index)=>{
   if(!pageSources.has(index))pageSources.set(index,[...pageDocument(index).querySelectorAll('[data-mdx-line]')].filter(node=>!node.closest('[data-file-document]')).map(source));
   return pageSources.get(index).some(item=>intersects(item,range));
  }));
  return rangePages.get(key);
 };
 const target=(range,navigate)=>{
  if(!article)return null;const key=range.from+':'+range.to;
  if(navigate){const page=rangePage(range,key);if(page>=0)selectPage(page);}
  if(!rangeTargets.has(key)){
   const match=sources.find(item=>intersects(item,range))?.node||null;
   rangeTargets.set(key,{match,nearest:match||sources.find(item=>item.from>=range.from)?.node||sources.at(-1)?.node||null});
  }
  const cached=rangeTargets.get(key);return navigate?cached.nearest:cached.match;
 };
 const hydrate=()=>{if(!article)return;hydrateReadingContent(article);indexSources();markRanges();rangeObserver?.disconnect();rangeObserver?.observe(article);const canvas=article.querySelector(':scope > .document');if(canvas)rangeObserver?.observe(canvas);for(const block of article.querySelectorAll('[data-document-code]'))hydrateDocumentCode(block);for(const nested of article.querySelectorAll('[data-file-document]'))mountDocumentView(nested);};
 const click=event=>{
  if(event.target.closest('[data-file-document]')!==view)return;
  const branch=event.target.closest('.document-outline .tree-branch');if(branch){const list=branch.closest('li').querySelector(':scope > .tree-sections');if(list){const open=branch.getAttribute('aria-expanded')==='true';branch.setAttribute('aria-expanded',String(!open));branch.querySelector('path').setAttribute('d',open?'M2 6h8M6 2v8':'M2 6h8');list.hidden=open;}return;}
  const link=event.target.closest('a[href]'),href=link?.getAttribute('href');if(!payload||!href?.startsWith('#')||event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
  let id;try{id=decodeURIComponent(href.slice(1));}catch{return;}const pageHref=payload.anchors[id],index=payload.pages.findIndex(page=>page.href===pageHref);if(index<0)return;
  event.preventDefault();scrollPositions.set(current,article.scrollTop);
  selectPage(index);
  const target=article.querySelector('#'+CSS.escape(id));if(target)article.scrollTop+=target.getBoundingClientRect().top-article.getBoundingClientRect().top-16;
  for(const item of view.querySelectorAll('.document-outline a[data-heading]')){if(item.dataset.heading===id)item.setAttribute('aria-current','location');else item.removeAttribute('aria-current');}
 };
 const outline=view.querySelector(':scope > .document-outline'),releaseWidth=bindTreeWidth(outline,outline?.querySelector(':scope > .tree-resize-handle'),{styleTarget:view,maximum:()=>Math.min(480,view.clientWidth-256),observe:view});
 const rangeObserver=ranges.length?new ResizeObserver(markRanges):null;
 if(article)rangeObserver?.observe(article);
 const restore=position=>{
  const range={from:Math.floor(position.line),to:Math.ceil(position.line)};
  let page=rangePage(range,'position:'+range.from);
  if(payload&&page<0)page=payload.pages.findLastIndex((_item,index)=>pageSources.get(index)?.some(item=>item.from<=position.line));
  if(page>=0)selectPage(page);
  restoreReadingPosition(article,sources,position);
 };
 views.set(view,{target,position:()=>readingPosition(article,sources),restore,release(){release();releaseWidth();rangeObserver?.disconnect();cancelAnimationFrame(rangeFrame);view.removeEventListener('click',click);view.removeEventListener('load',markRanges,true);}});
 view.addEventListener('click',click);
 view.addEventListener('load',markRanges,true);
 hydrate();
 view.querySelector('.document-outline a[data-heading]')?.setAttribute('aria-current','page');
 if(owner&&!owners.has(owner)){owners.add(owner);owner.querySelector(':scope > .code-header [data-code-document],:scope > .dialog-head [data-code-document]')?.addEventListener('click',()=>setDocumentMode(owner,owner.dataset.documentMode!=='rendered'));}
 if(owner)setDocumentMode(owner,owner.dataset.documentMode!=='source');
}
export function unmountDocumentView(view){for(const nested of view.querySelectorAll('[data-file-document]'))unmountDocumentView(nested);views.get(view)?.release();views.delete(view);}
export const documentRangeTarget=(view,range,navigate=false)=>views.get(view)?.target(range,navigate);
export function initDocumentViews(){for(const view of document.querySelectorAll('[data-file-document]'))mountDocumentView(view);}
