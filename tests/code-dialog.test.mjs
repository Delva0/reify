import assert from 'node:assert/strict';
import {createCodeDialog} from '../dist/scripts/code-dialog.js';
import {setDocumentMode} from '../dist/scripts/document-view.js';

const saved=new Map(),install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
const dataKey=name=>name.slice(5).replace(/-([a-z])/g,(_all,letter)=>letter.toUpperCase());
let reads=0,queries=0;
class Node{
 constructor(tag='div',attributes={}){this.tagName=tag.toUpperCase();this.childNodes=[];this.attributes={};this.dataset={};this.style={removeProperty(name){delete this[name];}};this.listeners=new Map();this.scrollTop=0;this.scrollLeft=0;for(const [name,value]of Object.entries(attributes))this.setAttribute(name,value);}
 setAttribute(name,value){if(name==='class')this.className=value;else if(name.startsWith('data-'))this.dataset[dataKey(name)]=String(value);else this.attributes[name]=String(value);}
 getAttribute(name){return name==='class'?this.className??null:name.startsWith('data-')?this.dataset[dataKey(name)]??null:this.attributes[name]??null;}
 hasAttribute(name){return this.getAttribute(name)!==null;}
 removeAttribute(name){if(name.startsWith('data-'))delete this.dataset[dataKey(name)];else delete this.attributes[name];}
 get children(){return this.childNodes;}
 get textContent(){return (this.text||'')+this.childNodes.map(node=>node.textContent).join('');}
 set textContent(value){this.text=value;this.replaceChildren();}
 append(...nodes){for(const node of nodes){if(node.tagName==='#FRAGMENT'){this.append(...node.childNodes);continue;}node.parentElement?.childNodes.splice(node.parentElement.childNodes.indexOf(node),1);this.childNodes.push(node);node.parentElement=this;}}
 replaceChildren(...nodes){for(const node of this.childNodes)node.parentElement=null;this.childNodes=[];this.append(...nodes);}
 remove(){this.parentElement?.childNodes.splice(this.parentElement.childNodes.indexOf(this),1);this.parentElement=null;}
 contains(node){return node===this||this.childNodes.some(child=>child.contains(node));}
 simple(selector,scope){if(selector===':scope')return this===scope;const tag=selector.match(/^[\w-]+/)?.[0];if(tag&&tag.toUpperCase()!==this.tagName)return false;for(const match of selector.matchAll(/\.([\w-]+)|\[([\w-]+)(?:=['"]?([^'"\]]+)['"]?)?\]/g)){if(match[1]&&!this.className?.split(' ').includes(match[1]))return false;if(match[2]&&(!this.hasAttribute(match[2])||match[3]!==undefined&&this.getAttribute(match[2])!==match[3]))return false;}return true;}
 matches(selector,scope=this){return selector.split(',').some(part=>{const tokens=part.trim().match(/[^\s>]+|>/g);const match=(node,index)=>{if(!node||!node.simple(tokens[index],scope))return false;if(index===0)return true;if(tokens[index-1]==='>')return match(node.parentElement,index-2);for(let parent=node.parentElement;parent;parent=parent.parentElement)if(match(parent,index-1))return true;return false;};return match(this,tokens.length-1);});}
 closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
 querySelectorAll(selector){queries++;const result=[];const visit=node=>{for(const child of node.childNodes){if(child.matches(selector,this))result.push(child);visit(child);}};visit(this);return result;}
 querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
 cloneNode(deep){const node=new Node(this.tagName,this.attributes);node.className=this.className;node.dataset={...this.dataset};node.text=this.text;if(deep)node.append(...this.childNodes.map(child=>child.cloneNode(true)));return node;}
 addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
 removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
 dispatchEvent(event){if(!event.target)Object.defineProperty(event,'target',{value:this});for(const fn of this.listeners.get(event.type)||[])fn(event);if(event.bubbles)this.parentElement?.dispatchEvent(event);return true;}
 getBoundingClientRect(){reads++;if(this.tagName==='DIALOG'){const left=parseFloat(this.style.left)||100,top=parseFloat(this.style.top)||100,width=parseFloat(this.style.width)||800,height=parseFloat(this.style.height)||500;return {left,top,width,height,right:left+width,bottom:top+height};}const area=this.closest('[data-source-code],[data-document-content]'),from=Number(this.dataset.line||this.dataset.mdxLine||1),to=Number(this.dataset.line||this.dataset.mdxEndLine||from),offset=(from-1)*20+24,height=this.dataset.line||this.dataset.mdxLine?(to-from+1)*20:500;const top=area&&area!==this?100+offset-area.scrollTop:100;return {left:100,top,width:800,height,right:900,bottom:top+height};}
 show(){this.open=true;}
 close(){this.open=false;this.dispatchEvent(new Event('close'));}
}
const element=(tag,attributes,children=[])=>{const node=new Node(tag,attributes);node.append(...children);return node;};
const frames=new Map(),resizeObservers=[],mutationObservers=[];let nextFrame=0;
const flush=()=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();};
try{
 install('Element',Node);install('CustomEvent',class extends Event{constructor(type,options={}){super(type,options);this.detail=options.detail;}});
 install('requestAnimationFrame',fn=>{frames.set(++nextFrame,fn);return nextFrame;});install('cancelAnimationFrame',id=>frames.delete(id));
 install('ResizeObserver',class{constructor(fn){this.fn=fn;resizeObservers.push(this);}observe(){}disconnect(){}});
 install('MutationObserver',class{constructor(fn){this.fn=fn;mutationObservers.push(this);}observe(){}disconnect(){}});
 install('addEventListener',()=>{});install('removeEventListener',()=>{});install('getComputedStyle',()=>({minHeight:'51px'}));
 const badge=element('span',{'data-symmetric-badge':''}),ranges=element('div',{'data-code-ranges':''},[badge,element('button',{'data-code-previous':''}),element('button',{'data-code-next':''})]);
 const head=element('div',{class:'dialog-head'},[element('span',{'data-source-title':''}),ranges,element('button',{'data-code-document':''}),element('button',{'data-code-wrap':''}),element('button',{'data-close-source':''})]);
 const template=element('dialog',{'data-code-viewer':'','data-floating-panel':'','data-modal':'true'},[head,element('pre',{'data-source-code':''}),element('div',{'data-source-preview':''}),element('div',{'data-source-document':''})]);
 const body=new Node('body'),root={body,createElement:tag=>new Node(tag),createElementNS:(_ns,tag)=>new Node(tag),createDocumentFragment:()=>new Node('#fragment'),querySelector:selector=>selector==='#code-viewer-template'?{content:{firstElementChild:template}}:null,querySelectorAll:()=>[],addEventListener(){}};
 install('document',root);
 const viewer=createCodeDialog({}),dialog=viewer.panel,code=dialog.querySelector('[data-source-code]'),documentHost=dialog.querySelector('[data-source-document]'),rangeBadge=dialog.querySelector('[data-symmetric-badge]'),next=dialog.querySelector('[data-code-next]'),previous=dialog.querySelector('[data-code-previous]'),header=dialog.querySelector('.dialog-head');
 const source=Array.from({length:100},(_value,index)=>'line '+(index+1)).join('\n'),selected=[{from:10,to:12},{from:30,to:31},{from:60,to:62}];
 viewer.update({title:'source',text:source,ranges:selected});assert.equal(frames.size,1);flush();assert.equal(code.scrollTop,180);assert.equal(rangeBadge.textContent,'1');
 const beforeReads=reads,beforeQueries=queries;code.scrollTop=620;for(let i=0;i<20;i++)dialog.dispatchEvent({type:'scroll',target:code});assert.equal(frames.size,1);assert.equal(reads,beforeReads,'scroll events do not measure layout');flush();assert.equal(reads,beforeReads,'scroll uses cached range offsets');assert.equal(queries,beforeQueries,'source navigation retains the built line targets');assert.equal(rangeBadge.textContent,'2');
 next.dispatchEvent(new Event('click'));flush();assert.equal(code.scrollTop,1180);assert.equal(rangeBadge.textContent,'3');
 for(let i=0;i<8;i++)previous.dispatchEvent(new Event('click'));assert.equal(frames.size,1);flush();assert.equal(rangeBadge.textContent,'1','rapid previous clicks wrap through the range list');
 const doc=element('div',{'data-file-document':''},[element('aside',{class:'document-outline'}),element('div',{'data-document-content':''},[[1,20],[21,50],[51,100]].map(([from,to])=>element('p',{'data-mdx-line':String(from),'data-mdx-end-line':String(to)})))]);
 viewer.update({title:'document',text:source,ranges:selected,documentView:doc});flush();assert.equal(dialog.dataset.documentMode,'rendered');
 const article=documentHost.querySelector('[data-document-content]'),outline=documentHost.querySelector('.document-outline');article.scrollTop=410;setDocumentMode(dialog,false);flush();assert.equal(code.scrollTop,410,'source mode follows the current rendered source position instead of jumping to a marked range');
 code.scrollTop=715;setDocumentMode(dialog,true);flush();assert.equal(article.scrollTop,715,'rendered mode follows manual source scrolling');setDocumentMode(dialog,false);flush();assert.equal(code.scrollTop,715,'switching back keeps the same reading position');
 setDocumentMode(dialog,true);flush();article.scrollTop=360;outline.scrollTop=85;outline.scrollLeft=11;
 const nativeDataset=dialog.dataset;dialog.dataset=new Proxy(nativeDataset,{set(target,key,value){target[key]=value;if(key==='modal'){for(const node of [code,article,outline])node.scrollTop=node.scrollLeft=0;}return true;}});
 const doubleClick=()=>header.dispatchEvent({type:'dblclick',clientX:200,clientY:110,target:header});doubleClick();assert.equal(dialog.dataset.modal,'false');assert.equal(article.scrollTop,360);assert.equal(outline.scrollTop,85);assert.equal(outline.scrollLeft,11,'detaching preserves document and outline scroll');doubleClick();assert.equal(dialog.dataset.modal,'true');assert.equal(article.scrollTop,360);assert.equal(code.scrollTop,715,'reattaching preserves both display modes');
 viewer.update({title:'plain',text:source});const plainQueries=queries;dialog.dataset.documentMode='rendered';for(let i=0;i<20;i++)dialog.dispatchEvent({type:'scroll',target:article});dialog.dispatchEvent(new Event('documentmodechange'));assert.equal(queries,plainQueries,'documents without ranges never query navigation targets');assert.equal(frames.size,0);
 const restored=createCodeDialog({parentPanel:dialog,restore:{modal:false,box:{left:-35,top:80,width:640,height:380},lastNonModalBox:{left:30,top:90,width:700,height:410},scroll:[{top:640,left:15},{top:0,left:0}]}});
 restored.update({title:'restored',text:source,ranges:selected});flush();assert.equal(restored.panel.dataset.modal,'false');assert.equal(restored.panel.style.left,'-35px');assert.equal(restored.panel.style.width,'640px');assert.equal(restored.panel.querySelector('[data-source-code]').scrollTop,640,'restored manual reading is not overwritten by initial range navigation');assert.equal(restored.panel.querySelector('[data-source-code]').scrollLeft,15);
 const savedState=restored.snapshot();assert.equal(savedState.box.left,-35);assert.equal(savedState.box.height,380);assert.equal(savedState.modal,false);restored.restore({modal:true});flush();assert.equal(restored.panel.dataset.modal,'true');assert.equal(restored.panel.querySelector('[data-source-code]').scrollTop,640,'partial mode restore preserves content and reading position');restored.close();
 let closedReading;const loading=createCodeDialog({restore:{scroll:[{top:640,left:15},{top:0,left:0}],wrap:true},onClose:state=>closedReading=state});
 loading.update({title:'loading',message:'读取代码…'});assert.equal(loading.snapshot().scroll[0].top,640);loading.panel.dispatchEvent(new Event('panelresize'));assert.equal(loading.snapshot().scroll[0].top,640,'moving a loading window keeps its pending reading restore');
 loading.update({title:'loaded',text:source,ranges:selected});flush();assert.equal(loading.panel.querySelector('[data-source-code]').scrollTop,640,'marked-line initialization cannot replace the cached reading position');loading.panel.querySelector('[data-source-code]').scrollTop=880;loading.panel.querySelector('[data-source-code]').scrollLeft=37;
 loading.update({title:'retry',message:'读取代码…'});assert.equal(loading.snapshot().scroll[0].top,880,'retry placeholders retain the last loaded reading position');loading.close();assert.equal(closedReading.scroll[0].top,880);assert.equal(closedReading.scroll[0].left,37);
 let closedDocument;const documentViewer=createCodeDialog({onClose:state=>closedDocument=state});documentViewer.update({title:'document',text:source,documentView:doc});documentViewer.panel.querySelector('[data-document-content]').scrollTop=522;documentViewer.close();assert.equal(closedDocument.documents[0].top,522,'close captures rendered document state before its controller is unmounted');
 viewer.update({title:'pending',text:source,ranges:selected});assert.equal(frames.size,1);viewer.close();assert.equal(frames.size,0,'closing cancels pending navigation');assert.equal(viewer.alive(viewer.current()),false);
 console.log('Code dialog batches range navigation, preserves mode and outline scroll, skips unmarked documents, and cancels work on close.');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
