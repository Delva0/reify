import type {ReadingContext} from '../lib/data-types.js';
import type {HtmlHeading} from '../lib/heading-tree-html.js';
import type {DocumentPage} from './document-view.js';
import {parseArticleManifest} from './article-pages.js';
import {articlePageCache} from '../lib/page-cache.js';
import {canonicalArticlePath} from '../lib/article-pages.js';
import {headingTreeHtml} from '../lib/heading-tree-html.js';
import {documentDataMarkup} from '../build/document-markup.js';
import {scopeDocument} from '../build/document-scope.js';
import {registerDocumentPageLoader} from './document-view.js';

const pageKey=(href: string)=>{const url=new URL(href);return url.origin+canonicalArticlePath(url.pathname);};
const parse=(html: string)=>new DOMParser().parseFromString(html,'text/html');
const main=(source: Document)=>source.querySelector<HTMLElement>('main.reading-viewport > .document');
const manifestOf=(source: Document)=>parseArticleManifest(source.getElementById('article-pages')?.textContent||'{}');
const pageContext=(source: Document,url: string)=>({...source.body.dataset,url,title:source.title});

function articleTree(source: Document,pages: (DocumentPage & {url: string})[],prefix: string,base: string){
 const hrefs=new Set(pages.map(page=>pageKey(page.url))),nodes=new Map<Element,HtmlHeading>(),roots: HtmlHeading[]=[];
 for(const link of source.querySelectorAll<HTMLAnchorElement>('.repo-tree a[data-heading]')){
  if(!hrefs.has(pageKey(new URL(link.getAttribute('href')||'',base).href)))continue;
  const item=link.closest('li');if(!item)continue;nodes.set(item,{slug:prefix+'-'+link.dataset.heading,text:link.textContent||'',href:'#'+prefix+'-'+link.dataset.heading,children:[]});
 }
 for(const [item,node]of nodes){
  let parent=item.parentElement?.closest('li');
  while(parent&&!nodes.has(parent))parent=parent.parentElement?.closest('li');
  (parent?nodes.get(parent)!.children:roots).push(node);
 }
 return headingTreeHtml(roots,'');
}

function repositoryBase(context: ReadingContext){
 if(!context.repositoryName||!context.commit)return undefined;
 return 'https://raw.githubusercontent.com/'+context.repositoryName.split('/').map(encodeURIComponent).join('/')+'/'+encodeURIComponent(context.commit)+'/';
}

// Adapt the already compiled article pages. The shared document view owns page
// switching, markup and hydration; no MDX is recompiled in this path.
export async function readArticleDocument(href: string,{id,referencePrefix=id}: {id: string; referencePrefix?: string}){
 let url=new URL(href,location.href),source=parse(await articlePageCache.read(url.href));
 let manifest=manifestOf(source);
 if(!main(source)||!manifest?.pages?.length)throw Error('目标不是文章页面');
 let anchor;
 try{anchor=decodeURIComponent(url.hash.slice(1))||null;}catch{anchor=null;}
 const anchorPage=anchor&&manifest.anchors?.[anchor];
 if(anchorPage){
  const target=new URL(anchorPage,url);
  if(pageKey(target.href)!==pageKey(url.href)){
   target.hash=url.hash;url=target;source=parse(await articlePageCache.read(url.href));manifest=manifestOf(source);
   if(!main(source)||!manifest?.pages?.length)throw Error('文章章节不存在');
  }
 }
 const context=pageContext(source,url.href);
 const resourceBase=repositoryBase(context);
 const pages: (DocumentPage & {id: string; title: string; url: string})[]=manifest.pages.map(page=>({...page,id:id+'-'+page.id,url:new URL(page.href,url).href,href:new URL(page.href,url).href}));
 const anchors=Object.fromEntries(Object.entries(manifest.anchors).map(([key,value])=>[key,new URL(value,url).href]));
 const scope=(document: Document,page: DocumentPage)=>scopeDocument(main(document)!.innerHTML,id,page.href,{resourceBase,anchors,referencePrefix});
 const currentPage=pages.findIndex(page=>pageKey(page.url)===pageKey(url.href));
 if(currentPage<0)throw Error('文章章节不存在');
 pages[currentPage].html=scope(source,pages[currentPage]);
 pages[currentPage].context=context;
 const data={pages,currentPage,anchors:Object.fromEntries(Object.entries(anchors).flatMap(([key,value])=>[[id+'-'+key,value],[referencePrefix+'-'+key,value]])),tree:articleTree(source,pages,id,url.href)};
 const view=parse(documentDataMarkup(data)).querySelector<HTMLElement>('[data-file-document]');
 if(!view)throw Error('文章视图不可用');
 registerDocumentPageLoader(view,async page=>{
  const document=parse(await articlePageCache.read(page.href));
  if(!main(document))throw Error('文章章节不存在');
  return {html:scope(document,page),context:pageContext(document,page.href)};
 });
 const original=manifest.source?{...manifest.source,href:new URL(manifest.source.href,url).href}:null;
 return {view,title:source.title,context,source:original,anchor:anchor?id+'-'+anchor:null};
}
