import {svg,notice} from '../lib/dom.js';
import {iconPaths,iconShapes} from '../lib/icon-definitions.js';
const sources=new WeakMap(),copyStates=new WeakMap();
export const codeIcon=name=>svg([...(iconShapes[name]||[]),...(iconPaths[name]?[['path',{d:iconPaths[name]}]]:[])]);
export function setCodeText(root,text){
 sources.set(root,text);
 for(const button of root.querySelectorAll('[data-code-copy],[data-code-wrap]'))button.disabled=text===null;
}
export function codeText(root){return sources.has(root)?sources.get(root):root.querySelector('pre>code')?.textContent??'';}
export async function copyCode(button,root){
 const text=codeText(root);if(text===null)return;
 try{
  await navigator.clipboard.writeText(text);
  let state=copyStates.get(button);if(!state){state={children:[...button.childNodes].map(node=>node.cloneNode(true)),timer:null};copyStates.set(button,state);}
  clearTimeout(state.timer);button.replaceChildren(codeIcon('check'));button.dataset.copied='true';button.setAttribute('aria-label','已复制');
  state.timer=setTimeout(()=>{button.replaceChildren(...state.children.map(node=>node.cloneNode(true)));delete button.dataset.copied;button.setAttribute('aria-label','复制代码');},1600);
 }catch{notice('复制失败，请选中代码复制');}
}
export function toggleCodeWrap(button,root){
 const pre=root.querySelector('[data-source-code],pre'),box=pre.getBoundingClientRect(),point=document.elementFromPoint(Math.min(box.right-8,box.left+64),box.top+8),line=point?.closest('.source-line,.line');
 const anchor=line&&pre.contains(line)?line:null,offset=anchor?anchor.getBoundingClientRect().top-box.top:0;
 const enabled=root.dataset.wrap!=='true';root.dataset.wrap=String(enabled);button.setAttribute('aria-pressed',String(enabled));button.dataset.tip=enabled?'取消换行':'自动换行';button.replaceChildren(codeIcon(enabled?'wrap':'nowrap'));
 if(enabled)pre.scrollLeft=0;
 if(anchor)pre.scrollTop+=anchor.getBoundingClientRect().top-pre.getBoundingClientRect().top-offset;
}
