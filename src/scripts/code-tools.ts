import {isHtmlElementTarget} from './event-target.js';
import {$,$$,closest} from '../lib/dom.js';
import {blockHref} from '../lib/code-links.js';
import {languageLabel} from '../lib/code-language.js';
import {codeIcon,copyCode,toggleCodeWrap} from './code-controls.js';

let initialized=false;
function tool(attribute: string,label: string,icon: string,href?: string){const control=document.createElement(href?'a':'button');if(control instanceof HTMLAnchorElement)control.href=href||'';else control.type='button';control.className='icon-button';control.setAttribute(attribute,'');control.setAttribute('aria-label',label);control.dataset.tip=attribute==='data-code-copy'?'复制':attribute==='data-code-wrap'?'自动换行':'展开';if(attribute==='data-code-wrap')control.setAttribute('aria-pressed','false');control.append(codeIcon(icon));return control;}
export function enhanceCodeBlocks(root: ParentNode=document){
 for(const block of $$('.code-block',root)){
  const pre=$('pre',block),code=$('pre code',block);if(!pre||!code||pre.hasAttribute('data-source-code'))continue;
  block.dataset.overflow||='full';
  const language=block.dataset.language||pre.dataset.language||code.className.match(/language-([\w+-]+)/)?.[1]||'text';
  block.dataset.language=language;
  let header: HTMLElement | null | undefined=block.querySelector<HTMLElement>(':scope > .code-header');
  if(!header){const clone=$<HTMLTemplateElement>('#code-tools-template')?.content.firstElementChild?.cloneNode(true);header=clone&&isHtmlElementTarget(clone)?clone:null;if(header){block.prepend(header);const label=$('.code-language',header);if(label)label.textContent=languageLabel(language);const expand=$('[data-code-toggle]',header);if(expand)expand.remove();}}
  if(!$('.code-language',block)){const label=document.createElement('span');label.className='code-language';label.textContent=languageLabel(language);block.append(label);}
  let tools=$('.code-tools',block);if(!tools){tools=document.createElement('div');tools.className='code-tools';block.append(tools);}
  if(!$('[data-code-wrap]',tools))tools.prepend(tool('data-code-wrap','自动换行','nowrap'));
  if(!$('[data-code-copy]',tools))tools.append(tool('data-code-copy','复制代码','copy'));
  if(block.id&&!$('[data-code-toggle]',tools))tools.append(tool('data-code-toggle','展开代码浮窗','expand',blockHref(block.dataset.codeReference||block.id)));
  for(const button of $$<HTMLButtonElement>('button',tools))button.type='button';
 }
}
export function initCodeTools(){
 if(initialized)return;initialized=true;
 document.addEventListener('click',event=>{
  const button=closest(event,'[data-code-copy],[data-code-wrap]'),root=button?.closest<HTMLElement>('.code-block,[data-code-viewer]');if(!root||!button||button instanceof HTMLButtonElement&&button.disabled)return;
  if(button.hasAttribute('data-code-copy'))copyCode(button,root);else toggleCodeWrap(button,root);
 });
}
