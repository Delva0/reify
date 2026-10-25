import assert from 'node:assert/strict';
import {formatTextAnnotation,sourceLabel} from '../src/lib/reader-location.js';
import {wrapText} from '../src/scripts/reader-image.js';

const context={title:'架构与运行机制',repository:'hicann/example',commit:'a'.repeat(40),headings:['架构与运行机制','2. 数据模型'],file:'content/example/version.mdx',source:{line:19,column:1,endLine:20,endColumn:8},url:'https://example.test/example.html#mdx-3',zone:'正文',locator:'#mdx-3::text(0):2 → #mdx-3::text(0):7 (UTF-16)',offset:'article text[2:7]',text:'T = (name, τ, s)\n  保留缩进、𝜏、😀'};
const comment='如何确定所有权？\n请给出释放顺序。';
const text=formatTextAnnotation(context,comment);
assert(text.includes('版本：'+context.commit));
assert(text.includes('来源：content/example/version.mdx:L19:C1-L20:C8'));
assert(text.includes('位置：架构与运行机制 / 2. 数据模型'));
assert(text.endsWith('原文：\n'+context.text+'\n\n批注：\n'+comment));
assert.equal(sourceLabel({...context,originalSource:'src/model.cpp:L25-L30'}),'src/model.cpp:L25-L30');
for(const value of ['中文与 Latin 混排😀\n\n第二段','abcdef','', 'a\n']){
 const lines=wrapText(value,line=>Array.from(line).length,4);
 assert(lines.every(line=>Array.from(line).length<=4));
 assert.equal(lines.join('').replaceAll('\n',''),value.replaceAll('\n',''));
}
assert.deepEqual(wrapText('😀😀😀\n\n字',line=>Array.from(line).length,2),['😀😀','😀','','字']);
console.log('Reader annotation clipboard and Unicode layout passed');
