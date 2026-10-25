import {createCodeDialog} from './code-dialog.js';
import {registerFpType,openFloatingPanels} from './fp-navigation.js';
import {linkPanelState} from '../lib/link-panels.js';
import {readingContext,setReadingContext} from '../lib/reading-context.js';
import {markLink} from '../lib/links.js';
import {notice} from '../lib/dom.js';
import {setCodeText} from './code-controls.js';
import {navigateDocumentAnchor} from './document-view.js';

let initialized=false;
async function documentId(url,instance){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url));
 const referencePrefix='page-'+Array.from(new Uint8Array(digest)).slice(0,8).map(value=>value.toString(16).padStart(2,'0')).join('');return {id:referencePrefix+'-'+instance,referencePrefix};
}

export function positionArticleDocument(panel,article,context){
 // Opening a link requests its hash even when a previous reading is cached.
 // Session/history restoration without a new link keeps its saved position.
 if(!article.anchor||context.restore&&!context.origin)return;
 return navigateDocumentAnchor(panel.querySelector('[data-file-document]'),article.anchor);
}

function openPage(props,context){
 const viewer=createCodeDialog(context),panel=viewer.panel,url=new URL(props.url,location.href);
 panel.dataset.pageViewer='loading';
 const title=panel.querySelector('[data-source-title]'),preview=panel.querySelector('[data-source-preview]');
 const copyText=()=>{const article=panel.querySelector('[data-document-content]>.document');if(article)setCodeText(panel,article.innerText);};
 const web=()=>{
  panel.dataset.pageViewer='web';viewer.update({title:url.hostname});
  const address=document.createElement('a');address.href=url.href;address.dataset.pageAddress='';address.textContent=url.hostname;markLink(address);title.replaceChildren(address);
  const frame=document.createElement('iframe');frame.src=url.href;frame.title=url.hostname;frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');frame.referrerPolicy='strict-origin-when-cross-origin';
  preview.replaceChildren(frame);preview.hidden=false;
 };
 const load=async()=>{
  const current=viewer.update({title:url.hostname,message:'读取网页…'});
  try{
   if(url.origin!==location.origin){web();return;}
   const {readArticleDocument}=await import('./article-document.js'),scope=await documentId(props.url,context.sessionId),article=await readArticleDocument(url.href,scope),id=scope.id;
   if(!viewer.alive(current))return;
   panel.dataset.pageViewer='article';setReadingContext(panel,article.context);setReadingContext(article.view,article.context);article.view.dataset.readingScope=id;
   viewer.update({title:article.title,text:'',documentView:article.view});
   panel.querySelector('[data-code-copy]').setAttribute('aria-label','复制文本');copyText();
   await positionArticleDocument(panel,article,context);
  }catch(error){if(!viewer.alive(current))return;if(error.message==='目标不是文章页面')web();else viewer.update({title:url.hostname,message:error.message||'网页暂时无法读取',retry:load});}
 };
 panel.addEventListener('documentpagechange',copyText);
 viewer.ready=load();return viewer;
}

export function initLinkPanels(){
 if(initialized)return;initialized=true;registerFpType('page',openPage);
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');if(!link)return;
  try{const state=linkPanelState(link,event,readingContext(link).url,location.href);if(!state)return;event.preventDefault();openFloatingPanels([state],{origin:link});}
  catch(error){event.preventDefault();notice(error.message);}
 });
}
