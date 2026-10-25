import {$,$$,closest,svg} from '../lib/dom.js';
import {floatingLayer,registerFloatingPanel,unregisterFloatingPanel,raiseFloatingPanel} from './floating-panels.js';
import {initSidebar} from './sidebars.js';
import {canonicalArticlePath} from '../lib/article-pages.js';
import {toggleTreeBranch,registerTreeRoot,registerPersistentTreeBranches} from './tree-branches.js';
import {bindReadingOutline} from './reading-outline.js';
const dropdowns=new WeakMap(),selects=new WeakSet(),themes=new WeakSet(),trees=new WeakMap();
let initialized=false,readingOutline;

function initDropdown(picker){
 if(dropdowns.has(picker))return dropdowns.get(picker);
 const trigger=$('.version-trigger',picker),menu=$('.version-menu',picker);if(!trigger||!menu)return;
 menu.setAttribute('data-floating-panel','');
 const parent=picker.closest('[data-floating-panel]'),priority=floatingLayer(parent)===Infinity?'title':undefined;
 const close=event=>{menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(event?.type==='close'||event?.key==='Escape')trigger.focus({preventScroll:true});};
 registerFloatingPanel(menu,close,{parent,priority});
 const bindings=[],on=(target,type,handler)=>{target.addEventListener(type,handler);bindings.push([target,type,handler]);};
 on(trigger,'click',event=>{event.preventDefault();menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)raiseFloatingPanel(menu);});
 on(picker,'keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();menu.hidden=false;trigger.setAttribute('aria-expanded','true');$('a,button:not(:disabled)',menu)?.focus();}});
 on(picker,'click',event=>{if(closest(event,'.version-menu a'))close();});
 const controller={trigger,menu,close,dispose(){close();unregisterFloatingPanel(menu);for(const [target,type,handler]of bindings)target.removeEventListener(type,handler);dropdowns.delete(picker);}};
 dropdowns.set(picker,controller);return controller;
}
export function disposeNavigationNode(root){if(!root)return;for(const picker of [...(root.matches?.('.version-picker')?[root]:[]),...root.querySelectorAll('.version-picker')])dropdowns.get(picker)?.dispose();}
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
 const button=$('.theme-toggle');if(!button||themes.has(button))return;themes.add(button);
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
 registerTreeRoot($('[data-tree-root-toggle]',tree),$('#repository-tree-root',tree),{key:'tree-root:repository'});
 registerPersistentTreeBranches(tree);
 if(trees.has(tree)){trees.get(tree).sidebar=sidebar;return;}const binding={sidebar};trees.set(tree,binding);
 tree.addEventListener('click',event=>{const button=closest(event,'button.tree-branch,button.tree-repository');if(button&&!button.hasAttribute('data-tree-root-toggle'))toggleTreeBranch(button,event);if(closest(event,'a'))binding.sidebar.closeOverlay();});
}
function initReadingHeader(){
 readingOutline?.dispose();const header=$('header.repo-header');if(!header)return;
 const links=$$('.repo-tree a[data-heading]');for(const link of links)link.removeAttribute('aria-current');
 const here=links.filter(link=>{const href=link.getAttribute('href')||'';if(href.startsWith('#'))return true;const url=new URL(href,location.href);return url.origin===location.origin&&canonicalArticlePath(url.pathname)===canonicalArticlePath(location.pathname);});
 readingOutline=bindReadingOutline({article:$('main .document'),viewport:window,links:here,outline:$('.repo-tree .repo-tree-content'),offset:()=>header.offsetHeight+32,onScroll:top=>header.classList.toggle('scrolled',top>40)});
}
export function refreshNavigation(){initTheme();enhanceSelects();for(const picker of $$('.version-picker:not(.field-picker)'))initDropdown(picker);initTree();initReadingHeader();}
export function initNavigation(){if(initialized)return;initialized=true;refreshNavigation();document.addEventListener('click',event=>{const direction=closest(event,'[data-history]')?.dataset.history;if(direction==='back')history.back();else if(direction==='forward')history.forward();});}

