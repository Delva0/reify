import {isRecord} from '../lib/data-types.js';
import type {ArticlePage} from '../lib/article-pages.js';
export interface ClientArticleManifest {anchors: Record<string,string>; pages: ArticlePage[]; source?: {href: string; file: string; language: string}}
export function parseArticleManifest(text: string): ClientArticleManifest {
 const value: unknown=JSON.parse(text);if(!isRecord(value))throw Error('Invalid article manifest');
 const anchors: Record<string,string>={};if(isRecord(value.anchors))for(const [id,href]of Object.entries(value.anchors))if(typeof href==='string')anchors[id]=href;
 const pages: ArticlePage[]=[];if(Array.isArray(value.pages))for(const page of value.pages){if(!isRecord(page)||typeof page.id!=='string'||typeof page.href!=='string'||typeof page.title!=='string')throw Error('Invalid article page');pages.push({id:page.id,href:page.href,title:page.title,headings:[]});}
 const source=isRecord(value.source)&&typeof value.source.href==='string'&&typeof value.source.file==='string'&&typeof value.source.language==='string'?{href:value.source.href,file:value.source.file,language:value.source.language}:undefined;return {anchors,pages,source};
}
import {canonicalArticlePath,redirectArticleAnchor} from '../lib/article-pages.js';
import {articlePageCache} from '../lib/page-cache.js';
let manifest: ClientArticleManifest | undefined;const documents=new Map<string,Promise<Document>>();
const blockProviders=new Set<(id: string)=>HTMLElement | null | Promise<HTMLElement | null>>();
export function registerArticleBlocks(provider: (id: string)=>HTMLElement | null | Promise<HTMLElement | null>){blockProviders.add(provider);return ()=>blockProviders.delete(provider);}
const articleManifest=()=>manifest??=parseArticleManifest(document.querySelector('#article-pages')?.textContent||'{"anchors":{}}');
export function resetArticlePages(){manifest=undefined;}
export function initArticlePages(){
 addEventListener('hashchange',()=>redirectArticleAnchor(articleManifest(),href=>{
  document.dispatchEvent(new CustomEvent('reify:navigate',{detail:{href,replace:true}}));
 }));
}
/** Locate a code block locally or load its article page on demand. */
export async function articleCodeBlock(id: string){
 const local=document.getElementById(id);if(local)return local;
 for(const provider of blockProviders){const block=await provider(id);if(block)return block;}
 const anchors=articleManifest().anchors,href=Object.hasOwn(anchors,id)?anchors[id]:null;if(!href)return null;
 const url=new URL(href,location.href);if(url.origin!==location.origin||canonicalArticlePath(url.pathname)===canonicalArticlePath(location.pathname))return null;
 if(!documents.has(url.href))documents.set(url.href,articlePageCache.read(url.href).then(html=>new DOMParser().parseFromString(html,'text/html')).catch(error=>{documents.delete(url.href);throw error;}));
 return (await documents.get(url.href)!).getElementById(id);
}
