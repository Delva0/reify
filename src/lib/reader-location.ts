import {readingContext} from './reading-context.js';
import {isRecord} from './data-types.js';
export interface SourceLocation {line:number;column:number;endLine:number;endColumn:number}
export interface AnnotationRectangle {x:number;y:number;width:number;height:number}
export interface ReaderArticleContext {title:string;repository?:string;version?:string;commit?:string;file?:string;headings:string[];url:string;zone:string;source?:SourceLocation|null;originalSource?:string}
export interface ReaderTextContext extends ReaderArticleContext {text:string;locator:string;offset:string}
export interface ReaderImageContext extends ReaderArticleContext {rectangle:AnnotationRectangle}
export interface HeadingLocation {id:string;text:string;level:number}
const validSource=(value:unknown):value is SourceLocation|null|undefined=>value===undefined||value===null||isRecord(value)&&['line','column','endLine','endColumn'].every(key=>typeof value[key]==='number'&&Number.isFinite(value[key]));
export function isReaderArticleContext(value:unknown):value is ReaderArticleContext{return isRecord(value)&&typeof value.title==='string'&&typeof value.url==='string'&&typeof value.zone==='string'&&Array.isArray(value.headings)&&value.headings.every(item=>typeof item==='string')&&validSource(value.source)&&['repository','version','commit','file','originalSource'].every(key=>value[key]===undefined||typeof value[key]==='string');}
export function isReaderTextContext(value:unknown):value is ReaderTextContext{return isReaderArticleContext(value)&&'text' in value&&typeof value.text==='string'&&'locator' in value&&typeof value.locator==='string'&&'offset' in value&&typeof value.offset==='string';}
export function isReaderImageContext(value:unknown):value is ReaderImageContext{if(!isReaderArticleContext(value)||!('rectangle' in value)||!isRecord(value.rectangle))return false;const rectangle=value.rectangle;return ['x','y','width','height'].every(key=>typeof rectangle[key]==='number'&&Number.isFinite(rectangle[key]));}
const elementOf=(node:Node|null|undefined):Element|null=>node?.nodeType===1?node as Element:node?.parentElement||null;
const articleOf=(element:Element|null|undefined)=>element?.closest('article.document')||document.querySelector('main .document,.document')||document.body;
export function domPath(node:Node|null|undefined){
 let element=elementOf(node);const path:string[]=[];
 while(element&&element!==document.documentElement){
  if(element.id){path.unshift('#'+CSS.escape(element.id));break;}
  const current=element,tag=current.tagName.toLowerCase(),siblings:Element[]=current.parentElement?[...current.parentElement.children].filter(sibling=>sibling.tagName===current.tagName):[current];
  path.unshift(tag+(siblings.length>1?`:nth-of-type(${siblings.indexOf(current)+1})`:''));
  if(current.matches('article.document'))break;element=current.parentElement;
 }return path.join(' > ');
}
function boundary(node:Node,offset:number){const parent=node.nodeType===3?node.parentElement:node;return domPath(parent)+(node.nodeType===3?`::text(${[...(parent?.childNodes||[])].indexOf(node as ChildNode)})`:'')+':'+offset;}
function sourceLocation(element:Element|null|undefined):SourceLocation|null{const node=element?.closest<HTMLElement>('[data-mdx-line]');return node?{line:Number(node.dataset.mdxLine),column:Number(node.dataset.mdxColumn),endLine:Number(node.dataset.mdxEndLine),endColumn:Number(node.dataset.mdxEndColumn)}:null;}
export function headingPath(element:Element|null|undefined,y=innerHeight/2):HeadingLocation[]{
 const context=readingContext(element),local=element?.closest('article.document'),article=articleOf(element);
 if(!local&&new URL(context.url).pathname!==location.pathname)return [{id:new URL(context.url).hash.slice(1),text:context.title,level:1}];
 const headings=[...article.querySelectorAll('h1,h2,h3,h4,h5,h6')],path:HeadingLocation[]=[];
 for(const heading of headings){const before=element&&article.contains(element)?heading===element||heading.contains(element)||Boolean(heading.compareDocumentPosition(element)&Node.DOCUMENT_POSITION_FOLLOWING):heading.getBoundingClientRect().top<=y;
  if(!before)break;const level=Number(heading.tagName[1]);while(path.length&&path.at(-1)!.level>=level)path.pop();path.push({id:heading.id,text:heading.textContent||'',level});
 }return path.length?path:[{id:headings[0]?.id||'',text:headings[0]?.textContent||document.title,level:1}];
}
export function articleContext(element:Element|null|undefined,y?:number):ReaderArticleContext{
 const context=readingContext(element),article=articleOf(element),headings=headingPath(element,y),url=new URL(element?.closest('[data-page-viewer=article]')?context.url:location.href),id=headings.at(-1)?.id||'';url.hash=context.scopeId&&id.startsWith(context.scopeId+'-')?id.slice(context.scopeId.length+1):id;
 const zone=element?.closest('[data-page-viewer=article]')?'文章浮窗':element?.closest('[data-code-viewer]')?'源码弹窗':element?.closest('.repo-tree')?'目录':element?.closest('header')?'顶部':article.contains(element||null)?'正文':'页面';
 return {title:context.title||article.querySelector('h1')?.textContent||document.title,repository:context.repositoryName,version:context.version,commit:context.commit,file:context.mdxFile,headings:headings.map(h=>h.text),url:url.href,zone,source:sourceLocation(element)};
}
export function textContext(range:Range):ReaderTextContext{
 const start=elementOf(range.startContainer)||document.body,end=elementOf(range.endContainer)||document.body,rect=range.getBoundingClientRect(),context=articleContext(start,rect.top);
 const first=sourceLocation(start),last=sourceLocation(end);if(first)context.source={...first,endLine:last?.endLine||first.endLine,endColumn:last?.endColumn||first.endColumn};
 const root=start.closest('[data-code-viewer],article.document,.repo-tree,header')||document.body,prefix=document.createRange();prefix.selectNodeContents(root);prefix.setEnd(range.startContainer,range.startOffset);
 const offsetNumber=prefix.toString().length,text=range.toString(),locator=`${boundary(range.startContainer,range.startOffset)} → ${boundary(range.endContainer,range.endOffset)} (UTF-16)`,offset=`${domPath(root)} text[${offsetNumber}:${offsetNumber+text.length}]`;
 const viewer=start.closest<HTMLElement>('[data-code-viewer]');
 if(viewer?.dataset.sourceFile){const line=start.closest<HTMLElement>('.source-line')?.dataset.line,endLine=end.closest<HTMLElement>('.source-line')?.dataset.line;context.originalSource=viewer.dataset.sourceFile+(line?`:L${line}${endLine&&endLine!==line?'-L'+endLine:''}`:'');}
 return {...context,text,locator,offset};
}
export function sourceLabel(context:ReaderArticleContext){const p=context.source;return context.originalSource||(context.file+(p?`:L${p.line}:C${p.column}-L${p.endLine}:C${p.endColumn}`:''));}
export function formatTextAnnotation(context:ReaderTextContext,comment:string){
 return ['【文字批注】',`文章：${context.title}`,context.repository&&`仓库：${context.repository}`,context.commit&&`版本：${context.commit}`,`位置：${context.headings.join(' / ')}`,`区域：${context.zone}`,`来源：${sourceLabel(context)}`,`链接：${context.url}`,`选区：${context.locator}`,`文字范围：${context.offset}`,'','原文：',context.text,'','批注：',comment].filter(line=>line!==undefined&&line!==null).join('\n');
}
export function imageLocation(rect:Pick<DOMRect,'left'|'right'|'top'|'bottom'|'width'|'height'>):ReaderImageContext{
 const element=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2),context=articleContext(element,rect.top);
 const intersects=(node:Element)=>{const box=node.getBoundingClientRect();return box.width&&box.height&&box.left<rect.right&&box.right>rect.left&&box.top<rect.bottom&&box.bottom>rect.top;};
 const intersecting=[...document.querySelectorAll<HTMLElement>('.document [data-mdx-line]')].filter(intersects);
 const blocks=intersecting.filter(node=>!intersecting.some(child=>child!==node&&node.contains(child)));
 if(blocks.length)context.source={line:Math.min(...blocks.map(n=>Number(n.dataset.mdxLine))),column:1,endLine:Math.max(...blocks.map(n=>Number(n.dataset.mdxEndLine))),endColumn:1};
 const dialog=element?.closest<HTMLElement>('[data-code-viewer]');
 if(dialog?.dataset.sourceFile){const rows=[...dialog.querySelectorAll<HTMLElement>('.source-line')].filter(intersects);context.originalSource=dialog.dataset.sourceFile+(rows.length?':L'+rows[0].dataset.line+'-L'+rows.at(-1)!.dataset.line:'');}
 const rectangle={x:Math.round(rect.left+scrollX),y:Math.round(rect.top+scrollY),width:Math.round(rect.width),height:Math.round(rect.height)};return {...context,rectangle};
}
