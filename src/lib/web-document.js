import {parse,serialize} from 'parse5';
import {webDocumentBootstrap} from './web-document-frame.js';
import {bindNativeClose} from './native-close.js';
export {webDocumentKey} from './web-navigation.js';

const attribute=(node,name)=>node.attrs?.find(item=>item.name===name)?.value;
const set=(node,name,value)=>{node.attrs||=[];const old=node.attrs.find(item=>item.name===name);if(old)old.value=value;else node.attrs.push({name,value});};
const children=node=>[...(node.childNodes||[]),...(node.content?.childNodes||[])];
const text=node=>node.nodeName==='#text'?node.value:children(node).map(text).join('');
const element=(tag,attrs={},value)=>{const node={nodeName:tag,tagName:tag,namespaceURI:'http://www.w3.org/1999/xhtml',attrs:Object.entries(attrs).map(([name,value])=>({name,value})),childNodes:[]};if(value!==undefined)node.childNodes.push({nodeName:'#text',value,parentNode:node});return node;};
const all=(node,predicate)=>children(node).flatMap(child=>[...(predicate(child)?[child]:[]),...all(child,predicate)]);
const forbidden=new Set(['script','iframe','object','embed','base','noscript']);
const unsafe=value=>/^\s*(?:javascript|vbscript|file):/i.test(value);
export function webDocumentLinks(html,base){
 const origin=new URL(base).origin,links=new Set();
 for(const node of all(parse(html),node=>node.tagName==='a'))try{const url=new URL(attribute(node,'href'),base);url.hash='';if(/^https?:$/.test(url.protocol)&&url.origin!==origin&&!url.username&&!url.password)links.add(url.href);}catch{}
 return [...links];
}
export function webDocumentHasContent(html){
 const root=parse(html),body=all(root,node=>node.tagName==='body')[0];
 const readable=node=>['style','script','template'].includes(node.tagName)?'':node.nodeName==='#text'?node.value:children(node).map(readable).join('');
 return Boolean(readable(body).trim()||all(body,node=>['img','svg','video','audio','canvas'].includes(node.tagName)).length);
}

export function webEmbeddingAllowed(headers){
 const frame=headers.get('x-frame-options');if(frame&&!/^\s*allowall\s*$/i.test(frame))return false;
 const ancestors=headers.get('content-security-policy')?.match(/(?:^|;)\s*frame-ancestors\s+([^;]+)/i)?.[1]?.trim();
 return !ancestors||ancestors==='*';
}

export function absoluteCss(css,base){
 return css.replace(/@charset\s+["'][^"']*["']\s*;/gi,'').replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi,(original,a,b,c)=>{
  const value=(a??b??c).trim();if(!value||value.startsWith('#')||value.startsWith('data:'))return original;
  if(unsafe(value))return 'url("")';try{return 'url('+JSON.stringify(new URL(value,base).href)+')';}catch{return 'url("")';}
 });
}

