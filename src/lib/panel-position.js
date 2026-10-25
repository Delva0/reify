export function panelPosition(x,y){
 return {left:x,top:y};
}
export const panelResizeCorner=(x,y,box,size=16)=>x>=box.right-size&&x<=box.right&&y>=box.bottom-size&&y<=box.bottom;
