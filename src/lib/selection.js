import {selectionPaintRanges} from './selection-paint.js';

let retained,paint;
const supported=()=>Boolean(globalThis.CSS?.highlights&&typeof Highlight==='function');
export const sameRange=(a,b)=>a&&b&&a.startContainer===b.startContainer&&a.startOffset===b.startOffset&&a.endContainer===b.endContainer&&a.endOffset===b.endOffset;
function draw(range){
 if(!supported())return;
 if(range)CSS.highlights.set('reader-selection',new Highlight(...selectionPaintRanges(range)));else CSS.highlights.delete('reader-selection');
 document.documentElement.classList.toggle('selection-painted',Boolean(range));
}
export function retainSelection(range){
 if(!supported())return;
 retained=sameRange(paint,range)?paint:range.cloneRange();
 if(retained!==paint){paint=retained;draw(paint);}
}
export function releaseSelection(){retained=undefined;paint=undefined;draw();}
export function initSelection(){
 if(!supported())return;
 document.addEventListener('selectionchange',()=>{
  if(retained)return;
  const selection=getSelection(),range=selection?.rangeCount&&!selection.isCollapsed?selection.getRangeAt(0):null;
  const node=range?.commonAncestorContainer,element=node?.nodeType===1?node:node?.parentElement;
  if(!range||element?.closest('[data-reader-annotation-ui],input,textarea,[contenteditable=true]')){releaseSelection();return;}
  if(sameRange(paint,range))return;
  paint=range.cloneRange();draw(paint);
 });
}
