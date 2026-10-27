export function panelPosition(x: number,y: number){return {left:x,top:y};}
export const panelResizeCorner=(x: number,y: number,box: Pick<DOMRect,'right'|'bottom'>,size=16)=>x>=box.right-size&&x<=box.right&&y>=box.bottom-size&&y<=box.bottom;
