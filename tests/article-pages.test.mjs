import assert from 'node:assert/strict';
import {parseFragment} from 'parse5';
import {paginateArticle,prepareArticlePages} from '../src/build/article-pages.mjs';
import {headingPages,articleBasePath,redirectArticleAnchor,serializeArticlePages} from '../src/lib/article-pages.js';
import {exactHeadings} from '../src/markdown.mjs';
const html='<section id="whole" data-mdx-line="1"><h1 id="mdx-1">图与<code>Session</code></h1><span hidden data-note-definitions="{&quot;x&quot;:&quot;定义&quot;}"></span><p id="intro" data-mdx-line="2">第一页 <a href="#second">下一页</a></p><h2 id="mdx-2">类型与<a href="https://example.com">来源</a></h2><pre><code><span style="color:red">first()</span></code></pre><section id="second"><h1 id="mdx-3">执行机制</h1><p data-note="x" data-mdx-line="8">第二页</p><div class="katex"><math><mi>X</mi></math><span>X</span></div><div id="code-test" class="code-block"><pre>second()</pre></div><h6 id="mdx-4">状态约束</h6></section><h1 id="mdx-5">资源释放</h1><p>第三页</p></section>';
const result=paginateArticle(html,'backend-abc'),[first,second,third]=result.pages;
assert.equal(result.pages.length,3);assert.deepEqual(result.pages.map(page=>page.href),['backend-abc.html','backend-abc-page-2.html','backend-abc-page-3.html']);
assert(first.html.includes('第一页'));assert(!first.html.includes('第二页'));assert(!second.html.includes('第一页'));assert(!second.html.includes('第三页'));assert(third.html.includes('第三页'));
for(const page of result.pages){assert.equal((page.html.match(/<h1\b/g)||[]).length,1);assert.equal((page.html.match(/data-note-definitions/g)||[]).length,1);}
assert(second.html.includes('<math><mi>X</mi></math>'),'KaTeX structure remains intact');assert(first.html.includes('<span style="color:red">first()</span>'),'code tokens remain intact');assert(second.html.includes('data-mdx-line="8"'));
assert(first.html.includes('href="backend-abc-page-2.html#second"'));assert.equal(result.manifest.anchors['code-test'],second.href);assert.equal(result.manifest.anchors.whole,first.href);assert(!second.html.includes('id="whole"'));
const walk=(node,fn)=>{fn(node);for(const child of node.childNodes||[])walk(child,fn);};
for(const page of result.pages)walk(parseFragment(page.html),node=>{if(node.tagName==='a')walk({childNodes:node.childNodes},child=>assert.notEqual(child.tagName,'a','heading links never nest author links'));});
assert(first.html.includes('<code>Session</code></a></h1>'));assert(second.html.includes('class="heading-link" href="#mdx-4"'));
assert.deepEqual(headingPages(result.headings,'backend-abc').map(page=>page.headings.map(h=>h.depth)),[[1,2],[1,6],[1]]);
assert.equal(articleBasePath('/backend-abc-page-2.html'),'/backend-abc');
assert.equal(headingPages([{depth:2,slug:'before',text:'前言'},{depth:1,slug:'main',text:'正文'}],'preface').length,1,'only H1 starts a page');
assert.throws(()=>headingPages([{depth:2,slug:'only',text:'无 H1'}],'invalid'),/H1/);
assert.throws(()=>paginateArticle('<h1 id="a">A</h1><p id="duplicate"></p><h1 id="b">B</h1><p id="duplicate"></p>','x'),/重复/);
let renders=0;const render=async()=>{renders++;return html;};await prepareArticlePages('test-cache',render,'cached');await prepareArticlePages('test-cache',render,'cached');assert.equal(renders,1);await prepareArticlePages('test-cache',render,'cached',false);assert.equal(renders,2,'development never serves stale rendered MDX');
const previous=Object.getOwnPropertyDescriptor(globalThis,'location');let redirected;
try{
 Object.defineProperty(globalThis,'location',{configurable:true,value:{href:'https://wiki.test/backend-abc.html?fp=code&file=a.cpp#second',pathname:'/backend-abc.html',search:'?fp=code&file=a.cpp',hash:'#second',replace:value=>redirected=value}});
 assert(redirectArticleAnchor(result.manifest));assert.equal(redirected,'https://wiki.test/backend-abc-page-2.html?fp=code&file=a.cpp#second');globalThis.location.pathname='/backend-abc-page-2';assert.equal(redirectArticleAnchor(result.manifest),false,'extensionless hosting URLs do not redirect-loop');
}finally{if(previous)Object.defineProperty(globalThis,'location',previous);else delete globalThis.location;}
assert(!serializeArticlePages({title:'</script>'}).includes('</script>'));
const definition={id:'hidden-kernel',src:'src/a.cpp',ranges:[],notes:[{at:{line:1,text:'x'},desc:'定义'}],links:[],marks:[],render:false,language:'cpp',scroll:false,expandable:true};
const hidden='<template id="hidden-kernel" data-code-definition="'+JSON.stringify(definition).replaceAll('"','&quot;')+'"></template>';
const hiddenPages=paginateArticle(hidden+'<h1 id="one">起点</h1><h1 id="two">调用</h1><p><a href="?fp=code&block=hidden-kernel">代码</a></p>','blocks');
assert.deepEqual(hiddenPages.blocks['hidden-kernel'],definition);assert.equal(hiddenPages.manifest.anchors['hidden-kernel'],'blocks.html');
assert(hiddenPages.pages[0].html.includes('data-code-definition'));assert(!hiddenPages.pages[1].html.includes('data-code-definition'),'other H1 pages load definitions on demand rather than duplicating them');
const referenced=paginateArticle('<h1 id="one">One</h1><h1 id="two">Two</h1><div id="unique-code" class="code-block" data-code-reference="stable-code"><pre>x()</pre></div>','refs');
assert.equal(referenced.manifest.anchors['unique-code'],'refs-page-2.html');assert.equal(referenced.manifest.anchors['stable-code'],'refs-page-2.html');
assert.throws(()=>paginateArticle(hidden+hidden+'<h1>重复</h1>','duplicate'),/重复的 CodeBlock/);
const ast={children:[{type:'mdxJsxFlowElement',name:'h1',attributes:[{name:'id',value:'custom'}],children:[{type:'text',value:'显式标题'}]},{type:'element',tagName:'h3',children:[{type:'text',value:'子章节'}]}]},file={data:{}};
exactHeadings()(ast,file);assert.deepEqual(file.data.astro.frontmatter.exactHeadings.map(h=>[h.slug,h.depth]),[['custom',1],['mdx-2',3]],'explicit MDX ids and skipped heading levels are preserved');
console.log('H1 pages isolate content, preserve headings, notes, math, code and source coordinates; legacy anchors and build caching passed');
