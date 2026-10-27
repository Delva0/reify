const mediaSelector='img,picture,video,audio,canvas,iframe,object,embed';
let indexedRoot: Element|undefined,candidates: Element[]|undefined,observer: MutationObserver|undefined;
export function resetSelectionPaint(){observer?.disconnect();observer=undefined;indexedRoot=undefined;candidates=undefined;}
function mediaElements(root: Element|null){
 const query=()=>[...(root?.matches?.(mediaSelector)?[root]:[]),...(root?.querySelectorAll?.(mediaSelector)||[])];
 if(!root||typeof MutationObserver!=='function')return query();
 if(root!==indexedRoot){
  resetSelectionPaint();indexedRoot=root;observer=new MutationObserver(()=>{candidates=undefined;});observer.observe(root,{childList:true,subtree:true});
 }else if(observer?.takeRecords().length)candidates=undefined;
 return candidates??=query();
}
export function selectionPaint(range: Range){
 const container=range.commonAncestorContainer,root=container.nodeType===1?container as Element:container.parentElement;
 const excluded: Element[]=[],media: Element[]=[];
 for(const element of mediaElements(root)){
  if(!range.intersectsNode(element))continue;
  if(!excluded.some(parent=>parent.contains(element)))excluded.push(element);
  if(!element.matches('picture')&&!media.some(parent=>parent.contains(element)))media.push(element);
 }
 if(!excluded.length)return {ranges:[range],media};
 if(root&&excluded.includes(root))return {ranges:[],media};
 const painted: Range[]=[],tail=range.cloneRange();
 for(const element of excluded){
  if(tail.collapsed)break;
  const before=tail.cloneRange();before.setEndBefore(element);if(!before.collapsed)painted.push(before);
  tail.setStartAfter(element);
 }
 if(!tail.collapsed)painted.push(tail);
 return {ranges:painted,media};
}
export const selectionPaintRanges=(range: Range)=>selectionPaint(range).ranges;
