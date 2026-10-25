const pageTrees=new WeakMap();
export function disposeTreeWidth(tree){pageTrees.get(tree)?.();pageTrees.delete(tree);}
export function bindTreeWidth(tree,handle,{styleTarget=tree,maximum=()=>480,key,right=false,observe}={}){
 if(!tree||!handle)return ()=>{};
 let preferred=220,pointerId;const bindings=[];
 if(key)try{const saved=Number(localStorage.getItem(key));if(Number.isFinite(saved)&&saved>=128)preferred=saved;}catch{}
 const apply=()=>{const max=Math.max(128,Math.floor(maximum())),width=Math.round(Math.max(128,Math.min(max,preferred)));styleTarget.style.setProperty('--tree-width',width+'px');handle.setAttribute('aria-valuenow',String(width));handle.setAttribute('aria-valuemax',String(max));};
 const persist=()=>{if(key)try{localStorage.setItem(key,String(preferred));}catch{}};
 const on=(type,handler)=>{handle.addEventListener(type,handler);bindings.push([type,handler]);};
 on('pointerdown',event=>{event.preventDefault();pointerId=event.pointerId;handle.setPointerCapture(pointerId);tree.classList.add('is-resizing');});
 on('pointermove',event=>{if(!handle.hasPointerCapture(event.pointerId))return;const bounds=tree.getBoundingClientRect();preferred=Math.max(128,Math.min(maximum(),right?bounds.right-event.clientX:event.clientX-bounds.left));apply();});
 const release=event=>{if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);pointerId=undefined;tree.classList.remove('is-resizing');persist();};
 on('pointerup',release);on('pointercancel',release);
 on('dblclick',()=>{preferred=220;apply();persist();});
 on('keydown',event=>{if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;event.preventDefault();preferred=Number(handle.getAttribute('aria-valuenow'))+((event.key==='ArrowLeft')!==right?-10:10);apply();persist();});
 const observer=observe&&typeof ResizeObserver==='function'?new ResizeObserver(apply):null;observer?.observe(observe);
 addEventListener('resize',apply);apply();
 const dispose=()=>{for(const [type,handler]of bindings)handle.removeEventListener(type,handler);removeEventListener('resize',apply);observer?.disconnect();if(pointerId!==undefined&&handle.hasPointerCapture(pointerId))handle.releasePointerCapture(pointerId);tree.classList.remove('is-resizing');};dispose.refresh=apply;return dispose;
}
export function initTreeWidth(){
 for(const [selector,key,right]of [['.repo-tree','tree-width',false],['.github-files','github-files-width',true]]){
  const tree=document.querySelector(selector),handle=tree?.querySelector('.tree-resize-handle');if(!tree||!handle)continue;
  if(pageTrees.has(tree)){pageTrees.get(tree).refresh();continue;}
  const maximum=()=>{const article=document.querySelector('.document').getBoundingClientRect(),bounds=tree.getBoundingClientRect(),inset=Number.parseFloat(getComputedStyle(tree)[right?'right':'left'])||0,edge=bounds.width?(right?bounds.right:bounds.left):(right?document.documentElement.clientWidth-inset:inset);return Math.max(128,Math.min(480,matchMedia('(min-width:1200px)').matches?(right?edge-article.right:article.left-edge)-48:innerWidth-32));};
  pageTrees.set(tree,bindTreeWidth(tree,handle,{maximum,key,right}));
 }
}
