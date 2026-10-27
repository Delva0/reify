import assert from 'node:assert/strict';
import {renderDocument} from '../dist/workers/document-render.js';
import {prepareDocument} from '../dist/build/document-markup.js';
import {paginateArticle} from '../dist/build/article-pages.js';
import {parseFragment} from 'parse5';

const attr=(node,name)=>node.attrs?.find(item=>item.name===name)?.value;
function findAll(node,tag){
 return [...(node.tagName===tag?[node]:[]),...(node.childNodes||[]).flatMap(child=>findAll(child,tag))];
}
const find=(node,tag)=>findAll(node,tag)[0];
const payload=html=>JSON.parse(attr(find(parseFragment(html),'div'),'data-document-data'));

const source='---\ntitle: Metadata\n---\n# 数据\n\n公式 $y=f(x)$。\n\n[执行](#mdx-3)\n\n## 调用\n\n```python\nresult = f(value)\n```\n\n# 执行\n\n第二页';
const html=await renderDocument(source,{id:'test-doc',format:'md',title:'README.md'});
const data=payload(html);
assert.equal(data.pages.length,2);
assert.deepEqual(data.pages.map(page=>page.title),['数据','执行']);
assert.equal(attr(find(parseFragment(data.pages[0].html),'pre'),'data-language'),'python');
assert(data.pages[0].html.includes('katex'));
assert(data.pages[0].html.includes('--shiki-dark'));
assert(!data.pages[0].html.includes('第二页'));
assert(data.pages[1].html.includes('第二页'));
assert(data.pages[0].html.includes('href="#test-doc-mdx-3"'));
assert(html.includes('data-heading="test-doc-mdx-3"'));
assert(!data.pages[0].html.includes('title: Metadata'));

// Frontmatter keeps its original line count, including after Shiki replaces
// the fenced-code node. Rendered range navigation consumes these attributes.
const code=find(parseFragment(data.pages[0].html),'pre');
assert.equal(attr(code,'data-mdx-line'),'12');
assert.equal(attr(code,'data-mdx-end-line'),'14');
assert.equal(attr(code,'data-mdx-column'),'1');
assert.equal(attr(code,'data-mdx-end-column'),'4');
const repeated=payload(await renderDocument('# One\n\n```js\nx()\n```\n\n# Two\n\n```js\nx()\n```',{id:'repeated',format:'md'}));
assert.deepEqual(repeated.pages.map(page=>attr(find(parseFragment(page.html),'pre'),'data-mdx-line')),['3','9']);

const nested=paginateArticle('<h1>文章</h1>'+html+'<h2>下一节</h2>','article');
assert.equal(nested.pages.length,1,'document H1 never paginates its parent article');
assert.equal(nested.headings.length,2);
const simple=prepareDocument('<h2>章节</h2><p>无 H1 文档</p>',{id:'plain'});
assert.equal(simple.pages.length,1);
assert.equal(simple.pages[0].title,'文档');

const anchors=payload(await renderDocument('# API `value`\n\n[开始](#api-value) [下一页](#%E6%89%A7%E8%A1%8C) [重复](#执行-1) [外部](https://example.com/other.html#target)\n\n# 执行\n\n内容\n\n# 执行',{id:'aliases',format:'md'}));
assert(anchors.pages[0].html.includes('href="#aliases-mdx-1"'));
assert(anchors.pages[0].html.includes('href="#aliases-mdx-2"'));
assert(anchors.pages[0].html.includes('href="#aliases-mdx-3"'));
assert(anchors.pages[0].html.includes('href="https://example.com/other.html#target"'),'local H1 navigation must preserve other document URLs');
assert.equal(anchors.anchors['aliases-mdx-2'],anchors.pages[1].href);

const raw=await renderDocument('# README\n\n<details><summary>展开</summary><p>HTML 内容</p></details>\n\n![图](images/model.svg)\n\n<script>alert(1)</script>',{id:'html',format:'md',sourceUrl:'https://raw.githubusercontent.com/example/repo/commit/README.md'});
assert(raw.includes('<details>'));
assert(raw.includes('https://raw.githubusercontent.com/example/repo/commit/images/model.svg'));
assert(!raw.includes('<script>'));
const repaired=await renderDocument('# HTML\n\n<table><tr><td>value</td></tr></table>\n\n<a name="entry"></a>\n\n## Entry',{id:'repaired',format:'md'});
assert(repaired.includes('<tbody>'),'HTML parser inserts implied elements without source coordinates');

const mdx=await renderDocument('# MDX\n\n<TextNote desc="输入">value</TextNote>\n\n<CodeBlock id="fn" code={"f(value)"} language="python" notes={{"value":"输入"}} />\n\n[代码](?fp=code&block=fn)',{id:'mdx',format:'mdx'});
assert(mdx.includes('data-note-description="输入"'));
assert(mdx.includes('id="mdx-fn"'));
assert(mdx.includes('block=mdx-fn'));
const mdxCode=findAll(parseFragment(payload(mdx).pages[0].html),'div').find(node=>attr(node,'id')==='mdx-fn');
assert.equal(attr(mdxCode,'data-mdx-line'),'5');

const stableSource='# First\n\n[代码](?fp=code&block=hidden)\n\n<CodeBlock id="shown" code="x()" />\n\n# Second\n\n<CodeBlock id="hidden" code="y()" render={false} />';
const stableA=payload(await renderDocument(stableSource,{id:'session-a',referencePrefix:'source-doc',format:'mdx'}));
const stableB=payload(await renderDocument(stableSource,{id:'session-b',referencePrefix:'source-doc',format:'mdx'}));
for(const [data,scope]of [[stableA,'session-a'],[stableB,'session-b']]){
 const shown=findAll(parseFragment(data.pages[0].html),'div').find(node=>attr(node,'data-code-reference')==='source-doc-shown');
 const hidden=findAll(parseFragment(data.pages[1].html),'template').find(node=>attr(node,'data-code-reference')==='source-doc-hidden');
 assert.equal(attr(shown,'id'),scope+'-shown');assert.equal(attr(hidden,'id'),scope+'-hidden');
 assert.equal(JSON.parse(attr(hidden,'data-code-definition')).id,'source-doc-hidden');
 assert(data.pages[0].html.includes('block=source-doc-hidden'));
 assert.equal(data.anchors['source-doc-hidden'],data.pages[1].href,'canonical code references retain their H1 owner');
}
const rescoped=prepareDocument(stableA.pages.map(page=>page.html).join(''),{id:'session-c',referencePrefix:'source-doc'});
assert(rescoped.pages[0].html.includes('data-code-reference="source-doc-shown"'),'prepared document reuse does not accumulate a previous DOM scope in canonical references');
assert(rescoped.pages[0].html.includes('block=source-doc-hidden'));
assert.equal(rescoped.anchors['source-doc-hidden'],rescoped.pages[1].href);

for(const [unsafe,message]of [
 ['export const x = globalThis\n\n# Code',/模块代码/],
 ['# Code\n\n{globalThis.fetch("https://example.com")}',/动态表达式/],
 ['# Code\n\n<Unknown />',/组件未注册/],
 ['# Code\n\n<div onClick={"handler"} />',/动态属性/]
])await assert.rejects(renderDocument(unsafe,{id:'unsafe',format:'mdx'}),message);

console.log('Document rendering shares article math, highlighting, source positions, heading aliases and H1 pagination across its platform adapters.');
