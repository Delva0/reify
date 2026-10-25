import assert from 'node:assert/strict';
import {transientSession,nodeReference,resolveNode,rangeReference,resolveRange,panelGeometry,restorePanelGeometry} from '../src/lib/transient-session.js';

const saved=new Map(),storage=new Map();
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
class Node{
 constructor(text='',type=1){this.nodeType=type;this.text=text;this.childNodes=[];this.dataset={};}
 append(...children){for(const child of children){child.parentNode=this;child.parentElement=this;this.childNodes.push(child);}}
 closest(){for(let node=this;node;node=node.parentNode)if(node.floating)return node;return null;}
}
const body=new Node(),panel=new Node(),paragraph=new Node(),text=new Node('selected original text',3);panel.floating=true;panel.dataset.fpSessionId='stable-parent';panel.id='code-viewer-1';panel.append(paragraph);paragraph.append(text);body.append(panel);
const createRange=()=>({setStart(node,offset){this.startContainer=node;this.startOffset=offset;},setEnd(node,offset){this.endContainer=node;this.endOffset=offset;},toString(){return this.startContainer===this.endContainer?this.startContainer.text.slice(this.startOffset,this.endOffset):'';}});
try{
 install('location',new URL('https://example.test/article.html'));
 install('localStorage',{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)});
 install('document',{body,querySelectorAll:()=>[panel],getElementById:id=>id===panel.id?panel:null,createRange});body.dataset={repositoryName:'owner/repo',commit:'fixed'};
 const session=transientSession('reader');session.write({enabled:true,entry:{draft:'still writing',geometry:{left:'80px',top:'100px'}}});
 assert.equal(session.read().entry.draft,'still writing');
 globalThis.location=new URL('https://example.test/another.html');assert.equal(transientSession('reader').read(),null,'drafts are isolated by article path');
 globalThis.location=new URL('https://example.test/article.html');body.dataset.commit='other';assert.equal(transientSession('reader').read(),null,'drafts are isolated by repository version');body.dataset.commit='fixed';
 const ref=nodeReference(text);assert.deepEqual(ref,{panel:'stable-parent',path:[0,0]});panel.id='code-viewer-78';assert.equal(resolveNode(ref),text,'restoration uses stable session identity rather than ephemeral dialog IDs');
 const range=createRange();range.setStart(text,0);range.setEnd(text,8);const span=rangeReference(range);assert.equal(resolveRange(span).toString(),'selected');
 text.text='changed text';assert.equal(resolveRange(span),null,'changed content is not given a misleading selection highlight');text.text='selected original text';
 panel.style={left:'80px',top:'100px',width:'400px',height:'120px'};panel.scrollTop=32;panel.scrollLeft=4;const geometry=panelGeometry(panel);panel.style={};panel.scrollTop=0;panel.scrollLeft=0;restorePanelGeometry(panel,geometry);assert.deepEqual(panel.style,{left:'80px',top:'100px',width:'400px',height:'120px'});assert.equal(panel.scrollTop,32);assert.equal(panel.scrollLeft,4);
 session.write(null);assert.equal(session.read(),null,'closing removes the saved transient panel');
 console.log('Transient sessions preserve page-scoped drafts, stable FP-relative locations, verified ranges and exact panel geometry.');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
