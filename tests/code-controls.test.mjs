import assert from 'node:assert/strict';
import {setCodeText,codeText,copyCode,codeIcon} from '../src/scripts/code-controls.js';
const descriptors=new Map(),install=(key,value)=>{descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
class Node{
 constructor(namespaceURI='http://www.w3.org/2000/svg'){this.namespaceURI=namespaceURI;this.childNodes=[];this.attributes={};this.dataset={};}
 setAttribute(key,value){this.attributes[key]=value;}
 append(node){this.childNodes.push(node);}
 replaceChildren(...nodes){this.childNodes=nodes;}
 cloneNode(){return new Node(this.namespaceURI);}
}
try{
 let copied,calls=0,timer;install('document',{createElementNS:namespace=>new Node(namespace)});
 install('navigator',{clipboard:{writeText:async text=>{copied=text;++calls;}}});
 install('setTimeout',fn=>{timer=fn;return 1;});install('clearTimeout',()=>{});
 const copy=new Node(),wrap=new Node();copy.append(codeIcon('copy'));
 const source='  const x = "中文😀";\n\n\treturn x;\n',root={textContent:'1 2 3 4 untrusted line numbers',querySelectorAll:()=>[copy,wrap]};
 setCodeText(root,source);assert.equal(copy.disabled,false);assert.equal(wrap.disabled,false);assert.equal(codeText(root),source);
 await copyCode(copy,root);assert.equal(copied,source,'copy preserves empty lines, indentation, Unicode and the trailing newline, without line numbers or soft wraps');assert.equal(copy.attributes['aria-label'],'已复制');
 timer();assert.equal(copy.attributes['aria-label'],'复制代码');assert.equal(copy.dataset.copied,undefined);
 setCodeText(root,null);assert(copy.disabled&&wrap.disabled,'loading and non-text content cannot use code controls');await copyCode(copy,root);assert.equal(calls,1);
 console.log('Shared code controls copy original text without presentation artifacts and disable unavailable operations');
}finally{for(const [key,descriptor]of descriptors)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
