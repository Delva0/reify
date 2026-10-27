import {linkKind} from './links.js';
import {sourceLanguage} from './code-language.js';
import type {FpState} from './data-types.js';
export function linkPanelState(link: HTMLElement|null|undefined,event: MouseEvent,base: string,current: string): FpState|null{
 if(!link||link.dataset?.fpTarget||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.hasAttribute('download'))return null;
 if(!link.closest('.document,[data-source-code],.annotation-desc,[data-page-address]')||link.closest('.document-outline,.repo-tree,.github-files,.repo-header'))return null;
 return readingLinkState(link.getAttribute('href'),base,current);
}
export function readingLinkState(href: string|null|undefined,base: string,current=base): FpState|null{
 if(!href||href.startsWith('#'))return null;
 let url;try{url=new URL(href,base);}catch{return null;}
 if(!linkKind(url.href,base))return null;
 const language=sourceLanguage(url.pathname),source=/^\/(?:[^/]+\/){2}blob\//.test(url.pathname)&&url.hostname==='github.com'||url.hostname==='raw.githubusercontent.com';
 const asset=language!=='text'&&language!=='html'||/\.(?:png|jpe?g|gif|webp|avif|svg)$/i.test(url.pathname);
 if(source||asset){const lines=url.hash.match(/^#L(\d+)(?:-L?(\d+))?$/),ranges=lines?[{from:Number(lines[1]),to:Number(lines[2]||lines[1])}]:[];return {type:'code',props:{file:url.href,ranges}};}
 return {type:'page',props:{url:url.origin===new URL(current).origin?url.pathname+url.search+url.hash:url.href}};
}
