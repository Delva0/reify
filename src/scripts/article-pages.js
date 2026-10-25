import {canonicalArticlePath,redirectArticleAnchor} from '../lib/article-pages.js';
import {articlePageCache} from '../lib/page-cache.js';
let manifest;const documents=new Map();
const blockProviders=new Set();
export function registerArticleBlocks(provider){blockProviders.add(provider);return ()=>blockProviders.delete(provider);}
const articleManifest=()=>manifest??=JSON.parse(document.querySelector('#article-pages')?.textContent||'{"anchors":{}}');
export function resetArticlePages(){manifest=undefined;}
export function initArticlePages(){
 addEventListener('hashchange',()=>redirectArticleAnchor(articleManifest(),href=>{
  document.dispatchEvent(new CustomEvent('reify:navigate',{detail:{href,replace:true}}));
 }));
}
export async function articleCodeBlock(id){
 const local=document.getElementById(id);if(local)return local;
 for(const provider of blockProviders){const block=provider(id);if(block)return block;}
 const anchors=articleManifest().anchors,href=Object.hasOwn(anchors,id)?anchors[id]:null;if(!href)return null;
 const url=new URL(href,location.href);if(url.origin!==location.origin||canonicalArticlePath(url.pathname)===canonicalArticlePath(location.pathname))return null;
 if(!documents.has(url.href))documents.set(url.href,articlePageCache.read(url.href).then(html=>new DOMParser().parseFromString(html,'text/html')).catch(error=>{documents.delete(url.href);throw error;}));
 return (await documents.get(url.href)).getElementById(id);
}
