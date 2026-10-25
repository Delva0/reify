import assert from 'node:assert/strict';
import {parse,serialize} from 'parse5';
import {readArticleDocument} from '../src/scripts/article-document.js';
import {articlePageCache} from '../src/lib/page-cache.js';

const saved=new Map(),install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
const attr=(node,name)=>node.attrs?.find(item=>item.name===name)?.value;
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
const hasClass=(node,name)=>attr(node,'class')?.split(' ').includes(name);
function parsedDocument(html){
 const root=parse(html),wrappers=new WeakMap();
 const descendants=node=>(node.childNodes||[]).flatMap(child=>[child,...descendants(child)]);
 const matches=(node,selector)=>{
  if(selector==='main.reading-viewport > .document')return hasClass(node,'document')&&node.parentNode?.tagName==='main'&&hasClass(node.parentNode,'reading-viewport');
  if(selector==='[data-file-document]')return attr(node,'data-file-document')!==undefined;
  if(selector==='.repo-tree a[data-heading]'){
   if(node.tagName!=='a'||attr(node,'data-heading')===undefined)return false;
   for(let parent=node.parentNode;parent;parent=parent.parentNode)if(hasClass(parent,'repo-tree'))return true;
  }
  return node.tagName===selector;
 };
 const wrap=node=>{
  if(!node)return null;if(wrappers.has(node))return wrappers.get(node);
  const wrapper={
   get parentElement(){return node.parentNode?.tagName?wrap(node.parentNode):null;},
   get textContent(){return text(node);},
   get innerHTML(){return serialize({...node,nodeName:'#document-fragment'});},
   get dataset(){return Object.fromEntries((node.attrs||[]).filter(item=>item.name.startsWith('data-')).map(item=>[item.name.slice(5).replace(/-([a-z])/g,(_match,char)=>char.toUpperCase()),item.value]));},
   getAttribute:name=>attr(node,name),
   closest(selector){for(let current=node;current;current=current.parentNode)if(matches(current,selector))return wrap(current);return null;},
   querySelector:selector=>wrap(descendants(node).find(child=>matches(child,selector))),
   querySelectorAll:selector=>descendants(node).filter(child=>matches(child,selector)).map(wrap),
   getElementById:id=>wrap(descendants(node).find(child=>attr(child,'id')===id))
  };
  wrappers.set(node,wrapper);return wrapper;
 };
 const document=wrap(root);
 Object.defineProperties(document,{body:{get:()=>document.querySelector('body')},title:{get:()=>document.querySelector('title')?.textContent}});
 return document;
}

const manifest={source:{href:'/data/article-sources/'+('a'.repeat(64))+'.mdx',language:'mdx',file:'content/article.mdx'},pages:[{id:'a',title:'First',href:'article.html'},{id:'b',title:'Second',href:'article-page-2.html'}],anchors:{a:'article.html',a3:'article.html',local:'article.html',b:'article-page-2.html',bcode:'article-page-2.html','core-modes':'article-page-2.html'}};
const tree='<aside class="repo-tree"><ul><li><a href="article.html#a" data-heading="a">First</a><ul><li><a href="article.html#a3" data-heading="a3">Exact H3</a></li></ul></li><li><a href="article-page-2.html#b" data-heading="b">Second</a></li><li><a href="unrelated.html#other" data-heading="other">Other article</a></li></ul></aside>';
const block={id:'local',src:'src/kernel.cu',language:'cuda',links:[]};
const first='<h1 id="a">First</h1><h3 id="a3">Exact H3</h3><span class="katex">formula</span><pre style="--shiki-dark:white"><code>code</code></pre><a href="article-page-2.html#b">Next</a><a href="?fp=code&amp;block=bcode">Code</a><img src="images/model.svg"><template id="local" data-code-definition=\''+JSON.stringify(block)+'\'></template>';
const second='<h1 id="b">Second</h1><section id="core-modes"><p>分离架构</p></section><div id="bcode" class="code-block">kept</div>';
const page=(title,html)=>'<!doctype html><html><head><title>'+title+'</title><script id="article-pages" type="application/json">'+JSON.stringify(manifest)+'</script></head><body data-repository="repo" data-repository-name="owner/project" data-commit="abc123" data-mdx-file="content/article.mdx">'+tree+'<main class="reading-viewport"><article class="document">'+html+'</article></main></body></html>';
const pages=new Map([['https://wiki.test/article.html',page('First',first)],['https://wiki.test/article-page-2.html',page('Second',second)]]),requests=[];
const read=articlePageCache.read;
try{
 install('location',{href:'https://wiki.test/current.html'});
 install('DOMParser',class{parseFromString(html){return parsedDocument(html);}});
 articlePageCache.read=async href=>{const url=new URL(href);url.hash='';requests.push(url.href);return pages.get(url.href);};
 const result=await readArticleDocument('https://wiki.test/article.html',{id:'panel',referencePrefix:'stable'});
 const data=JSON.parse(result.view.dataset.documentData);
 assert.equal(result.title,'First');assert.equal(result.anchor,null);
 assert.deepEqual(result.source,{...manifest.source,href:'https://wiki.test'+manifest.source.href},'the viewer receives the original MDX descriptor, not rendered article text');
 assert.deepEqual(result.context,{repository:'repo',repositoryName:'owner/project',commit:'abc123',mdxFile:'content/article.mdx',url:'https://wiki.test/article.html',title:'First'});
 assert.equal(data.currentPage,0);assert.equal(data.pages.length,2);assert.equal(data.pages[1].html,undefined);
 assert.deepEqual(requests,['https://wiki.test/article.html'],'opening one H1 never preloads the full article');
 assert(data.pages[0].html.includes('katex'));assert(data.pages[0].html.includes('--shiki-dark'));
 assert(data.pages[0].html.includes('href="#panel-b"'));assert(data.pages[0].html.includes('block=stable-bcode'));
 assert(data.pages[0].html.includes('data-code-reference="stable-local"'));
 assert(data.pages[0].html.includes('https://wiki.test/images/model.svg'));
 assert(data.pages[0].html.includes('https://raw.githubusercontent.com/owner/project/abc123/src/kernel.cu'));
 assert(data.tree.includes('data-heading="panel-a3"'));assert(!data.tree.includes('Other article'));
 assert.equal(data.anchors['panel-bcode'],'https://wiki.test/article-page-2.html');
 assert.equal(data.anchors['stable-bcode'],'https://wiki.test/article-page-2.html','canonical references index unloaded H1 pages without using DOM scope');
 const target=await readArticleDocument('https://wiki.test/article.html#core-modes',{id:'target'});
 const targetData=JSON.parse(target.view.dataset.documentData);
 assert.equal(target.anchor,'target-core-modes');assert.equal(targetData.currentPage,1);assert.equal(target.title,'Second');
 assert.equal(target.source.href,result.source.href,'every H1 page references the same complete original MDX file');
 assert(targetData.pages[1].html.includes('id="target-core-modes"'),'explicit Section anchors remain exact scoped targets, even when they are not headings');
 assert.equal(targetData.pages[0].html,undefined);assert(targetData.pages[1].html.includes('target-bcode'));
 assert.deepEqual(requests.slice(1),['https://wiki.test/article.html','https://wiki.test/article-page-2.html'],'a cross-H1 hash loads only its owning page');
 console.log('Article documents reuse compiled markup and the exact tree, keep H1 pages lazy, and separate page URLs from repository resources.');
}finally{
 articlePageCache.read=read;
 for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
}
