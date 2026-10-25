import {articlePageCache} from '../lib/page-cache.js';
import {canonicalArticlePath} from '../lib/article-pages.js';
import {parseFpUrl} from '../lib/fp-links.js';
import {patchChildren,patchTree} from '../lib/page-dom.js';
import {refreshNavigation,disposeNavigationNode} from './navigation.js';
import {resetArticlePages} from './article-pages.js';
import {refreshArticleResources,warmArticleResources} from './file-resources.js';
import {hydrateReadingContent} from './reading-content.js';
import {initDocumentViews,unmountDocumentView} from './document-view.js';
import {initGitHubFiles,disposeGitHubFiles} from './github-files.js';
import {initTreeWidth,disposeTreeWidth} from './tree-width.js';
import {disposeSidebar} from './sidebars.js';
import {notice} from '../lib/dom.js';

let initialized=false,currentHref,request,revision=0,navigating=false,scrollFrame;
const scrolls=new Map(),loadedModules=new Set(),metadata=['data-repository','data-repository-name','data-version','data-commit','data-mdx-file','data-source-url','data-article-page'];
export function pageLinkTarget(link,href){
 if(!link||link.hasAttribute('download')||link.target&&link.target!=='_self'||link.closest('[data-file-document]')||link.closest('[data-floating-panel]')&&!link.closest('.repo-header'))return null;
 const raw=link.getAttribute('href');if(!raw||raw.startsWith('#'))return null;
 let url;try{url=new URL(raw,href);if(parseFpUrl(raw,href))return null;}catch{return null;}
 const current=new URL(href);
 if(!['http:','https:'].includes(url.protocol)||url.origin!==current.origin||canonicalArticlePath(url.pathname)===canonicalArticlePath(current.pathname)||!/(?:\/|\.html|\/[^/.]+)$/.test(url.pathname))return null;
 return url;
}
const position=()=>({x:scrollX,y:scrollY});
function rememberScroll(write=true){
 if(!currentHref)return;const scroll=position();scrolls.set(currentHref,scroll);
 if(write)history.replaceState({...history.state,reifyNavigation:{scroll}},'',location.href);
}
function payload(source,id){
 const incoming=source.getElementById(id),old=document.getElementById(id);
 if(!incoming){old?.remove();return;}if(old)old.textContent=incoming.textContent;else document.head.append(document.importNode(incoming,true));
}
function replaceFiles(source){
 const old=document.querySelector('.github-files'),incoming=source.querySelector('.github-files');
 if(old&&incoming&&old.dataset.treeUrl===incoming.dataset.treeUrl)return;
 if(old){disposeGitHubFiles(old);disposeNavigationNode(old);disposeTreeWidth(old);if(!incoming){old.remove();disposeSidebar('files');return;}}
 if(!incoming)return;
 if(old){old.dataset.treeUrl=incoming.dataset.treeUrl;old.replaceChildren(...[...incoming.childNodes].map(node=>document.importNode(node,true)));}
 else document.querySelector('main.reading-viewport').before(document.importNode(incoming,true));
}
async function loadPageAssets(source,url){
 for(const style of source.querySelectorAll('link[rel=stylesheet]')){
  const href=new URL(style.getAttribute('href'),url).href;
  if(![...document.querySelectorAll('link[rel=stylesheet]')].some(node=>node.href===href)){const link=document.importNode(style,true);link.href=href;document.head.append(link);}
 }
 for(const incoming of source.querySelectorAll('script[type=module][src]')){
  const src=new URL(incoming.getAttribute('src'),url).href;if(loadedModules.has(src))continue;loadedModules.add(src);
  await new Promise((resolve,reject)=>{const script=document.createElement('script');script.type='module';script.src=src;script.onload=resolve;script.onerror=()=>{loadedModules.delete(src);reject(Error('页面脚本读取失败'));};document.head.append(script);});
 }
}
function applyScroll(url,saved){
 if(saved){scrollTo(saved.x,saved.y);return;}
 let id;try{id=decodeURIComponent(url.hash.slice(1));}catch{}
 const anchor=id&&document.getElementById(id);if(anchor)anchor.scrollIntoView();else scrollTo(0,0);
}
export async function navigatePage(href,{replace=false,reason='link',state}={}){
 const target=new URL(href,location.href),from=currentHref||location.href;
 if(target.origin!==location.origin){location.assign(target.href);return false;}
 if(canonicalArticlePath(target.pathname)===canonicalArticlePath(new URL(from).pathname))return false;
 const ticket=++revision;request?.abort();request=new AbortController();const signal=request.signal;
 let beforeStarted=false,committed=false,afterSent=false;
 rememberScroll(reason!=='popstate');navigating=true;
 try{
  const html=await articlePageCache.read(target.href,{signal});if(signal.aborted||ticket!==revision)return false;
  const source=new DOMParser().parseFromString(html,'text/html'),main=source.querySelector('main.reading-viewport');
  if(!main||!source.getElementById('article-pages')){location.assign(target.href);return false;}
  const waiting=[],detail={from,to:target.href,reason,waitUntil:promise=>waiting.push(Promise.resolve(promise))};
  beforeStarted=true;document.dispatchEvent(new CustomEvent('reify:before-navigate',{detail}));await Promise.all(waiting);
  if(signal.aborted||ticket!==revision)return false;
  const current=document.querySelector('main.reading-viewport');
  disposeNavigationNode(current);for(const view of current.querySelectorAll('[data-file-document]'))unmountDocumentView(view);
  if(reason!=='popstate')history[replace?'replaceState':'pushState']({...history.state,reifyNavigation:{scroll:{x:0,y:0}}},'',target.href);
  committed=true;
  for(const name of metadata){const value=source.body.getAttribute(name);if(value===null)document.body.removeAttribute(name);else document.body.setAttribute(name,value);}
  document.title=source.title;
  const header=document.querySelector('.repo-header'),nextHeader=source.querySelector('.repo-header');if(header&&nextHeader)patchChildren(header,nextHeader,{onRemove:disposeNavigationNode,preserve:node=>node.nodeType===1&&node.matches('.symmetric-button,.tree-toggle,.github-files-toggle,.reader-annotation-control,.theme-toggle')});
  const tree=document.querySelector('.repo-tree .repo-tree-content'),nextTree=source.querySelector('.repo-tree .repo-tree-content');if(tree&&nextTree)patchTree(tree,nextTree,{onRemove:disposeNavigationNode});
  replaceFiles(source);current.replaceChildren(...[...main.childNodes].map(node=>document.importNode(node,true)));
  for(const id of ['article-pages','document-options','file-resources'])payload(source,id);
  resetArticlePages();refreshArticleResources();refreshNavigation();initGitHubFiles();initTreeWidth();hydrateReadingContent(current);initDocumentViews();
  const assets=loadPageAssets(source,target.href).catch(error=>{if(ticket===revision)notice(error.message);});
  applyScroll(target,reason==='popstate'?(state?.reifyNavigation?.scroll||scrolls.get(target.href)):null);
  afterSent=true;document.dispatchEvent(new CustomEvent('reify:after-navigate',{detail:{from,to:target.href,reason}}));
  currentHref=location.href;rememberScroll();warmArticleResources();await assets;if(ticket===revision)document.dispatchEvent(new Event('astro:page-load'));return true;
 }catch(error){if(!signal.aborted&&ticket===revision){notice(error.message||'页面暂时无法读取');if(committed||reason==='popstate')location.assign(target.href);else if(beforeStarted&&!afterSent)document.dispatchEvent(new CustomEvent('reify:after-navigate',{detail:{from,to:from,reason,cancelled:true,error}}));}return false;}
 finally{if(ticket===revision)navigating=false;}
}
export function initPageNavigation(){
 if(initialized)return;initialized=true;currentHref=location.href;
 articlePageCache.remember(currentHref,'<!doctype html>'+document.documentElement.outerHTML);
 for(const script of document.querySelectorAll('script[type=module][src]'))loadedModules.add(script.src);
 history.scrollRestoration='manual';rememberScroll();
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const target=pageLinkTarget(event.target.closest?.('a[href]'),location.href);if(!target)return;
  event.preventDefault();navigatePage(target.href);
 });
 document.addEventListener('reify:navigate',event=>navigatePage(event.detail.href,{replace:event.detail.replace}));
 document.addEventListener('fpchange',()=>{if(!navigating)currentHref=location.href;});
 addEventListener('hashchange',()=>{if(!navigating)currentHref=location.href;});
 addEventListener('scroll',()=>{if(navigating||scrollFrame!==undefined)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=undefined;if(!navigating)rememberScroll();});},{passive:true});
 addEventListener('popstate',event=>{const target=new URL(location.href);if(canonicalArticlePath(target.pathname)===canonicalArticlePath(new URL(currentHref).pathname)){currentHref=location.href;return;}navigatePage(target.href,{reason:'popstate',state:event.state});});
}
