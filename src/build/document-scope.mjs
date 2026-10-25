import {parseFragment,serialize} from 'parse5';
import {parseFpUrl,fpHref} from '../lib/fp-links.js';
import GithubSlugger from 'github-slugger';
const attr=(node,name)=>node.attrs?.find(item=>item.name===name),set=(node,name,value)=>{const item=attr(node,name);if(item)item.value=value;};
const walk=(node,visit)=>{visit(node);if(attr(node,'data-file-document'))return;for(const child of node.childNodes||[])walk(child,visit);if(node.content)walk(node.content,visit);};
export function scopeDocument(html,prefix,base){
 const root=parseFragment(html),ids=new Map(),slugger=new GithubSlugger(),text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
 walk(root,node=>{if(node.tagName==='a'&&attr(node,'name')&&!attr(node,'id'))node.attrs.push({name:'id',value:attr(node,'name').value});const id=attr(node,'id');if(id)ids.set(id.value,prefix+'-'+id.value);});
 walk(root,node=>{if(/^h[1-6]$/.test(node.tagName||'')){const id=attr(node,'id'),slug=slugger.slug(attr(node,'data-exact-heading')?.value||text(node));if(id&&!ids.has(slug))ids.set(slug,ids.get(id.value));}});
 const link=href=>{if(href.startsWith('#'))return '#'+(ids.get(href.slice(1))||href.slice(1));const state=parseFpUrl(href,'https://document.invalid/index.html');if(state)return fpHref(state.map(item=>({...item,props:{...item.props,...(item.props.block&&ids.has(item.props.block)?{block:ids.get(item.props.block)}:{}),...(item.props.file&&base?{file:new URL(item.props.file,base).href}:{})}})));if(base&&href&&!/^(?:[a-z][\w+.-]*:|\/\/)/i.test(href))return new URL(href,base).href;return href;};
 walk(root,node=>{
  const id=attr(node,'id');if(id&&ids.has(id.value))id.value=ids.get(id.value);
  const note=attr(node,'data-note');if(note)note.value=prefix+'-'+note.value;
  const definitions=attr(node,'data-note-definitions');if(definitions)definitions.value=JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(definitions.value)).map(([key,value])=>[prefix+'-'+key,value])));
  const definition=attr(node,'data-code-definition');if(definition){const block=JSON.parse(definition.value);block.id=ids.get(block.id)||block.id;if(block.src&&base)block.src=new URL(block.src,base).href;block.links=block.links.map(item=>({...item,href:link(item.href)}));definition.value=JSON.stringify(block);}
  const href=attr(node,'href');if(href)href.value=link(href.value);
  const src=attr(node,'src');if(src&&base)src.value=new URL(src.value,base).href;
  if(node.attrs)node.attrs=node.attrs.filter(item=>!/^on/i.test(item.name)&&!(['href','src'].includes(item.name)&&/^\s*(javascript|vbscript):/i.test(item.value)));
  if(node.childNodes)node.childNodes=node.childNodes.filter(child=>!['script','style','iframe','object','embed','base','meta','link'].includes(child.tagName));
 });return serialize(root);
}
