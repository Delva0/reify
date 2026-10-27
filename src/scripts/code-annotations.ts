import {decorateCodeLine} from '../lib/code-note-ranges.js';
import type {CodeTree,MutableAnnotationRange} from '../lib/code-note-ranges.js';
import {hasCodeAnnotations} from '../lib/code-annotations.js';
import type {AnnotationRange} from '../lib/code-annotations.js';
import type {AnnotationResponse} from '../lib/data-types.js';
import {markLink} from '../lib/links.js';
function resolve(code: string,annotations: unknown){return new Promise<AnnotationRange[]>((accept,reject)=>{
 const worker=new Worker(new URL('../workers/code-annotations.js',import.meta.url),{type:'module'});
 const finish=(value?: AnnotationRange[],error?: string)=>{clearTimeout(timeout);worker.terminate();error?reject(Error(error)):accept(value||[]);};
 const timeout=setTimeout(()=>finish(undefined,'代码标注正则匹配超时'),2000);
 worker.onmessage=({data}: MessageEvent<AnnotationResponse>)=>'error'in data?finish(undefined,data.error):finish(data.ranges);worker.onerror=()=>finish(undefined,'代码标注匹配失败');worker.postMessage({code,annotations});
});}
export async function decorateCode(pre: HTMLElement,annotations: unknown={}){
 if(!hasCodeAnnotations(annotations))return pre;
 const lines=[...pre.querySelectorAll(':scope > code > .line')],code=lines.map(line=>line.textContent).join('\n'),ranges: MutableAnnotationRange[]=(await resolve(code,annotations)).map((range,index)=>({...range,group:'code-annotation-'+index})),doc=pre.ownerDocument;
 const tree: CodeTree<Node>={
  isText:node=>node.nodeType===3,text:node=>node.nodeValue||'',children:node=>[...node.childNodes],copy:node=>node.cloneNode(true),withText:(_node,value)=>doc.createTextNode(value),
  withChildren:(node,children)=>{const copy=node.cloneNode(false);for(const child of children)copy.appendChild(child);return copy;},
  wrap:(properties,children)=>{const node=doc.createElement(properties.href?'a':'span');for(const [key,value]of Object.entries(properties))if(key==='className'&&Array.isArray(value))node.className=value.join(' ');else if(key==='tabIndex'&&typeof value==='number')node.tabIndex=value;else if(value!==undefined)node.setAttribute(key,String(value));node.append(...children);if(node instanceof HTMLAnchorElement)markLink(node);return node;}
 };
 let offset=0;for(const line of lines){const result=decorateCodeLine([...line.childNodes],offset,ranges,tree);offset+=result.length+1;if(result.children)line.replaceChildren(...result.children);}return pre;
}
