import {parseFragment,serialize,html as parseHtml} from 'parse5';
import {headingPages} from '../lib/article-pages.js';
import {linkKind} from '../lib/links.js';
import {normalizeCodeBlock} from '../lib/code-block.js';
import type {CodeDefinition} from '../lib/data-types.js';
import {attribute,children,isElement,setAttribute as set,textContent as text,walkHtml as walk,cloneChildren as clone} from './html-tree.js';
import type {HtmlNode,HtmlChild,HtmlElement} from './html-tree.js';
import {jsonRecord} from './data.js';
interface Heading {depth: number; slug: string; text: string}
interface PageHeading extends Heading {pageId: string; href: string}
interface ArticlePage {id: string; title: string; href: string; headings: PageHeading[]; html: string; references: string[]}
const documents=new Map<string,Promise<ReturnType<typeof paginateArticle>>>();
const attr=(node: HtmlNode,name: string)=>attribute(node,name)?.value;
const has=(node: HtmlNode,name: string)=>Boolean(attribute(node,name));
const containsAnchor=(node: HtmlNode): boolean=>isElement(node)&&node.tagName==='a'||children(node).some(containsAnchor);
function linkHeading(heading: HtmlElement,href: string){
 const nodes: HtmlChild[]=[];let run: HtmlChild[]=[];
 const flush=()=>{if(!run.length)return;if(run.some(node=>text(node).trim()))nodes.push({nodeName:'a',tagName:'a',namespaceURI:parseHtml.NS.HTML,attrs:[{name:'class',value:'heading-link'},{name:'href',value:href},{name:'data-link',value:''}],childNodes:run,parentNode:heading});else nodes.push(...run);run=[];};
 for(const child of heading.childNodes){if(containsAnchor(child)){flush();nodes.push(child);}else run.push(child);}flush();heading.childNodes=nodes;
}
export function paginateArticle(html: string,base: string,{allowUntitled=false,title='文档'}={}){
 const root=parseFragment(html),headings: Heading[]=[],blocks: Record<string,CodeDefinition>=Object.create(null);
 walk(root,node=>{const value=attr(node,'data-code-definition');if(!value)return;const raw=jsonRecord(value,'CodeBlock'),block=normalizeCodeBlock({...raw,lines:raw.ranges});if(Object.hasOwn(blocks,block.id))throw Error('重复的 CodeBlock id：'+block.id);blocks[block.id]=block;});
 walk(root,node=>{if(!isElement(node)||!/^h[1-6]$/.test(node.tagName))return;const id=attr(node,'id')||'mdx-'+(headings.length+1);set(node,'id',id);headings.push({depth:Number(node.tagName[1]),slug:id,text:attr(node,'data-exact-heading')||text(node)});});
 if(!headings.length&&!allowUntitled)throw Error('MDX 文章至少需要一个标题');
 const entries=allowUntitled&&!headings.some(heading=>heading.depth===1)?[{id:base,title,href:base+'.html',headings:headings.map(heading=>({...heading,pageId:base,href:base+'.html#'+heading.slug}))}]:headingPages(headings,base);
 const pages: ArticlePage[]=entries.map(page=>({...page,html:'',references:[]})),byHeading=new Map(pages.flatMap((page,index)=>page.headings.map(heading=>[heading.slug,index] as const))),globals: HtmlChild[]=[];
 let current=0;
 const distribute=(node: HtmlChild): Map<number,HtmlChild>=>{
  if(has(node,'data-file-document'))return new Map([[current,node]]);
  if(has(node,'data-note-definitions')){globals.push(node);return new Map();}
  if(isElement(node)&&node.tagName==='h1'){const index=byHeading.get(attr(node,'id')||'');if(index===undefined)throw Error('文章标题缺少分页');current=index;}
  if(!children(node).length)return new Map([[current,node]]);
  const groups=new Map<number,HtmlChild[]>();
  for(const child of children(node))for(const [index,fragment]of distribute(child)){let group=groups.get(index);if(!group){group=[];groups.set(index,group);}group.push(fragment);}
  return new Map([...groups].map(([index,nodes],order)=>{const copy=clone(node,nodes);if(order)set(copy,'id',undefined);return [index,copy];}));
 };
 const fragments: HtmlChild[][]=pages.map(()=>[]);
 for(const child of root.childNodes)for(const [index,node]of distribute(child))fragments[index].push(node);
 const anchors: Record<string,string>=Object.create(null);
 fragments.forEach((nodes,index)=>nodes.forEach(node=>walk(node,item=>{for(const id of new Set([attr(item,'id'),attr(item,'data-code-reference')])){if(!id)continue;if(anchors[id]&&anchors[id]!==pages[index].href)throw Error('跨 H1 重复的 id：'+id);anchors[id]=pages[index].href;}})));
 pages.forEach((page,index)=>{
  const references=new Set<string>(),nodes=fragments[index];
  for(const node of nodes)walk(node,item=>{if(isElement(item)&&/^h[1-6]$/.test(item.tagName))linkHeading(item,'#'+attr(item,'id'));});
  for(const node of nodes)walk(node,item=>{
   if(!isElement(item)||item.tagName!=='a'||!has(item,'href'))return;
   let href=attr(item,'href')||'';
   if(href.startsWith('#')){let id='';try{id=decodeURIComponent(href.slice(1));}catch{}const target=anchors[id];if(target&&target!==page.href){href=target+href;set(item,'href',href);}}
   const kind=linkKind(href,'https://article.local/'+page.href);set(item,'data-link-kind',kind);references.add(href);
  });
  page.html=serialize({...root,childNodes:[...globals,...nodes]});page.references=[...references];
 });
 return {pages,blocks,headings:pages.flatMap(page=>page.headings),manifest:{pages:pages.map(({id,title,href})=>({id,title,href})),anchors}};
}
export async function prepareArticlePages(key: string,render: ()=>string | Promise<string>,base: string,cache=true){
 if(!cache)return paginateArticle(await render(),base);
 let pending=documents.get(key);if(!pending){pending=Promise.resolve().then(render).then(html=>paginateArticle(html,base)).catch(error=>{documents.delete(key);throw error;});documents.set(key,pending);}return pending;
}
