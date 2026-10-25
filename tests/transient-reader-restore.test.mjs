import assert from 'node:assert/strict';
import {initReaderAnnotation} from '../src/scripts/reader-annotation.js';
import {transientSession,nodeReference,rangeReference} from '../src/lib/transient-session.js';

const saved=new Map(),storage=new Map(),events=new Map();let focuses=0,visibleParents;
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
class Node{
 constructor(text='',type=1){this.nodeType=type;this.text=text;this.childNodes=[];this.dataset={};this.style={};this.hidden=false;this.value='';this.attributes=new Map();this.handlers=new Map();this.classList={toggle(){},remove(){}};}
 append(...children){for(const child of children){if(child.parentNode)child.parentNode.childNodes.splice(child.parentNode.childNodes.indexOf(child),1);child.parentNode=this;child.parentElement=this;this.childNodes.push(child);}}
 closest(selector){for(let node=this;node;node=node.parentNode)if(selector==='[data-floating-panel]'&&node.floating)return node;return null;}
 setAttribute(name,value){this.attributes.set(name,value);}hasAttribute(name){return this.attributes.has(name);}
 addEventListener(type,fn){this.handlers.set(type,fn);}focus(){focuses++;}
 get offsetHeight(){return 120;}get scrollHeight(){return 72;}
}
const body=new Node(),parent=new Node(),paragraph=new Node(),text=new Node('selected original text',3),button=new Node(),editor=new Node(),input=new Node(),kind=new Node(),status=new Node(),confirm=new Node(),cancel=new Node();
parent.floating=true;parent.dataset.fpSessionId='parent-session';parent.append(paragraph);paragraph.append(text);body.append(parent);editor.hidden=true;editor.floating=true;
editor.querySelector=selector=>({'textarea':input,'.reader-annotation-kind':kind,'[role=status]':status,'[data-reader-annotation-confirm]':confirm,'[data-reader-annotation-cancel]':cancel}[selector]||null);
const createRange=()=>({setStart(node,offset){this.startContainer=node;this.startOffset=offset;},setEnd(node,offset){this.endContainer=node;this.endOffset=offset;},toString(){return this.startContainer.text.slice(this.startOffset,this.endOffset);}});
const register=(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn);};
const fire=(type,event={})=>{for(const fn of events.get(type)||[])fn({type,...event});};
const context={title:'A',repository:'owner/repo',commit:'A',headings:['A'],file:'A.mdx',url:'https://example.test/article.html',zone:'正文',text:'selected',locator:'range',offset:'0:8'};
try{
 install('Element',Node);install('location',new URL('https://example.test/article.html'));install('innerWidth',1000);install('innerHeight',800);
 visibleParents=[parent];body.dataset={repositoryName:'owner/repo',commit:'A'};
 install('document',{body,documentElement:new Node(),querySelector:selector=>({'.reader-annotation-mode':button,'.reader-annotation-editor':editor}[selector]||null),querySelectorAll:selector=>selector==='[data-fp-session-id]'?visibleParents:[],createRange,addEventListener:register});
 install('addEventListener',()=>{});install('requestAnimationFrame',fn=>fn());install('localStorage',{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)});
 const range=createRange();range.setStart(text,0);range.setEnd(text,8);
 const session=transientSession('reader');session.write({enabled:true,entry:{type:'text',context,anchor:{left:300,right:380,top:100,bottom:120},origin:nodeReference(paragraph),range:rangeReference(range),draft:'keep this unfinished comment',geometry:{left:'73px',top:'211px',width:'400px',height:'120px'},modal:false}});
 initReaderAnnotation();await Promise.resolve();
 assert(!editor.hidden);assert.equal(input.value,'keep this unfinished comment');assert.equal(editor.style.left,'73px');assert.equal(editor.style.top,'211px');assert.equal(focuses,0,'refresh restoration never focuses the editor');
 assert.equal(editor.dataset.floatingParent,'parent-session');assert.equal(editor.dataset.floatingLayer,'editor','restored editor retains the reserved second-highest priority');
 input.value+=' edited';input.handlers.get('input')();assert.equal(session.read().entry.draft,input.value,'edits update the persisted draft');
 const draftA=input.value;editor.style.left='91px';editor.style.top='244px';fire('reify:before-navigate');
 fire('sourcechange',{target:{matches:()=>true,contains:()=>true}});
 assert(editor.hidden);assert.equal(session.read().entry.draft,draftA);assert.equal(session.read().entry.geometry.left,'91px');
 globalThis.location=new URL('https://example.test/B.html');body.dataset={repositoryName:'other/repo',commit:'B'};visibleParents=[];const sessionB=transientSession('reader');fire('reify:after-navigate');
 assert(editor.hidden,'B has no inherited A editor');assert.equal(input.value,'');assert.equal(sessionB.read(),null);assert.equal(session.read().entry.draft,draftA,'loading an empty B scope never erases A');assert.equal(button.attributes.get('aria-pressed'),'false');
 fire('reify:before-navigate');globalThis.location=new URL('https://example.test/article.html');body.dataset={repositoryName:'owner/repo',commit:'A'};fire('reify:after-navigate');
 assert(editor.hidden,'returning A waits for its source FP');assert.equal(session.read().entry.draft,draftA);
 visibleParents=[parent];fire('fpready',{detail:{panel:parent}});
 assert(!editor.hidden);assert.equal(input.value,draftA);assert.equal(editor.style.left,'91px');assert.equal(editor.style.top,'244px');assert.equal(focuses,0);assert.equal(button.attributes.get('aria-pressed'),'true');assert.equal(sessionB.read(),null);
 let completeCopy;install('navigator',{clipboard:{writeText:()=>new Promise(resolve=>{completeCopy=resolve;})}});
 const copying=confirm.handlers.get('click')();assert(input.disabled,'copying starts before the page transition');
 fire('reify:before-navigate');globalThis.location=new URL('https://example.test/B.html');body.dataset={repositoryName:'other/repo',commit:'B'};
 const parentB=new Node(),paragraphB=new Node(),textB=new Node('selected B text',3);parentB.floating=true;parentB.dataset.fpSessionId='parent-B';parentB.append(paragraphB);paragraphB.append(textB);body.append(parentB);visibleParents=[parentB];
 const rangeB=createRange();rangeB.setStart(textB,0);rangeB.setEnd(textB,8);sessionB.write({enabled:true,entry:{type:'text',context:{...context,title:'B'},anchor:{left:100,right:200,top:100,bottom:120},origin:nodeReference(paragraphB),range:rangeReference(rangeB),draft:'B independent draft',geometry:{left:'52px',top:'155px',width:'400px',height:'120px'},modal:false}});
 fire('reify:after-navigate');assert(!editor.hidden);assert.equal(input.value,'B independent draft');assert(!input.disabled);
 completeCopy();await copying;
 assert(!editor.hidden,'finishing the old A clipboard promise cannot close B editor');assert.equal(input.value,'B independent draft');assert.equal(editor.style.left,'52px');assert.equal(editor.style.top,'155px');assert.equal(status.textContent,'');assert.equal(session.read().entry.draft,draftA);assert.equal(focuses,0);
 cancel.handlers.get('click')();assert(editor.hidden);assert.equal(sessionB.read().entry,null,'closing removes only the current B draft');assert.equal(session.read().entry.draft,draftA);
 console.log('Reader drafts preserve scope, parent readiness, geometry and focus across A/B/A navigation; stale async copy cannot dismiss the new page editor.');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
