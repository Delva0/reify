const mediaSelector='img,picture,video,audio,canvas,iframe,object,embed';

// Keep the real Selection intact. Text paint skips media; media use an outline.
export function selectionPaint(range){
 const root=range.commonAncestorContainer?.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer?.parentElement;
 const excluded=[],media=[];
 const elements=[...(root?.matches?.(mediaSelector)?[root]:[]),...(root?.querySelectorAll?.(mediaSelector)||[])];
 for(const element of elements){
  if(!range.intersectsNode(element))continue;
  if(!excluded.some(parent=>parent.contains(element)))excluded.push(element);
  // picture is an inline container. Outline its rendered img rather than the
  // container's text-line box, while excluding the entire picture from paint.
  if(!element.matches('picture')&&!media.some(parent=>parent.contains(element)))media.push(element);
 }
 if(!excluded.length)return {ranges:[range],media};
 if(excluded.includes(root))return {ranges:[],media};
 const painted=[],tail=range.cloneRange();
 for(const element of excluded){
  if(tail.collapsed)break;
  const before=tail.cloneRange();before.setEndBefore(element);if(!before.collapsed)painted.push(before);
  tail.setStartAfter(element);
 }
 if(!tail.collapsed)painted.push(tail);
 return {ranges:painted,media};
}
export const selectionPaintRanges=range=>selectionPaint(range).ranges;
