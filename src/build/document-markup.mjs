import {nestHeadings} from '../lib/heading-tree.js';
import {headingTreeHtml} from '../lib/heading-tree-html.js';
import {paginateArticle} from './article-pages.mjs';
import {scopeDocument} from './document-scope.mjs';
import {readingContent} from '../lib/reading-content.js';
import {treeResizeHandle} from '../lib/tree-pane.js';

export function prepareDocument(html,{id,title='文档',sourceUrl,resourceBase,referencePrefix=id}={}){
 const document=paginateArticle(scopeDocument(html,id,sourceUrl,{resourceBase,referencePrefix}),id,{allowUntitled:true,title});
 const pageHrefs=new Set(document.pages.map(page=>page.href));
 const pages=document.pages.map(({id,title,html,href})=>({
  id,title,href,
  // Article pages use separate URLs. Embedded pages use the same anchor map,
  // while their owner switches the visible H1 page without leaving the file.
  html:html.replace(/href="([^"#]+)#([^"]+)"/g,(attribute,page,anchor)=>pageHrefs.has(page)?'href="#'+anchor+'"':attribute)
 }));
 const headings=document.headings.map(heading=>({...heading,href:'#'+heading.slug}));
 return {pages,anchors:document.manifest.anchors,tree:headingTreeHtml(nestHeadings(headings))};
}

function attributeJson(value){
 return JSON.stringify(value).replace(/</g,'\\u003c').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
}

// Astro and the worker use one outline, reading-content wrapper and payload.
export function documentMarkup(html,options){
 return documentDataMarkup(prepareDocument(html,options));
}

export function documentDataMarkup(data){
 return '<div class="file-document" data-file-document data-document-data="'+attributeJson(data)+'">'
  +'<aside class="document-outline" aria-label="文档目录"><div class="repo-tree-content">'+data.tree+'</div>'+treeResizeHandle()+'</aside>'
  +'<div class="reading-viewport document-content" data-document-content>'+readingContent(data.pages[data.currentPage||0].html)+'</div>'
  +'</div>';
}
