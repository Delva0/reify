import assert from 'node:assert/strict';
import {resolveCodeAnnotations,normalizeCodeAnnotations,normalizeCodeSelector} from '../dist/lib/code-annotations.js';
import {normalizeCodeBlock,serializeCodeBlock} from '../dist/lib/code-block.js';
const code='const value = "你好😀";\nreturn value + value;',at={line:2,text:'value',occurrence:2};
const [range]=resolveCodeAnnotations(code,{notes:[{at,desc:'第二个值'}],links:[{at,href:'?fp=code&block=next'}],marks:[{at,color:'amber'}]});
assert.equal(code.slice(range.start,range.end),'value');assert.equal(range.start,code.lastIndexOf('value'));assert.deepEqual(Object.keys(range.decorations),['note','link','mark']);
assert.equal(code.slice(...Object.values(resolveCodeAnnotations(code,{notes:{'你好😀':'Unicode'}})[0]).slice(0,2)),'你好😀');
assert.equal(resolveCodeAnnotations(code,{notes:[{at:{line:2,pattern:'VALUE',flags:'i',occurrence:2},desc:'正则'}]})[0].start,code.lastIndexOf('value'));
const cross={from:{line:1,text:'"你好'},to:{line:2,text:'return'}};
assert.equal(code.slice(...Object.values(resolveCodeAnnotations(code,{notes:[{at:cross,desc:'跨行'}]})[0]).slice(0,2)),'"你好😀";\nreturn');
assert.equal(resolveCodeAnnotations(code,{marks:[{at:{line:2},color:'blue'}]})[0].end,code.length);
for(const at of [{line:0},{line:3},{text:'missing'},{pattern:'['},{pattern:'x',flags:3},{from:{line:2},to:{line:1}},{line:1,text:'value',pattern:'value'},{pattern:'(?=const)'},{}])assert.throws(()=>resolveCodeAnnotations(code,{notes:[{at,desc:'x'}]}),undefined,JSON.stringify(at));
assert.throws(()=>resolveCodeAnnotations(code,{notes:[{at:{text:'value'},desc:'x'}],links:[{at:{text:'val'},href:'/a'}]}),/显式拆分/);
assert.throws(()=>normalizeCodeAnnotations({links:[{at,href:'javascript:alert(1)'}]}));
assert.throws(()=>normalizeCodeAnnotations({marks:[{at,color:'red'}]}));
for(const render of [true,false])for(const content of [{code},{src:'src/a.cpp'}]){
 const block=normalizeCodeBlock({id:'a',...content,render,lines:'1-2',notes:{value:'值'}});
 assert.equal(block.render,render);assert.equal(block.notes[0].at.text,'value');assert.equal(block.ranges[0].to,2);
 assert.deepEqual(JSON.parse(serializeCodeBlock(block)),block);
}
assert.equal(normalizeCodeBlock({id:'remote',src:'https://example.test/a.cpp?raw=1'}).language,'cpp');
assert(!serializeCodeBlock({code:'</template><script>'}).includes('<'));
for(const props of [{},{code,src:'a.cpp'},{code:123},{src:'../a.cpp'},{code,render:'false'},{code,edits:[]},{code,language:42},{code,lines:{}}])assert.throws(()=>normalizeCodeBlock({id:'a',...props}));
assert.deepEqual(normalizeCodeSelector({text:'任意子串'}),{text:'任意子串'});
console.log('Structured code annotations: precise selectors, composed semantics, validation and independent CodeBlock options passed');
