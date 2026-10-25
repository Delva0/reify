import {panelPosition,panelResizeCorner} from '../lib/panel-position.js';
export function bindPanelDrag(panel,handle,onDetach){
 let drag;
 const titleBottom=()=>document.querySelector('.repo-header')?.getBoundingClientRect().bottom||0;
 const place=(x,y)=>{const position=panelPosition(x,y);panel.style.left=position.left+'px';panel.style.top=position.top+'px';};
 const down=event=>{
  if(event.button!==0||event.target.closest('button,a,input,textarea,select'))return;
  const box=panel.getBoundingClientRect();if(panel.dataset.modal==='false'&&panelResizeCorner(event.clientX,event.clientY,box))return;
  event.preventDefault();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:box.left,top:box.top,width:box.width,height:box.height,minPointerY:titleBottom(),active:false};handle.setPointerCapture(event.pointerId);
 };
 const move=event=>{
  if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=Math.max(drag.minPointerY,event.clientY)-drag.y;
  if(!drag.active){if(Math.hypot(dx,dy)<4)return;drag.active=true;panel.style.width=drag.width+'px';panel.style.height=drag.height+'px';onDetach();handle.setPointerCapture(event.pointerId);}
  place(drag.left+dx,drag.top+dy);panel.dispatchEvent?.(new Event('panelmove',{bubbles:true}));
 };
 const end=event=>{if(!drag||event&&event.pointerId!==drag.id)return;if(handle.hasPointerCapture(drag.id))handle.releasePointerCapture(drag.id);drag=undefined;};
 const blur=()=>end(),resize=()=>{if(drag)drag.minPointerY=titleBottom();};addEventListener('blur',blur);addEventListener('resize',resize);
 handle.addEventListener('pointerdown',down);handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);handle.addEventListener('lostpointercapture',end);
 return ()=>{end();removeEventListener('blur',blur);removeEventListener('resize',resize);handle.removeEventListener('pointerdown',down);handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end);handle.removeEventListener('lostpointercapture',end);};
}
