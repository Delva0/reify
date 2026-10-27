import assert from 'node:assert/strict';
import test from 'node:test';
import {createPageCache} from '../dist/lib/page-cache.js';
import {patchChildren} from '../dist/lib/page-dom.js';

test('HTML page cache reuses hash targets, bounds memory, retries failures and rejects aborted content',async()=>{
 const calls=[];let failure=false,release;
 const cache=createPageCache({limit:2,fetcher:async url=>{calls.push(url);if(failure)throw Error('offline');return {ok:true,headers:new Map([['content-type','text/html']]),text:async()=>url.endsWith('/pending.html')?new Promise(resolve=>release=resolve):url};}});
 await cache.read('https://wiki.test/a.html#one');await cache.read('https://wiki.test/a.html#two');assert.equal(calls.length,1);
 await cache.read('https://wiki.test/b.html');await cache.read('https://wiki.test/a.html');await cache.read('https://wiki.test/c.html');await cache.read('https://wiki.test/b.html');assert.equal(calls.length,4,'least-recent pages are evicted');
 failure=true;await assert.rejects(cache.read('https://wiki.test/fail.html'),/offline/);failure=false;await cache.read('https://wiki.test/fail.html');
 const controller=new AbortController(),pending=cache.read('https://wiki.test/pending.html',{signal:controller.signal});await Promise.resolve();controller.abort();release('<main>stale</main>');await assert.rejects(pending,{name:'AbortError'});
 assert.equal(calls.filter(url=>url.endsWith('/pending.html')).length,1);
 const retry=cache.read('https://wiki.test/pending.html');await Promise.resolve();release('<main>fresh</main>');assert.equal(await retry,'<main>fresh</main>');assert.equal(calls.filter(url=>url.endsWith('/pending.html')).length,2,'aborted responses never enter the page cache');
});

test('article routing keeps hashes, external, downloads, new tabs and FP links on their native paths',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{value:{querySelector:()=>null},configurable:true});
 try{
  const {pageLinkTarget}=await import('../dist/scripts/page-navigation.js');
  const base='https://wiki.test/one.html',link=(href,{target='',download=false,floating=false,header=false,document=false}={})=>({target,getAttribute:()=>href,hasAttribute:()=>download,closest:selector=>selector==='[data-file-document]'?document:selector==='[data-floating-panel]'?floating:selector==='.repo-header'?header:null});
  for(const href of ['#section','one.html#section','https://other.test/two.html','file.pdf','?fp=code&file=a.cpp'])assert.equal(pageLinkTarget(link(href),base),null,href);
  assert.equal(pageLinkTarget(link('two.html',{target:'_blank'}),base),null);assert.equal(pageLinkTarget(link('two.html',{download:true}),base),null);
  assert.equal(pageLinkTarget(link('two.html',{floating:true}),base),null,'file/document FP links retain their own document navigation');
  assert.equal(pageLinkTarget(link('two.html',{floating:true,header:true}),base).pathname,'/two.html','header version menus use article routing');
  assert.equal(pageLinkTarget(link('two.html?fp=code&file=a.cpp'),base).pathname,'/two.html','a cross-article FP deep link first loads its article');
  assert.equal(pageLinkTarget(link('/two'),base).pathname,'/two','extensionless article URLs are supported');
 }finally{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;}
});

class Node{
 constructor(name,attributes={},children=[]){this.nodeType=name==='#text'?3:1;this.nodeName=name.toUpperCase();this.attrs=new Map(Object.entries(attributes));this.childNodes=[];this.nodeValue=name==='#text'?attributes.value:null;this.ownerDocument={importNode:node=>node.cloneNode(true)};this.classList={contains:value=>(this.attrs.get('class')||'').split(' ').includes(value)};for(const child of children)this.append(child);}
 get id(){return this.attrs.get('id')||'';}get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}get firstChild(){return this.childNodes[0]||null;}get nextSibling(){return this.parentNode?.childNodes[this.parentNode.childNodes.indexOf(this)+1]||null;}
 getAttribute(name){return this.attrs.get(name)??null;}hasAttribute(name){return this.attrs.has(name);}setAttribute(name,value){this.attrs.set(name,value);}removeAttribute(name){this.attrs.delete(name);}
 matches(selector){return selector.toUpperCase()===this.nodeName;}querySelector(){return null;}
 append(node){this.insertBefore(node,null);}insertBefore(node,before){node.remove();const index=before?this.childNodes.indexOf(before):this.childNodes.length;this.childNodes.splice(index,0,node);node.parentNode=this;}
 remove(){if(this.parentNode){this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this),1);this.parentNode=null;}}
 cloneNode(){return new Node(this.nodeName.toLowerCase(),Object.fromEntries(this.attrs),this.childNodes.map(child=>child.cloneNode(true)));}
 isEqualNode(other){return this.nodeName===other.nodeName&&this.nodeValue===other.nodeValue&&JSON.stringify([...this.attrs])===JSON.stringify([...other.attrs])&&this.childNodes.length===other.childNodes.length&&this.childNodes.every((child,index)=>child.isEqualNode(other.childNodes[index]));}
}

test('keyed shell updates retain controls and replace only changed article identity and menu nodes',()=>{
 const theme=new Node('button',{class:'theme-toggle','aria-label':'切换白色模式'}),identity=new Node('a',{'data-header-identity':'',href:'/repo-a'},[new Node('#text',{value:'repo-a'})]),menu=new Node('div',{class:'version-picker'}),old=new Node('header',{},[theme,identity,menu]);
 const next=new Node('header',{},[new Node('button',{class:'theme-toggle','aria-label':'切换黑色模式'}),new Node('a',{'data-header-identity':'',href:'/repo-b'},[new Node('#text',{value:'repo-b'})]),new Node('button',{class:'github-files-toggle'})]),removed=[];
 patchChildren(old,next,{preserve:node=>node===theme,onRemove:node=>removed.push(node)});
 assert.equal(old.childNodes[0],theme);assert.equal(theme.getAttribute('aria-label'),'切换白色模式','the active theme is not reset by fetched HTML');assert.equal(old.childNodes[1],identity);assert.equal(identity.getAttribute('href'),'/repo-b');assert.equal(identity.childNodes[0].nodeValue,'repo-b');assert(removed.includes(menu));assert(old.childNodes[2].classList.contains('github-files-toggle'));
});
