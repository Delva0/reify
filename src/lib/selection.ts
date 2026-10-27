import {selectionPaint,resetSelectionPaint} from './selection-paint.js';
let retained: Range|undefined,paint: Range|undefined,selectedMedia=new Set<Element>();
const supported=()=>Boolean(globalThis.CSS?.highlights&&typeof Highlight==='function');
export const sameRange=(a: Range|null|undefined,b: Range|null|undefined)=>Boolean(a&&b&&a.startContainer===b.startContainer&&a.startOffset===b.startOffset&&a.endContainer===b.endContainer&&a.endOffset===b.endOffset);
function draw(range?: Range){
 if(!supported())return;
 if(!range)resetSelectionPaint();
 const {ranges,media}=range?selectionPaint(range):{ranges:[],media:[]},next=new Set(media);
 for(const element of selectedMedia)if(!next.has(element))element.classList.remove('selection-media');
 for(const element of next)if(!selectedMedia.has(element))element.classList.add('selection-media');
 selectedMedia=next;
 const custom=Boolean(range&&retained);
 if(custom)CSS.highlights.set('reader-selection',new Highlight(...ranges));else CSS.highlights.delete('reader-selection');
 document.documentElement.classList.toggle('selection-painted',custom);
}
export function retainSelection(range: Range){
 if(!supported())return;
 const next=sameRange(paint,range)&&paint?paint:range.cloneRange();if(retained===next)return;
 retained=paint=next;draw(paint);
}
export function releaseSelection(){retained=undefined;paint=undefined;draw();}
export function initSelection(){
 if(!supported())return;
 document.addEventListener('selectionchange',()=>{
  if(retained)return;
  const selection=getSelection(),range=selection?.rangeCount&&!selection.isCollapsed?selection.getRangeAt(0):null;
  const node=range?.commonAncestorContainer,element=node?.nodeType===1?node as Element:node?.parentElement;
  if(!range||element?.closest('[data-reader-annotation-ui],input,textarea,[contenteditable=true]')){releaseSelection();return;}
  if(sameRange(paint,range))return;
  paint=range.cloneRange();draw(paint);
 });
}
