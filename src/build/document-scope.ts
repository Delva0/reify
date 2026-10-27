import {parseFragment,serialize} from 'parse5';
import GithubSlugger from 'github-slugger';
import {parseFpUrl,fpHref} from '../lib/fp-links.js';
import {normalizeCodeBlock} from '../lib/code-block.js';
import {attribute as attr,isElement,children,setAttribute as set,textContent as text} from './html-tree.js';
import type {HtmlNode} from './html-tree.js';
import {jsonRecord} from './data.js';
const removedElements=new Set(['script','style','iframe','object','embed','base','meta','link']);
function walk(node: HtmlNode,visit: (node: HtmlNode)=>void){
 visit(node);
 // A nested document already owns its IDs, source URL and anchor map.
 if(attr(node,'data-file-document'))return;
 for(const child of children(node))walk(child,visit);
 if('content' in node)walk(node.content,visit);
}
function anchorIds(root: HtmlNode,prefix: string,anchors: Record<string,string>){
 const ids=new Map(Object.keys(anchors).map(id=>[id,prefix+'-'+id]));
 walk(root,node=>{
  const name=attr(node,'name');
  if(isElement(node)&&node.tagName==='a'&&name&&!attr(node,'id'))node.attrs.push({name:'id',value:name.value});
  const id=attr(node,'id');if(id)ids.set(id.value,prefix+'-'+id.value);
 });
 // Keep the article's exact mdx IDs, and make GitHub-style source links aliases
 // of those IDs. The slugger also handles repeated headings in source order.
 const slugger=new GithubSlugger();
 walk(root,node=>{
  if(!isElement(node)||!/^h[1-6]$/.test(node.tagName))return;
  const id=attr(node,'id'),slug=slugger.slug(attr(node,'data-exact-heading')?.value||text(node));
  const scoped=id&&ids.get(id.value);if(scoped&&!ids.has(slug))ids.set(slug,scoped);
 });return ids;
}
function codeReferences(root: HtmlNode,referencePrefix: string){
 const references=new Map<string,string>();
 walk(root,node=>{
  const definition=attr(node,'data-code-definition');
  if(!definition&&!attr(node,'class')?.value.split(/\s+/).includes('code-block'))return;
  const block=definition?jsonRecord(definition.value,'CodeBlock'):undefined,id=attr(node,'id')?.value;
  const original=attr(node,'data-code-original-id')?.value||id||(typeof block?.id==='string'?block.id:undefined);
  if(!original)return;const reference=referencePrefix+'-'+original;
  for(const alias of [id,block?.id,attr(node,'data-code-reference')?.value])if(typeof alias==='string'&&alias)references.set(alias,reference);
  set(node,'data-code-original-id',original);set(node,'data-code-reference',reference);
 });return references;
}
function scopedLink(ids: Map<string,string>,references: Map<string,string>,referencePrefix: string,base: string | undefined,resourceBase: string | undefined,anchors: Record<string,string>){
 return (href: string)=>{
  if(href.startsWith('#')){let id=href.slice(1);try{id=decodeURIComponent(id);}catch{}return '#'+(ids.get(id)||href.slice(1));}
  const state=parseFpUrl(href,'https://document.invalid/index.html');
  if(state)return fpHref(state.map(item=>{
   if(item.type!=='code')return item;
   if(item.props.block&&(references.has(item.props.block)||ids.has(item.props.block)))return {...item,props:{...item.props,block:references.get(item.props.block)||referencePrefix+'-'+item.props.block}};
   if(item.props.file&&resourceBase)return {...item,props:{...item.props,file:new URL(item.props.file,resourceBase).href}};
   return item;
  }));
  if(base&&href){
   const url=new URL(href,base);let id='';try{id=decodeURIComponent(url.hash.slice(1));}catch{}
   if(id&&Object.hasOwn(anchors,id)){
    const target=new URL(anchors[id],base),path=(value: URL)=>value.pathname.replace(/\.html$/,'').replace(/\/$/,'');
    if(url.origin===target.origin&&path(url)===path(target))return '#'+ids.get(id);
   }
   if(!/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href))return url.href;
  }return href;
 };
}
function scopeDefinitions(node: HtmlNode,{references,prefix,resourceBase,link}: {references: Map<string,string>; prefix: string; resourceBase?: string; link: (href: string)=>string}){
 const note=attr(node,'data-note');if(note)note.value=prefix+'-'+note.value;
 const definitions=attr(node,'data-note-definitions');
 if(definitions){const entries=Object.entries(jsonRecord(definitions.value,'note definitions'));definitions.value=JSON.stringify(Object.fromEntries(entries.map(([key,value])=>[prefix+'-'+key,value])));}
 const definition=attr(node,'data-code-definition');
 if(definition){
  const raw=jsonRecord(definition.value,'CodeBlock'),block=normalizeCodeBlock({...raw,lines:raw.ranges});block.id=references.get(block.id)||block.id;
  if(block.src&&resourceBase)block.src=new URL(block.src,resourceBase).href;
  block.links=block.links.map(item=>({...item,href:link(item.href)}));definition.value=JSON.stringify(block);
 }
}
export function scopeDocument(html: string,prefix: string,base?: string,{resourceBase=base,anchors={},referencePrefix=prefix}: {resourceBase?: string; anchors?: Record<string,string>; referencePrefix?: string}={}){
 const root=parseFragment(html),ids=anchorIds(root,prefix,anchors),references=codeReferences(root,referencePrefix),link=scopedLink(ids,references,referencePrefix,base,resourceBase,anchors);
 walk(root,node=>{
  const id=attr(node,'id'),scoped=id&&ids.get(id.value);if(id&&scoped)id.value=scoped;
  scopeDefinitions(node,{references,prefix,resourceBase,link});
  const href=attr(node,'href');if(href)href.value=link(href.value);
  const target=attr(node,'data-fp-target');if(target)target.value=link(target.value);
  const src=attr(node,'src');if(src&&base)src.value=new URL(src.value,base).href;
  if(isElement(node))node.attrs=node.attrs.filter(item=>!/^on/i.test(item.name)&&!(['href','src'].includes(item.name)&&/^\s*(javascript|vbscript):/i.test(item.value)));
  if('childNodes' in node)node.childNodes=node.childNodes.filter(child=>!isElement(child)||!removedElements.has(child.tagName));
 });return serialize(root);
}
