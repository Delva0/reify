export function positionTip(panel: HTMLElement,rects: Pick<DOMRect,'width'|'height'|'left'|'top'|'bottom'>[],width?: number){
 rects=rects.filter(box=>box.width&&box.height);if(!rects.length)return;
 panel.style.width=width===undefined?'max-content':Math.min(width,innerWidth-32)+'px';
 panel.style.left=Math.max(16,Math.min(...rects.map(box=>box.left),innerWidth-panel.offsetWidth-16))+'px';
 const height=panel.offsetHeight,top=Math.min(...rects.map(box=>box.top)),bottom=Math.max(...rects.map(box=>box.bottom));
 panel.style.top=Math.max(16,bottom+8+height<=innerHeight-16?bottom+8:top-height-8)+'px';
}
