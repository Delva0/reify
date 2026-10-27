import type {PageProps} from '../lib/data-types.js';
import type {PanelContext} from '../lib/panel-types.js';
import type {readArticleDocument} from './article-document.js';
import {errorMessage} from '../lib/data-types.js';
import {required} from '../lib/dom.js';
import {eventElement} from './event-target.js';
import {createCodeDialog} from './code-dialog.js';
import {registerFpType,openFloatingPanels} from './fp-navigation.js';
import {linkPanelState,readingLinkState} from '../lib/link-panels.js';
import {readingContext,setReadingContext} from '../lib/reading-context.js';
import {markLink} from '../lib/links.js';
import {notice} from '../lib/dom.js';
import {navigateDocumentAnchor} from './document-view.js';
import {externalPageTarget} from '../lib/web-navigation.js';
import {loadWebDocumentIndex,opensExternalWebPage} from './web-document-index.js';

let initialized=false;
async function documentId(url: string,instance?: string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url));
 const referencePrefix='page-'+Array.from(new Uint8Array(digest)).slice(0,8).map(value=>value.toString(16).padStart(2,'0')).join('');return {id:referencePrefix+'-'+instance,referencePrefix};
}

export function positionArticleDocument(panel: HTMLElement,article: Awaited<ReturnType<typeof readArticleDocument>>,context: PanelContext){
 // Opening a link requests its hash even when a previous reading is cached.
 // Session/history restoration without a new link keeps its saved position.
 if(!article.anchor||context.restore&&!context.origin)return;
 const view=panel.querySelector<HTMLElement>('[data-file-document]');if(view)return navigateDocumentAnchor(view,article.anchor);
}

function openPage(props: PageProps,context: PanelContext){
 const viewer=createCodeDialog(context),panel=viewer.panel,url=new URL(props.url,location.href);
 panel.dataset.pageViewer='loading';
 const title=required('[data-source-title]',panel),preview=required('[data-source-preview]',panel);
 const web=async(revision: number)=>{
  const {readWebDocument,mountWebDocument}=await import('./web-document.js'),resource=await readWebDocument(url.href);
  if(!viewer.alive(revision))return;
  panel.dataset.pageViewer='web';viewer.update({title:url.hostname});
  const address=document.createElement('a');address.href=url.href;address.dataset.pageAddress='';address.textContent=url.hostname;markLink(address);title.replaceChildren(address);
  const frame=document.createElement('iframe');frame.title=url.hostname;frame.referrerPolicy='no-referrer';
  preview.replaceChildren(frame);preview.hidden=false;
  if(resource){
   setReadingContext(panel,{url:resource.url,title:resource.title});
   const content=mountWebDocument(frame,resource,{href:url.href,onLink:href=>openFloatingPanels([readingLinkState(href,resource.url,location.href)||{type:'page',props:{url:href}}],{origin:frame})});
   panel.addEventListener('sourcechange',content.dispose,{once:true});await content.ready;
  }else{frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');frame.src=url.href;}
 };
 const load=async()=>{
  const current=viewer.update({title:url.hostname,message:'读取网页…'});
  try{
   if(url.origin!==location.origin){await web(current);return;}
   const {readArticleDocument}=await import('./article-document.js'),scope=await documentId(props.url,context.sessionId),article=await readArticleDocument(url.href,scope),id=scope.id;
   if(!article.source)throw Error('文章源码未发布');
   const response=await fetch(article.source.href);if(!response.ok)throw Error('文章源码读取失败（'+response.status+'）');
   const text=await response.text(),{highlightSource}=await import('../lib/source-highlight.js');
   const html=await highlightSource(text,article.source.language),pre=new DOMParser().parseFromString(html,'text/html').querySelector('pre');if(!pre)throw Error('代码高亮加载失败');
   pre.classList.add('astro-code');
   if(!viewer.alive(current))return;
   panel.dataset.pageViewer='article';setReadingContext(panel,article.context);setReadingContext(article.view,article.context);article.view.dataset.readingScope=id;
   viewer.update({title:article.title,pre,sourceFile:article.source.file,documentView:article.view});
   await positionArticleDocument(panel,article,context);
  }catch(error){if(!viewer.alive(current))return;if(errorMessage(error)==='目标不是文章页面')await web(current);else viewer.update({title:url.hostname,message:errorMessage(error)||'网页暂时无法读取',retry:load});}
 };
 viewer.ready=load();return viewer;
}

export function initLinkPanels(){
 if(initialized)return;initialized=true;registerFpType('page',openPage);
 loadWebDocumentIndex();
 document.addEventListener('click',event=>{
  const link=eventElement(event)?.closest<HTMLAnchorElement>('a[href]');if(!link)return;
  try{const target=externalPageTarget(link,event,readingContext(link).url,location.href,opensExternalWebPage);if(!target)return;event.preventDefault();event.stopImmediatePropagation();window.open(target,'_blank','noopener');}catch{}
 },true);
 document.addEventListener('click',event=>{
  const link=eventElement(event)?.closest<HTMLAnchorElement>('a[href]');if(!link)return;
  try{const state=linkPanelState(link,event,readingContext(link).url,location.href);if(!state)return;event.preventDefault();openFloatingPanels([state],{origin:link});}
  catch(error){event.preventDefault();notice(errorMessage(error));}
 });
}
