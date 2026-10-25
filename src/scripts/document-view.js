import {hydrateReadingContent} from './reading-content.js';
import {registerArticleBlocks} from './article-pages.js';
import {codeBlockDefinition} from '../lib/code-block.js';
import {readingContent} from '../lib/reading-content.js';
const views=new WeakMap(),owners=new WeakSet();
async function hydrateDocumentCode(block){
 if(!block.hasAttribute('data-document-code'))return;block.removeAttribute('data-document-code');
 try{
  const definition=codeBlockDefinition(block);let text=definition.code;
  if(definition.src){const {readFile}=await import('../lib/github-files.js'),content=await readFile(definition.src);if(content.kind!=='text')throw Error('CodeBlock src 必须是文本文件');text=content.text;}
  const {highlightSource}=await import('../lib/source-highlight.js'),html=await highlightSource(text,definition.language),pre=new DOMParser().parseFromString(html,'text/html').querySelector('pre');
  pre.classList.add('astro-code');const {decorateCode}=await import('./code-annotations.js');await decorateCode(pre,definition);
  if(block.isConnected)block.querySelector(':scope > pre').replaceWith(pre);
 }catch(error){if(block.isConnected)block.querySelector(':scope > pre').textContent=error.message;}
}
export function setDocumentMode(root,rendered){
 const view=root.querySelector(':scope > [data-source-document],:scope > [data-file-document]'),pre=root.querySelector(':scope > pre'),head=root.querySelector(':scope > .code-header,:scope > .dialog-head'),button=head?.querySelector('[data-code-document]');
 if(!view||!button)return;
 root.dataset.documentMode=rendered?'rendered':'source';view.hidden=!rendered;if(pre)pre.hidden=rendered;
 button.hidden=false;button.setAttribute('aria-pressed',String(!rendered));button.setAttribute('aria-label',rendered?'源码':'文档');button.dataset.tip=rendered?'源码':'文档';
 const wrap=head.querySelector('[data-code-wrap]'),ranges=head.querySelector('[data-code-ranges]');if(wrap)wrap.hidden=rendered;if(ranges)ranges.hidden=root.dataset.hasRanges!=='true';
 root.dispatchEvent(new CustomEvent('documentmodechange',{detail:{rendered}}));
}
export function mountDocumentView(view,owner=view.closest('.code-block,[data-code-viewer]'),ranges){
 if(!view||views.has(view))return;
 ranges||=codeBlockDefinition(owner)?.ranges||[];
 let payload;try{payload=JSON.parse(view.dataset.documentData||'null');}catch{}
 const article=view.querySelector('[data-document-content]'),scrollPositions=new Map(),parsedPages=new Map(),pageSources=new Map(),rangePages=new Map(),rangeTargets=new Map();let current=0,sources=[];
 const pageDocument=index=>{if(!parsedPages.has(index))parsedPages.set(index,new DOMParser().parseFromString(payload.pages[index].html,'text/html'));return parsedPages.get(index);};
 const source=node=>({node,from:Number(node.dataset.mdxLine),to:Number(node.dataset.mdxEndLine||node.dataset.mdxLine)});
 const intersects=(source,range)=>source.from<=range.to&&source.to>=range.from;
 const release=registerArticleBlocks(id=>{
  if(!payload)return null;
  const index=payload.pages.findIndex(page=>page.href===payload.anchors[id]),indices=index<0?payload.pages.keys():[index];
  for(const index of indices){const block=pageDocument(index).getElementById(id);if(block?.matches('.code-block,template[data-code-definition]'))return block;}
  return null;
 });
 const indexSources=()=>{
  sources=[...article.querySelectorAll('[data-mdx-line]')].filter(node=>node.closest('[data-file-document]')===view).map(source);
  pageSources.set(current,sources);rangeTargets.clear();
 };
 const markRanges=()=>{
  const marked=new Set();for(const item of sources){const range=ranges.find(range=>intersects(item,range));if(!range)continue;const node=item.node;let parent=node.parentElement,inside=false;while(parent&&parent!==article){if(marked.has(parent)){inside=true;break;}parent=parent.parentElement;}if(inside)continue;marked.add(node);node.dataset.documentRange=range.color||'gray';}
 };
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
 const hydrate=()=>{if(!article)return;hydrateReadingContent(article);indexSources();markRanges();for(const block of article.querySelectorAll('[data-document-code]'))hydrateDocumentCode(block);for(const nested of article.querySelectorAll('[data-file-document]'))mountDocumentView(nested);};
 hydrate();
 view.querySelector('.document-outline a[data-heading]')?.setAttribute('aria-current','page');
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
 views.set(view,{target,release(){release();view.removeEventListener('click',click);}});
 view.addEventListener('click',click);
 if(owner&&!owners.has(owner)){owners.add(owner);owner.querySelector(':scope > .code-header [data-code-document],:scope > .dialog-head [data-code-document]')?.addEventListener('click',()=>setDocumentMode(owner,owner.dataset.documentMode!=='rendered'));}
 if(owner)setDocumentMode(owner,owner.dataset.documentMode!=='source');
}
export function unmountDocumentView(view){for(const nested of view.querySelectorAll('[data-file-document]'))unmountDocumentView(nested);views.get(view)?.release();views.delete(view);}
export const documentRangeTarget=(view,range,navigate=false)=>views.get(view)?.target(range,navigate);
export function initDocumentViews(){for(const view of document.querySelectorAll('[data-file-document]'))mountDocumentView(view);}
