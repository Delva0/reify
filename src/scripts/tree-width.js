export function initTreeWidth(){
 for(const [selector,key,right]of [['.repo-tree','tree-width',false],['.github-files','github-files-width',true]]){
 const tree=document.querySelector(selector),handle=tree?.querySelector('.tree-resize-handle');if(!tree||!handle)continue;
 let preferred=220;try{const saved=Number(localStorage.getItem(key));if(Number.isFinite(saved)&&saved>=128)preferred=saved;}catch{}
 const maximum=()=>{const article=document.querySelector('.document').getBoundingClientRect(),bounds=tree.getBoundingClientRect(),inset=Number.parseFloat(getComputedStyle(tree)[right?'right':'left'])||0,edge=bounds.width?(right?bounds.right:bounds.left):(right?document.documentElement.clientWidth-inset:inset);return Math.max(128,Math.min(480,matchMedia('(min-width:1200px)').matches?(right?edge-article.right:article.left-edge)-48:innerWidth-32));};
 const apply=()=>{const max=Math.floor(maximum()),width=Math.round(Math.max(128,Math.min(max,preferred)));tree.style.setProperty('--tree-width',width+'px');handle.setAttribute('aria-valuenow',String(width));handle.setAttribute('aria-valuemax',String(max));};
 const persist=()=>{try{localStorage.setItem(key,String(preferred));}catch{}};
 handle.addEventListener('pointerdown',event=>{event.preventDefault();handle.setPointerCapture(event.pointerId);tree.classList.add('is-resizing');});
 handle.addEventListener('pointermove',event=>{if(!handle.hasPointerCapture(event.pointerId))return;const bounds=tree.getBoundingClientRect();preferred=Math.max(128,Math.min(maximum(),right?bounds.right-event.clientX:event.clientX-bounds.left));apply();});
 const release=event=>{if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);tree.classList.remove('is-resizing');persist();};
 handle.addEventListener('pointerup',release);handle.addEventListener('pointercancel',release);
 handle.addEventListener('dblclick',()=>{preferred=220;apply();persist();});
 handle.addEventListener('keydown',event=>{if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;event.preventDefault();preferred=Number(handle.getAttribute('aria-valuenow'))+((event.key==='ArrowLeft')!==right?-10:10);apply();persist();});
 addEventListener('resize',apply);apply();
 }
}
