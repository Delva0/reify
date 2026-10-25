const mediaSelector='img,picture,video,audio,canvas,iframe,object,embed';

// Keep the real Selection intact. Only its painted ranges skip replaced media.
export function selectionPaintRanges(range){
 const root=range.commonAncestorContainer?.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer?.parentElement;
 if(root?.matches?.(mediaSelector))return [];
 const media=[];
 for(const element of root?.querySelectorAll?.(mediaSelector)||[]){
  if(!range.intersectsNode(element)||media.some(parent=>parent.contains(element)))continue;
  media.push(element);
 }
 if(!media.length)return [range];
 const painted=[],tail=range.cloneRange();
 for(const element of media){
  if(tail.collapsed)break;
  const before=tail.cloneRange();before.setEndBefore(element);if(!before.collapsed)painted.push(before);
  tail.setStartAfter(element);
 }
 if(!tail.collapsed)painted.push(tail);
 return painted;
}
