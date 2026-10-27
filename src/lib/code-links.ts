export * from './code-props.js';
import {parseFpUrl,fpHref} from './fp-links.js';
import {articleBasePath} from './article-pages.js';
import type {CodeDefinition,LineRangeInput} from './data-types.js';
export const codeHref=(file: string,ranges: LineRangeInput[]=[])=>fpHref([{type:'code',props:{file,ranges}}]);
export const blockHref=(block: string)=>fpHref([{type:'code',props:{block,ranges:[]}}]);
export interface InternalCodeTarget {target: {file: string; ranges?: LineRangeInput[]}; block?: CodeDefinition; url: URL}
export function internalCodeTargets(hrefs: Iterable<string>,base: string,blocks: Record<string,CodeDefinition>={}): InternalCodeTarget[]{
 const queue=[...hrefs],seen=new Set<string>(),targets: InternalCodeTarget[]=[];
 for(const href of queue){
  if(href.startsWith('#'))continue;
  const url=new URL(href,base);if(seen.has(url.href))continue;seen.add(url.href);
  for(const state of parseFpUrl(href,base,{samePage:false})||[]){
   if(state.type!=='code')continue;const target=state.props;
   if(target.file){targets.push({target:{file:target.file,ranges:target.ranges},url});continue;}
   if(!target.block||articleBasePath(url.pathname)!==articleBasePath(new URL(base).pathname)||!Object.hasOwn(blocks,target.block))continue;
   const block=blocks[target.block];
   if(block.src)targets.push({target:{file:block.src,ranges:block.ranges},block,url});
   for(const {href}of block.links||[])queue.push(new URL(href,url).href);
  }
 }
 return targets;
}