export async function prepareWebDocument(html,url,{loadStyle,styleLimit=64}={}){
 const root=parse(html),head=all(root,node=>node.tagName==='head')[0],body=all(root,node=>node.tagName==='body')[0];
 const originalBase=all(head,node=>node.tagName==='base').map(node=>attribute(node,'href')).find(Boolean),candidate=new URL(originalBase||url,url),base=/^https?:$/.test(candidate.protocol)?candidate.href:url;
 let styles=0;const pending=new Map();
 const css=async(value,source,chain=[])=>{
  const imports=[...value.matchAll(/@import\s+(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)|"([^"]+)"|'([^']+)')\s*([^;]*);/gi)];
  for(const match of imports){
   const target=new URL(match[1]||match[2]||match[3]||match[4]||match[5],source).href,condition=match[6].trim();
   if(chain.includes(target)||chain.length>=6){value=value.replace(match[0],'');continue;}
   const fallback='@import url('+JSON.stringify(target)+') '+condition+';';
   if(!loadStyle||styles++>=styleLimit||/\b(?:layer|supports)\s*\(/i.test(condition)){value=value.replace(match[0],fallback);continue;}
   try{const nested=await sheet(target,[...chain,target]);value=value.replace(match[0],condition?'@media '+condition+'{'+nested+'}':nested);}catch{value=value.replace(match[0],fallback);}
  }
  return absoluteCss(value,source);
 };
 const sheet=async(source,chain=[])=>{if(!pending.has(source))pending.set(source,Promise.resolve().then(()=>loadStyle(source)));return css(await pending.get(source),source,chain);};
 const sanitize=async node=>{
  if(node.attrs)node.attrs=node.attrs.filter(item=>!/^on/i.test(item.name)&&!['autofocus','srcdoc','nonce','integrity'].includes(item.name)&&!(['href','src','xlink:href','action','formaction','background'].includes(item.name)&&unsafe(item.value)));
  if(node.tagName==='a'){
   const href=attribute(node,'href');if(href)try{const url=new URL(href,base);if(!/^(https?|mailto|tel):$/.test(url.protocol))throw Error();set(node,'href',url.href);}catch{node.attrs=node.attrs.filter(item=>item.name!=='href');}
   set(node,'target','_blank');set(node,'rel','noopener noreferrer');
  }
  if(node.tagName==='img')for(const [lazy,target]of [['data-src','src'],['data-original','src'],['data-srcset','srcset']]){const value=attribute(node,lazy);if(value&&(!attribute(node,target)||/^data:image/.test(attribute(node,target))))set(node,target,value);}
  if(node.tagName==='style'){const content=(await css(text(node),base)).replace(/<\/style/gi,'<\\/style');node.childNodes=element('style',{},content).childNodes;}
  const kept=[];
  for(let child of node.childNodes||[]){
   if(forbidden.has(child.tagName)||child.tagName==='meta'&&attribute(child,'http-equiv'))continue;
   if(child.tagName==='link'){
    if(!/\bstylesheet\b/i.test(attribute(child,'rel')||''))continue;
    const href=attribute(child,'href');
    if(loadStyle&&href&&styles++<styleLimit)try{child=element('style',attribute(child,'media')?{media:attribute(child,'media')}:{},await sheet(new URL(href,base).href));}catch{}
   }
   await sanitize(child);kept.push(child);child.parentNode=node;
  }
  node.childNodes=kept;if(node.content)await sanitize(node.content);
 };
 await sanitize(root);
 head.childNodes.unshift(element('base',{href:base}),element('meta',{charset:'utf-8'}),element('meta',{name:'referrer',content:'no-referrer'}));
 return {version:1,url,title:text(all(head,node=>node.tagName==='title')[0]||{}).trim()||new URL(url).hostname,html:serialize(root)};
}

export function webDocumentHtml(resource,{token,nonce,theme,engine,anchor,scrollbars,snapshot,externalLinks=[]}){
 const root=parse(snapshot||resource.html),html=all(root,node=>node.tagName==='html')[0],head=all(root,node=>node.tagName==='head')[0],body=all(root,node=>node.tagName==='body')[0];
 const color=(value,fallback)=>typeof value==='string'&&value.trim()&&!/[;{}<>]/.test(value)?value:fallback;
 set(html,'data-reify-theme',theme.dark?'dark':'light');set(html,'data-reify-pending','');
 set(html,'style',(attribute(html,'style')||'')+';--reify-paper:'+color(theme.paper,'#161616')+';--reify-ink:'+color(theme.ink,'#dedede'));
 const policy=`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' https: http:; img-src https: http: data: blob:; font-src https: http: data:; connect-src https: http: data: blob:; media-src https: http: blob:`;
 head.childNodes.unshift(element('meta',{'http-equiv':'Content-Security-Policy',content:policy}));
 // Present before the source styles or body can paint. Dark Reader ignores its
 // own style class, so this temporary palette does not affect color analysis.
 head.childNodes.splice(1,0,element('style',{class:'darkreader','data-reify-theme-guard':''},'html[data-reify-theme=dark][data-reify-pending],html[data-reify-theme=dark][data-reify-pending] body,html[data-reify-theme=dark][data-reify-pending] body *{background-color:var(--reify-paper)!important;background-image:none!important;color:var(--reify-ink)!important;border-color:var(--reify-ink)!important}html[data-reify-theme=dark]{color-scheme:dark}'));
 if(!snapshot)head.childNodes.push(element('script',{src:engine,nonce,async:'','data-reify-theme-engine':''}));
 const configuration=JSON.stringify({token,theme,anchor,scrollbars,cached:Boolean(snapshot),externalLinks}).replace(/</g,'\\u003c');
 body.childNodes.push(element('script',{nonce},'('+webDocumentBootstrap.toString()+')('+configuration+',('+bindNativeClose.toString()+'));'));
 return serialize(root);
}
