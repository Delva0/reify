import {decorateCodeLine} from '../lib/code-note-ranges.js';
import {hasCodeAnnotations} from '../lib/code-annotations.js';
import {markLink} from '../lib/links.js';
function resolve(code,annotations){return new Promise((accept,reject)=>{
 const worker=new Worker(new URL('../workers/code-annotations.js',import.meta.url),{type:'module'});
 const finish=(value,error)=>{clearTimeout(timeout);worker.terminate();error?reject(Error(error)):accept(value);};
 const timeout=setTimeout(()=>finish(null,'代码标注正则匹配超时'),2000);
 worker.onmessage=({data})=>finish(data.ranges,data.error);worker.onerror=()=>finish(null,'代码标注匹配失败');worker.postMessage({code,annotations});
});}
export async function decorateCode(pre,annotations={}){
 if(!hasCodeAnnotations(annotations))return pre;
 const lines=[...pre.querySelectorAll(':scope > code > .line')],code=lines.map(line=>line.textContent).join('\n'),ranges=await resolve(code,annotations),doc=pre.ownerDocument;
 ranges.forEach((range,index)=>{range.group='code-annotation-'+index;});
 const tree={isText:node=>node.nodeType===3,text:node=>node.nodeValue,children:node=>[...node.childNodes],copy:node=>node.cloneNode(true),withText:(_node,value)=>doc.createTextNode(value),withChildren:(node,children)=>{const copy=node.cloneNode(false);copy.append(...children);return copy;},wrap:(properties,children)=>{const node=doc.createElement(properties.href?'a':'span');for(const [key,value]of Object.entries(properties))if(key==='className')node.className=value.join(' ');else if(key==='tabIndex')node.tabIndex=value;else node.setAttribute(key,value);node.append(...children);if(properties.href)markLink(node);return node;}};
 let offset=0;for(const line of lines){const result=decorateCodeLine([...line.childNodes],offset,ranges,tree);offset+=result.length+1;if(result.children)line.replaceChildren(...result.children);}return pre;
}
