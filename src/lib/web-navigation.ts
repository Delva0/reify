import {parseFpUrl} from './fp-links.js';
import {linkPanelState} from './link-panels.js';
export const webDocumentKey=(href: string)=>{const url=new URL(href);url.hash='';return url.href;};
export function webDocumentRestriction(headers: Pick<Headers,'get'>){
 const ancestors=headers.get('content-security-policy')?.match(/(?:^|;)\s*frame-ancestors\s+([^;]+)/i)?.[1]?.trim();
 if(ancestors){if(["'none'","'self'"].includes(ancestors))return 'embedding';}
 else if(/^(?:deny|sameorigin)$/i.test(headers.get('x-frame-options')?.trim()||''))return 'embedding';
 const type=headers.get('content-type');if(type&&!/\btext\/html\b/i.test(type))return 'content-type';
 return null;
}
export function externalPageTarget(link: HTMLElement|null|undefined,event: MouseEvent,base: string,current: string,known: (href: string)=>boolean){
 if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.hasAttribute('download'))return null;
 const parsed=parseFpUrl(link.dataset?.fpTarget||link.getAttribute('href')||'',current),fallback=parsed?null:linkPanelState(link,event,base,current),state=parsed||(fallback?[fallback]:[]),target=state.at(-1);
 if(target?.type!=='page')return null;
 const url=new URL(target.props.url,current);return url.origin!==new URL(current).origin&&known(url.href)?url.href:null;
}
