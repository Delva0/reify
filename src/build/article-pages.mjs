import {parseFragment,serialize} from 'parse5';
import {headingPages} from '../lib/article-pages.js';
import {linkKind} from '../lib/links.js';
const documents=new Map();
const attr=(node,name)=>node.attrs?.find(item=>item.name===name)?.value;
const has=(node,name)=>node.attrs?.some(item=>item.name===name);
function set(node,name,value){node.attrs||=[];const old=node.attrs.find(item=>item.name===name);if(value===undefined)node.attrs=node.attrs.filter(item=>item.name!==name);else if(old)old.value=value;else node.attrs.push({name,value});}
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
const walk=(node,visit)=>{visit(node);if(has(node,'data-file-document'))return;for(const child of node.childNodes||[])walk(child,visit);};
const clone=(node,children)=>({...node,attrs:node.attrs?.map(item=>({...item})),childNodes:children});
const containsAnchor=node=>node.tagName==='a'||(node.childNodes||[]).some(containsAnchor);
function linkHeading(heading,href){
 const children=[];let run=[];
 const flush=()=>{if(!run.length)return;if(run.some(node=>text(node).trim()))children.push({nodeName:'a',tagName:'a',namespaceURI:'http://www.w3.org/1999/xhtml',attrs:[{name:'class',value:'heading-link'},{name:'href',value:href},{name:'data-link',value:''}],childNodes:run});else children.push(...run);run=[];};
 for(const child of heading.childNodes){if(containsAnchor(child)){flush();children.push(child);}else run.push(child);}flush();heading.childNodes=children;
}
export function paginateArticle(html,base,{allowUntitled=false,title='文档'}={}){
 const root=parseFragment(html),headings=[],blocks=Object.create(null);
 walk(root,node=>{if(!has(node,'data-code-definition'))return;const block=JSON.parse(attr(node,'data-code-definition'));if(Object.hasOwn(blocks,block.id))throw Error('重复的 CodeBlock id：'+block.id);blocks[block.id]=block;});
 walk(root,node=>{if(!/^h[1-6]$/.test(node.tagName||''))return;const id=attr(node,'id')||'mdx-'+(headings.length+1);set(node,'id',id);headings.push({depth:Number(node.tagName[1]),slug:id,text:attr(node,'data-exact-heading')||text(node)});});
 if(!headings.length&&!allowUntitled)throw Error('MDX 文章至少需要一个标题');
 const pages=allowUntitled&&!headings.some(heading=>heading.depth===1)?[{id:base,title,href:base+'.html',headings:headings.map(heading=>({...heading,pageId:base,href:base+'.html#'+heading.slug}))}]:headingPages(headings,base),byHeading=new Map(pages.flatMap((page,index)=>page.headings.map(heading=>[heading.slug,index]))),globals=[];
 let current=0;
 const distribute=node=>{
  if(has(node,'data-file-document'))return new Map([[current,node]]);
  if(has(node,'data-note-definitions')){globals.push(node);return new Map();}
  if(node.tagName==='h1')current=byHeading.get(attr(node,'id'));
  if(!node.childNodes?.length)return new Map([[current,node]]);
  const groups=new Map();
  for(const child of node.childNodes)for(const [index,fragment]of distribute(child)){if(!groups.has(index))groups.set(index,[]);groups.get(index).push(fragment);}
  return new Map([...groups].map(([index,children],order)=>{const copy=clone(node,children);if(order)set(copy,'id',undefined);return [index,copy];}));
 };
 const fragments=pages.map(()=>[]);
 for(const child of root.childNodes)for(const [index,node]of distribute(child))fragments[index].push(node);
 const anchors=Object.create(null);
 fragments.forEach((nodes,index)=>nodes.forEach(node=>walk(node,item=>{const id=attr(item,'id');if(!id)return;if(anchors[id]&&anchors[id]!==pages[index].href)throw Error('跨 H1 重复的 id：'+id);anchors[id]=pages[index].href;})));
 pages.forEach((page,index)=>{
  const references=new Set(),nodes=fragments[index];
  for(const node of nodes)walk(node,item=>{if(/^h[1-6]$/.test(item.tagName||''))linkHeading(item,'#'+attr(item,'id'));});
  for(const node of nodes)walk(node,item=>{
   if(item.tagName!=='a'||!has(item,'href'))return;
   let href=attr(item,'href');
   if(href.startsWith('#')){let id;try{id=decodeURIComponent(href.slice(1));}catch{}const target=anchors[id];if(target&&target!==page.href){href=target+href;set(item,'href',href);}}
   const kind=linkKind(href,'https://article.local/'+page.href);set(item,'data-link-kind',kind);references.add(href);
  });
  page.html=serialize({...root,childNodes:[...globals,...nodes]});page.references=[...references];
 });
 return {pages,blocks,headings:pages.flatMap(page=>page.headings),manifest:{pages:pages.map(({id,title,href})=>({id,title,href})),anchors}};
}
export async function prepareArticlePages(key,render,base,cache=true){
 if(!cache)return paginateArticle(await render(),base);
 if(!documents.has(key))documents.set(key,Promise.resolve().then(render).then(html=>paginateArticle(html,base)).catch(error=>{documents.delete(key);throw error;}));
 return documents.get(key);
}
