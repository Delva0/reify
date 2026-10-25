import {$,$$,closest,svg} from '../lib/dom.js';
import {floatingLayer,registerFloatingPanel} from './floating-panels.js';
import {initSidebar} from './sidebars.js';
import {canonicalArticlePath} from '../lib/article-pages.js';
const dropdowns=new WeakSet();
const selects=new WeakSet();
let initialized=false;

function initDropdown(picker){
 if(dropdowns.has(picker))return;dropdowns.add(picker);
 const trigger=$('.version-trigger',picker),menu=$('.version-menu',picker);if(!trigger||!menu)return;
 menu.setAttribute('data-floating-panel','');
 const layer=floatingLayer(picker.closest('[data-floating-layer]'));
 picker.dataset.floatingLayer=menu.dataset.floatingLayer=layer===Infinity?'title':String(layer+1);
 const close=event=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(event?.type==='close'||event?.key==='Escape')trigger.focus({preventScroll:true});};
 registerFloatingPanel(menu,close);
 trigger.addEventListener('click',event=>{event.preventDefault();menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));});
 picker.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();menu.hidden=false;trigger.setAttribute('aria-expanded','true');$('a,button:not(:disabled)',menu)?.focus();}});
 picker.addEventListener('click',event=>{if(closest(event,'.version-menu a'))close();});
 return {trigger,menu,close};
}
export function enhanceSelects(){
 for(const select of $$('select:not(.version-select)')){
  if(selects.has(select))continue;selects.add(select);
  let picker=select.nextElementSibling?.classList.contains('field-picker')?select.nextElementSibling:null;
  if(!picker){picker=document.createElement('span');picker.className='version-picker field-picker';const trigger=document.createElement('button'),menu=document.createElement('span');trigger.type='button';trigger.className='version-trigger';trigger.setAttribute('aria-expanded','false');menu.className='version-menu';menu.hidden=true;picker.append(trigger,menu);select.after(picker);}
  select.hidden=true;
  const trigger=$('.version-trigger',picker),menu=$('.version-menu',picker),options=[...select.options];
  const render=()=>{
   const text=document.createElement('span');text.textContent=options.find(option=>option.value===select.value)?.textContent||'';
   trigger.replaceChildren(text,svg([['path',{d:'m4 6 4 4 4-4'}]],'0 0 16 16'));
   const label=select.closest('label')?.firstChild?.textContent?.trim()||select.getAttribute('aria-label')||'';trigger.setAttribute('aria-label','选择 '+label);
   menu.replaceChildren(...options.map(option=>{const button=document.createElement('button');button.type='button';button.dataset.value=option.value;button.disabled=option.disabled;button.setAttribute('aria-pressed',String(option.value===select.value));button.textContent=option.textContent;return button;}));
  };
  render();initDropdown(picker);
  menu.addEventListener('click',event=>{const option=closest(event,'[data-value]');if(!option||option.disabled)return;event.preventDefault();select.value=option.dataset.value;render();select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));menu.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus();});
  select.addEventListener('change',render);
 }
}
function initTheme(){
 let theme='light';try{theme=localStorage.getItem('theme')==='dark'?'dark':'light';}catch{}document.documentElement.dataset.theme=theme;
 const button=$('.theme-toggle');if(!button)return;
 const icons=$$('[data-theme-icon]',button);
 const render=()=>{
  const dark=document.documentElement.dataset.theme==='dark';button.removeAttribute('aria-pressed');button.setAttribute('aria-label',dark?'切换白色模式':'切换黑色模式');
  if(icons.length){for(const icon of icons){const hidden=icon.dataset.themeIcon!==(dark?'dark':'light');icon.toggleAttribute('hidden',hidden);icon.style.display=hidden?'none':'';}}
  else button.replaceChildren(dark?svg([['circle',{cx:10,cy:10,r:3.4}],['path',{d:'M10 1v2m0 14v2M1 10h2m14 0h2M3.6 3.6 5 5m10 10 1.4 1.4m0-12.8L15 5M5 15l-1.4 1.4'}]]):svg([['path',{d:'M17.4 12.1A7.7 7.7 0 0 1 7.9 2.6a7.7 7.7 0 1 0 9.5 9.5Z'}]]));
 };
 button.addEventListener('click',()=>{const value=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=value;try{localStorage.setItem('theme',value);}catch{}render();});render();
}
function initTree(){
 const tree=$('.repo-tree');if(!tree)return;const sidebar=initSidebar('repository');
 tree.addEventListener('click',event=>{const button=closest(event,'button.tree-branch,button.tree-repository');if(button){const expanded=button.getAttribute('aria-expanded')==='true',children=button.closest('li')?.querySelector(':scope > .tree-children,:scope > ul');button.setAttribute('aria-expanded',String(!expanded));$('path',button)?.setAttribute('d',expanded?'M2 6h8M6 2v8':'M2 6h8');if(children)children.hidden=expanded;}if(closest(event,'a'))sidebar.closeOverlay();});
}
function initReadingHeader(){
 const header=$('header.repo-header');if(!header)return;
 const headings=$$('.document h1,.document h2,.document h3,.document h4,.document h5,.document h6');
 const links=$$('.repo-tree a[data-heading]');let queued=false;
 const update=()=>{queued=false;header.classList.toggle('scrolled',scrollY>40);let current=headings[0];for(const heading of headings){if(heading.getBoundingClientRect().top>header.offsetHeight+32)break;current=heading;}for(const link of links){const href=link.getAttribute('href')||'',here=href.startsWith('#')||canonicalArticlePath(new URL(href,location.href).pathname)===canonicalArticlePath(location.pathname);if(current&&link.dataset.heading===current.id&&here)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');}};
 addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(update);}},{passive:true});addEventListener('resize',update);update();
}
export function initNavigation(){if(initialized)return;initialized=true;initTheme();enhanceSelects();for(const picker of $$('.version-picker:not(.field-picker)'))initDropdown(picker);initTree();initReadingHeader();}

