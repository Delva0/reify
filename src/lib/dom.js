export const $=(selector,root=document)=>root.querySelector(selector);
export const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
export const closest=(event,selector)=>event.target instanceof Element?event.target.closest(selector):null;
export function svg(parts,viewBox='0 0 20 20'){
 const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
 icon.setAttribute('viewBox',viewBox);icon.setAttribute('aria-hidden','true');
 for(const [tag,attributes] of parts){const node=document.createElementNS(icon.namespaceURI,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));icon.append(node);}
 return icon;
}
let noticeTimer;
export function notice(message){const node=$('#notice');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>node.classList.remove('show'),2000);}
export function downloadUrl(url,filename){const link=document.createElement('a');link.href=url;link.download=filename;link.hidden=true;document.body.append(link);link.click();link.remove();}
export function downloadText(text,filename){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));downloadUrl(url,filename);setTimeout(()=>URL.revokeObjectURL(url),1000);}
