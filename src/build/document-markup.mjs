import {nestHeadings} from '../lib/heading-tree.js';
import {headingTreeHtml} from '../lib/heading-tree-html.js';
import {paginateArticle} from './article-pages.mjs';
import {scopeDocument} from './document-scope.mjs';
import {readingContent} from '../lib/reading-content.js';
export function prepareDocument(html,{id,title='文档',sourceUrl}={}){
 const document=paginateArticle(scopeDocument(html,id,sourceUrl),id,{allowUntitled:true,title});
 for(const page of document.pages)page.html=page.html.replace(/href="[^"#]*\.html#([^"]+)"/g,'href="#$1"');
 return {pages:document.pages.map(({id,title,html,href})=>({id,title,html,href})),anchors:document.manifest.anchors,tree:headingTreeHtml(nestHeadings(document.headings.map(heading=>({...heading,href:'#'+heading.slug}))))};
}
export function documentMarkup(html,options){
 const data=prepareDocument(html,options),payload=JSON.stringify(data).replace(/</g,'\\u003c').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
 return '<div class="file-document" data-file-document data-document-data="'+payload+'"><aside class="document-outline" aria-label="文档目录">'+data.tree+'</aside><div class="reading-viewport document-content" data-document-content>'+readingContent(data.pages[0].html)+'</div></div>';
}
