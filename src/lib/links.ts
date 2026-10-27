const page=(pathname: string)=>pathname.replace(/\.html$/,'').replace(/\/index$/,'').replace(/\/$/,'')||'/';
export function linkKind(href: string|null|undefined,base='https://local.invalid/'){
 if(!href)return;
 try{const current=new URL(base),url=new URL(href,current);if(!/^https?:$/.test(url.protocol))return;if(url.origin!==current.origin)return 'external';if(page(url.pathname)!==page(current.pathname))return 'page';}catch{}
}
export const isExternalLink=(href: string|null|undefined,base?: string)=>linkKind(href,base)==='external';
export function markLink<T extends HTMLElement>(link: T,base=location.href){const kind=link.dataset?.fpTarget?undefined:linkKind(link.getAttribute('href'),base);link.setAttribute('data-link','');if(kind)link.dataset.linkKind=kind;else link.removeAttribute('data-link-kind');return link;}
