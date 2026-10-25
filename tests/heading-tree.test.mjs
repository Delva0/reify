import assert from 'node:assert/strict';
import test from 'node:test';
import {parseFragment} from 'parse5';
import {nestHeadings} from '../src/lib/heading-tree.js';
import {headingTreeHtml,headingTreeItemsHtml} from '../src/lib/heading-tree-html.js';

const elements=node=>(node.childNodes||[]).filter(child=>child.tagName);
const attr=(node,name)=>node.attrs.find(value=>value.name===name)?.value;
const text=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(text).join('');
const headings=nestHeadings([
 {depth:1,slug:'notes',text:'仓库笔记',href:'notes.html#notes'},
 {depth:2,slug:'detail',text:'完整标题 < "细节" & 定义',href:'notes.html#detail'},
 {depth:1,slug:'next',text:'另一篇文章',href:'notes-page-2.html#next'}
]);

test('standalone article H1 items are peers of repository rows, with only real heading nesting',()=>{
 const root=elements(parseFragment('<ul><li><button>server</button></li>'+headingTreeItemsHtml(headings,'notes.html')+'</ul>'))[0];
 const rows=elements(root);assert.deepEqual(rows.map(node=>node.tagName),['li','li','li']);
 const standalone=rows[1],children=elements(standalone);
 assert.deepEqual(children.map(node=>node.tagName),['div','ul'],'the H1 has one row and its actual H2 list, without a synthetic parent');
 assert.equal(attr(children[0],'class'),'tree-row');
 const [branch,link]=elements(children[0]);
 assert.equal(attr(branch,'class'),'tree-branch');assert.equal(attr(link,'class'),'tree-heading');
 assert.equal(attr(branch,'data-tree-key'),'heading:notes.html#notes','a heading branch keeps its real page href even when its visible link is shortened to a hash');
 assert.equal(text(link),'仓库笔记');assert.equal(attr(link,'href'),'#notes');assert.equal(attr(link,'data-heading'),'notes');
 assert(link.attrs.some(value=>value.name==='data-tip-overflow'),'standalone titles use the same overflow tip contract');
 const nestedLink=elements(elements(elements(children[1])[0])[0]).find(node=>node.tagName==='a');
 assert.equal(text(nestedLink),'完整标题 < "细节" & 定义','the original heading text survives escaping and nesting');
 assert.equal(attr(nestedLink,'href'),'#detail');
 const nextLink=elements(elements(rows[2])[0]).find(node=>node.tagName==='a');
 assert.equal(attr(nextLink,'href'),'notes-page-2.html#next','other H1 pages retain their page link');
});

test('wrapped document trees and repository article children use the exact same item renderer',()=>{
 const html=headingTreeHtml(headings,'notes.html'),root=elements(parseFragment(html))[0];
 assert.equal(root.tagName,'ul');assert.equal(attr(root,'class'),'tree-sections');
 assert.equal(html,'<ul class="tree-sections">'+headingTreeItemsHtml(headings,'notes.html')+'</ul>');
 assert.equal(elements(root).length,2,'each real H1 contributes one root item');
 const inactive=elements(parseFragment(headingTreeHtml(headings)))[0],inactiveBranch=elements(elements(elements(inactive)[0])[0])[0],activeBranch=elements(elements(elements(root)[0])[0])[0];
 assert.equal(attr(inactiveBranch,'data-tree-key'),attr(activeBranch,'data-tree-key'),'heading state identity is unchanged when another article becomes active');
});
