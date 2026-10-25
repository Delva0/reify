import {readingContext} from './reading-context.js';
const elementOf=node=>node?.nodeType===1?node:node?.parentElement;
const articleOf=element=>element?.closest?.('article.document')||document.querySelector('main .document,.document');

export function domPath(node){
 let element=elementOf(node);const path=[];
 while(element&&element!==document.documentElement){
  if(element.id){path.unshift('#'+CSS.escape(element.id));break;}
  const tag=element.tagName.toLowerCase(),siblings=element.parentElement?[...element.parentElement.children].filter(sibling=>sibling.tagName===element.tagName):[element];
  path.unshift(tag+(siblings.length>1?`:nth-of-type(${siblings.indexOf(element)+1})`:''));
  if(element.matches('article.document'))break;element=element.parentElement;
 }return path.join(' > ');
}

function boundary(node,offset){const parent=node.nodeType===3?node.parentElement:node;return domPath(parent)+(node.nodeType===3?`::text(${[...parent.childNodes].indexOf(node)})`:'')+':'+offset;}
function sourceLocation(element){const node=element?.closest('[data-mdx-line]');return node?{line:Number(node.dataset.mdxLine),column:Number(node.dataset.mdxColumn),endLine:Number(node.dataset.mdxEndLine),endColumn:Number(node.dataset.mdxEndColumn)}:null;}

export function headingPath(element,y=innerHeight/2){
 const context=readingContext(element),local=element?.closest?.('article.document'),article=articleOf(element);
 if(!local&&new URL(context.url).pathname!==location.pathname)return [{id:new URL(context.url).hash.slice(1),text:context.title,level:1}];
 const headings=[...article.querySelectorAll('h1,h2,h3,h4,h5,h6')],path=[];
 for(const heading of headings){const before=article.contains(element)?heading===element||heading.contains(element)||Boolean(heading.compareDocumentPosition(element)&Node.DOCUMENT_POSITION_FOLLOWING):heading.getBoundingClientRect().top<=y;
  if(!before)break;const level=Number(heading.tagName[1]);while(path.length&&path.at(-1).level>=level)path.pop();path.push({id:heading.id,text:heading.textContent,level});
 }return path.length?path:[{id:headings[0]?.id,text:headings[0]?.textContent||document.title,level:1}];
}

export function articleContext(element,y){
 const context=readingContext(element),article=articleOf(element),headings=headingPath(element,y),url=new URL(element?.closest('[data-page-viewer=article]')?context.url:location.href),id=headings.at(-1)?.id||'';url.hash=context.scopeId&&id.startsWith(context.scopeId+'-')?id.slice(context.scopeId.length+1):id;
 const zone=element?.closest('[data-page-viewer=article]')?'文章浮窗':element?.closest('[data-code-viewer]')?'源码弹窗':element?.closest('.repo-tree')?'目录':element?.closest('header')?'顶部':article.contains(element)?'正文':'页面';
 return {title:context.title||article.querySelector('h1')?.textContent||document.title,repository:context.repositoryName,version:context.version,commit:context.commit,file:context.mdxFile,headings:headings.map(h=>h.text),url:url.href,zone,source:sourceLocation(element)};
}

export function textContext(range){
 const start=elementOf(range.startContainer),end=elementOf(range.endContainer),rect=range.getBoundingClientRect(),context=articleContext(start,rect.top);
 const first=sourceLocation(start),last=sourceLocation(end);if(first)context.source={...first,endLine:last?.endLine||first.endLine,endColumn:last?.endColumn||first.endColumn};
 const root=start.closest('[data-code-viewer],article.document,.repo-tree,header')||document.body,prefix=document.createRange();prefix.selectNodeContents(root);prefix.setEnd(range.startContainer,range.startOffset);
 const offset=prefix.toString().length,text=range.toString();context.locator=`${boundary(range.startContainer,range.startOffset)} → ${boundary(range.endContainer,range.endOffset)} (UTF-16)`;
 context.offset=`${domPath(root)} text[${offset}:${offset+text.length}]`;
 const viewer=start.closest('[data-code-viewer]');
 if(viewer?.dataset.sourceFile){const line=start.closest('.source-line')?.dataset.line,endLine=end.closest('.source-line')?.dataset.line;context.originalSource=viewer.dataset.sourceFile+(line?`:L${line}${endLine&&endLine!==line?'-L'+endLine:''}`:'');}
 return {...context,text};
}

export function sourceLabel(context){const p=context.source;return context.originalSource||(context.file+(p?`:L${p.line}:C${p.column}-L${p.endLine}:C${p.endColumn}`:''));}
export function formatTextAnnotation(context,comment){
 return ['【文字批注】',`文章：${context.title}`,context.repository&&`仓库：${context.repository}`,context.commit&&`版本：${context.commit}`,`位置：${context.headings.join(' / ')}`,`区域：${context.zone}`,`来源：${sourceLabel(context)}`,`链接：${context.url}`,`选区：${context.locator}`,`文字范围：${context.offset}`,'','原文：',context.text,'','批注：',comment].filter(line=>line!==false&&line!==undefined&&line!==null).join('\n');
}

export function imageLocation(rect){
 const element=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2),context=articleContext(element,rect.top);
 const intersects=node=>{const box=node.getBoundingClientRect();return box.width&&box.height&&box.left<rect.right&&box.right>rect.left&&box.top<rect.bottom&&box.bottom>rect.top;};
 const intersecting=[...document.querySelectorAll('.document [data-mdx-line]')].filter(intersects);
 const blocks=intersecting.filter(node=>!intersecting.some(child=>child!==node&&node.contains(child)));
 if(blocks.length)context.source={line:Math.min(...blocks.map(n=>+n.dataset.mdxLine)),column:1,endLine:Math.max(...blocks.map(n=>+n.dataset.mdxEndLine)),endColumn:1};
 const dialog=element?.closest('[data-code-viewer]');
 if(dialog?.dataset.sourceFile){const rows=[...dialog.querySelectorAll('.source-line')].filter(intersects);context.originalSource=dialog.dataset.sourceFile+(rows.length?':L'+rows[0].dataset.line+'-L'+rows.at(-1).dataset.line:'');}
 context.rectangle={x:Math.round(rect.left+scrollX),y:Math.round(rect.top+scrollY),width:Math.round(rect.width),height:Math.round(rect.height)};return context;
}
