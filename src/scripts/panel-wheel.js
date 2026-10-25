export function bindPanelWheel(panel,handle,beforeResize){
 let frame,delta=0;
 const apply=()=>{
  frame=undefined;const change=delta;delta=0;if(panel.hidden||panel.open===false)return;
  const box=panel.getBoundingClientRect();beforeResize(box);
  const style=getComputedStyle(panel),scale=Math.exp(-Math.max(-300,Math.min(300,change))*.001);
  const width=Math.max(parseFloat(style.minWidth)||0,Math.min(parseFloat(style.maxWidth)||Infinity,box.width*scale));
  const height=Math.max(parseFloat(style.minHeight)||0,Math.min(parseFloat(style.maxHeight)||Infinity,box.height*scale));
  panel.style.width=width.toFixed(2)+'px';panel.style.height=height.toFixed(2)+'px';
  panel.dispatchEvent(new Event('panelresize',{bubbles:true}));
 };
 const wheel=event=>{
  if(event.ctrlKey||event.metaKey||!Number.isFinite(event.deltaY)||!event.deltaY)return;
  event.preventDefault();event.stopPropagation();delta+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);
  if(frame===undefined)frame=requestAnimationFrame(apply);
 };
 handle.addEventListener('wheel',wheel,{passive:false});
 return ()=>{if(frame!==undefined)cancelAnimationFrame(frame);delta=0;handle.removeEventListener('wheel',wheel);};
}
