export * from './code-props.js';
import {parseFpUrl,fpHref} from './fp-links.js';
import {articleBasePath} from './article-pages.js';
export const codeHref=(file,ranges=[])=>fpHref([{type:'code',props:{file,ranges}}]);
export const blockHref=block=>fpHref([{type:'code',props:{block,ranges:[]}}]);
export function internalCodeTargets(hrefs,base,blocks={}){
 const queue=[...hrefs],seen=new Set(),targets=[];
 for(const href of queue){
  if(href.startsWith('#'))continue;
  const url=new URL(href,base);if(seen.has(url.href))continue;seen.add(url.href);
  for(const {props:target}of parseFpUrl(href,base,{samePage:false})||[]){
   if(target.file){targets.push({target,url});continue;}
   if(articleBasePath(url.pathname)!==articleBasePath(new URL(base).pathname)||!Object.hasOwn(blocks,target.block))continue;
   const block=blocks[target.block];
   if(block.src)targets.push({target:{file:block.src,ranges:block.ranges},block,url});
   for(const {href}of block.links||[])queue.push(new URL(href,url).href);
  }
 }
 return targets;
}
export * from './code-props.js';
