export function $<K extends keyof HTMLElementTagNameMap>(selector: K, root?: ParentNode): HTMLElementTagNameMap[K] | null;
export function $<T extends Element = HTMLElement>(selector: string, root?: ParentNode): T | null;
export function $(selector: string,root: ParentNode=document){return root.querySelector(selector);}
export const $$=<T extends Element = HTMLElement>(selector: string,root: ParentNode=document)=>[...root.querySelectorAll<T>(selector)];
export function required<T extends Element = HTMLElement>(selector: string,root: ParentNode=document): T {
 const node=root.querySelector<T>(selector);if(!node)throw Error('Missing required element: '+selector);return node;
}
export const closest=(event: Event,selector: string)=>event.target instanceof Element?event.target.closest<HTMLElement>(selector):null;
export function svg(parts: [string, Record<string,string | number>][],viewBox='0 0 20 20'){
 const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
 icon.setAttribute('viewBox',viewBox);icon.setAttribute('aria-hidden','true');
 for(const [tag,attributes] of parts){const node=document.createElementNS(icon.namespaceURI,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));icon.append(node);}
 return icon;
}
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
export function notice(message: string){const node=$('#notice');if(!node)return;node.textContent=message;node.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>node.classList.remove('show'),2000);}
export function downloadUrl(url: string,filename: string){const link=document.createElement('a');link.href=url;link.download=filename;link.hidden=true;document.body.append(link);link.click();link.remove();}
export function downloadText(text: string,filename: string){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));downloadUrl(url,filename);setTimeout(()=>URL.revokeObjectURL(url),1000);}
