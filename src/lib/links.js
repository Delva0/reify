const page=pathname=>pathname.replace(/\.html$/,'').replace(/\/index$/,'').replace(/\/$/,'')||'/';
export function linkKind(href,base='https://local.invalid/'){
 if(!href)return;
 try{const current=new URL(base),url=new URL(href,current);if(!/^https?:$/.test(url.protocol))return;if(url.origin!==current.origin)return 'external';if(page(url.pathname)!==page(current.pathname))return 'page';}catch{}
}
export const isExternalLink=(href,base)=>linkKind(href,base)==='external';
export function markLink(link,base=location.href){const kind=link.dataset?.fpTarget?undefined:linkKind(link.getAttribute('href'),base);link.setAttribute('data-link','');if(kind)link.dataset.linkKind=kind;else link.removeAttribute('data-link-kind');return link;}
