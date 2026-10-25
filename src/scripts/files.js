import {$,$$} from '../lib/dom.js';
const initialized=new WeakSet();
export function initFiles(root=document){
 for(const target of $$('.file-component',root)){
  if(initialized.has(target))continue;initialized.add(target);
  const buttons=$$('[data-file-index]',target),panels=$$('[data-file-panel]',target);
  const select=index=>{
   for(const panel of panels){panel.hidden=panel.dataset.filePanel!==String(index);if(!panel.hidden){const pre=$('pre',panel);if(pre){pre.scrollTop=0;pre.scrollLeft=0;}}}
   for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.fileIndex===String(index)));
  };
  for(const button of buttons){button.type='button';button.addEventListener('click',()=>select(button.dataset.fileIndex));}
  const selected=buttons.find(button=>button.getAttribute('aria-pressed')==='true')||buttons[0];if(selected)select(selected.dataset.fileIndex);
  const divider=$('.file-divider',target);if(!divider)continue;
  const resize=x=>{const maximum=Math.max(120,Math.floor(target.clientWidth*.6)),width=Math.round(Math.max(120,Math.min(maximum,x)));target.style.setProperty('--file-width',width+'px');divider.setAttribute('aria-valuenow',String(width));divider.setAttribute('aria-valuemax',String(maximum));};
  divider.addEventListener('pointerdown',event=>{event.preventDefault();divider.setPointerCapture(event.pointerId);target.classList.add('is-resizing');});
  divider.addEventListener('pointermove',event=>{if(divider.hasPointerCapture(event.pointerId))resize(event.clientX-target.getBoundingClientRect().left);});
  const release=event=>{if(divider.hasPointerCapture(event.pointerId))divider.releasePointerCapture(event.pointerId);target.classList.remove('is-resizing');};
  divider.addEventListener('pointerup',release);divider.addEventListener('pointercancel',release);
  divider.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();const current=Number(divider.getAttribute('aria-valuenow'))||220;resize(current+(event.key==='ArrowLeft'?-10:10));}});
 }
}
