import {parseFragment,serialize} from 'parse5';
import GithubSlugger from 'github-slugger';
import {parseFpUrl,fpHref} from '../lib/fp-links.js';

const attr=(node,name)=>node.attrs?.find(item=>item.name===name);
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
const removedElements=new Set(['script','style','iframe','object','embed','base','meta','link']);

function walk(node,visit){
 visit(node);
 // A nested document already owns its IDs, source URL and anchor map.
 if(attr(node,'data-file-document'))return;
 for(const child of node.childNodes||[])walk(child,visit);
 if(node.content)walk(node.content,visit);
}

function anchorIds(root,prefix){
 const ids=new Map();
 walk(root,node=>{
  const name=attr(node,'name');
  if(node.tagName==='a'&&name&&!attr(node,'id'))node.attrs.push({name:'id',value:name.value});
  const id=attr(node,'id');
  if(id)ids.set(id.value,prefix+'-'+id.value);
 });
 // Keep the article's exact mdx IDs, and make GitHub-style source links aliases
 // of those IDs. The slugger also handles repeated headings in source order.
 const slugger=new GithubSlugger();
 walk(root,node=>{
  if(!/^h[1-6]$/.test(node.tagName||''))return;
  const id=attr(node,'id');
  const slug=slugger.slug(attr(node,'data-exact-heading')?.value||text(node));
  if(id&&!ids.has(slug))ids.set(slug,ids.get(id.value));
 });
 return ids;
}

function scopedLink(ids,base){
 return href=>{
  if(href.startsWith('#')){
   let id=href.slice(1);
   try{id=decodeURIComponent(id);}catch{}
   return '#'+(ids.get(id)||href.slice(1));
  }
  const state=parseFpUrl(href,'https://document.invalid/index.html');
  if(state)return fpHref(state.map(item=>({
   ...item,
   props:{
    ...item.props,
    ...(item.props.block&&ids.has(item.props.block)?{block:ids.get(item.props.block)}:{}),
    ...(item.props.file&&base?{file:new URL(item.props.file,base).href}:{})
   }
  })));
  if(base&&href&&!/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href))return new URL(href,base).href;
  return href;
 };
}

function scopeDefinitions(node,{ids,prefix,base,link}){
 const note=attr(node,'data-note');
 if(note)note.value=prefix+'-'+note.value;
 const definitions=attr(node,'data-note-definitions');
 if(definitions){
  const entries=Object.entries(JSON.parse(definitions.value));
  definitions.value=JSON.stringify(Object.fromEntries(entries.map(([key,value])=>[prefix+'-'+key,value])));
 }
 const definition=attr(node,'data-code-definition');
 if(definition){
  const block=JSON.parse(definition.value);
  block.id=ids.get(block.id)||block.id;
  if(block.src&&base)block.src=new URL(block.src,base).href;
  block.links=block.links.map(item=>({...item,href:link(item.href)}));
  definition.value=JSON.stringify(block);
 }
}

export function scopeDocument(html,prefix,base){
 const root=parseFragment(html);
 const ids=anchorIds(root,prefix);
 const link=scopedLink(ids,base);
 walk(root,node=>{
  const id=attr(node,'id');
  if(id&&ids.has(id.value))id.value=ids.get(id.value);
  scopeDefinitions(node,{ids,prefix,base,link});
  const href=attr(node,'href');
  if(href)href.value=link(href.value);
  const src=attr(node,'src');
  if(src&&base)src.value=new URL(src.value,base).href;
  if(node.attrs)node.attrs=node.attrs.filter(item=>!/^on/i.test(item.name)&&!(['href','src'].includes(item.name)&&/^\s*(javascript|vbscript):/i.test(item.value)));
  if(node.childNodes)node.childNodes=node.childNodes.filter(child=>!removedElements.has(child.tagName));
 });
 return serialize(root);
}
