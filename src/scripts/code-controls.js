import {svg,notice} from '../lib/dom.js';
import {iconPaths,iconShapes} from '../lib/icon-definitions.js';
import {readingPosition,restoreReadingPosition,sourceLineEntries} from '../lib/reading-position.js';
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
export function syncCodeWrap(button,root){
 if(!button)return;
 const rendered=root.dataset.documentMode==='rendered',enabled=rendered?root.dataset.documentWrap!=='false':root.dataset.wrap==='true';
 button.hidden=false;button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'取消换行':'自动换行');button.dataset.tip=enabled?'取消换行':'自动换行';button.replaceChildren(codeIcon(enabled?'wrap':'nowrap'));
 button.dispatchEvent(new Event('tipchange',{bubbles:true}));
}
export function toggleCodeWrap(button,root){
 const rendered=root.dataset.documentMode==='rendered',area=root.querySelector(rendered?'[data-document-content]':'[data-source-code],pre');if(!area)return;
 const view=rendered?area.closest('[data-file-document]'):null;
 const entries=rendered?[...area.querySelectorAll('[data-mdx-line]')].filter(node=>node.closest('[data-file-document]')===view).map(node=>({node,from:Number(node.dataset.mdxLine),to:Number(node.dataset.mdxEndLine||node.dataset.mdxLine)})):sourceLineEntries(area);
 const position=readingPosition(area,entries),enabled=rendered?root.dataset.documentWrap==='false':root.dataset.wrap!=='true';
 root.dataset[rendered?'documentWrap':'wrap']=String(enabled);syncCodeWrap(button,root);
 if(enabled)area.scrollLeft=0;
 restoreReadingPosition(area,entries,position);
 root.dispatchEvent(new CustomEvent('codewrapchange',{bubbles:true,detail:{rendered,enabled}}));
}
