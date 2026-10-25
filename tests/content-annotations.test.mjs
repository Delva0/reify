import assert from 'node:assert/strict';
import {codeToHast} from 'shiki';
import katex from 'katex';
import {codeAnnotations} from '../src/build/code-annotations.mjs';
import {decorateCodeLine,codeNodeLength,hastCodeTree as tree} from '../src/lib/code-note-ranges.js';
import {mathMacros,mathStrict,mathTrust} from '../src/math-style.mjs';

const plain=node=>{
 const children=(node.children||[]).flatMap(child=>child.properties?.['data-note-description']||child.properties?.['data-code-annotation-group']!==undefined?child.children.map(plain):[plain(child)]);
 const merged=[];for(const child of children){const last=merged.at(-1);if(child.type==='text'&&last?.type==='text')last.value+=child.value;else if(child.tagName==='span'&&last?.tagName==='span'&&JSON.stringify(last.properties)===JSON.stringify(child.properties))last.children=plain({...last,children:[...last.children,...child.children]}).children;else merged.push(child);}
 return {...node,...(node.children?{children:merged}:{})};
};
const code='const alpha = "任意字符串";\nconst beta = alpha + 1;\nconsole.log(beta);';
for(const notes of [
 {'pha = "任意字符串";\nconst be':'跨 token、跨行、标识符内部'},
 [{at:{text:'alpha',occurrence:2},desc:'重复文本的指定位置'},{at:{text:'log(beta)'},desc:'包含标点的片段'}],
]){
 const options={lang:'javascript',themes:{light:'github-light',dark:'github-dark'}};
 const expected=await codeToHast(code,options);
 const actual=await codeToHast(code,{...options,transformers:[codeAnnotations({notes})]});
 assert.deepEqual(plain(actual),expected,'annotation preserves source text and Shiki token styles');
 const descriptions=[];const visit=node=>{if(node.properties?.['data-note-description'])descriptions.push(node.properties['data-note-description']);for(const child of node.children||[])visit(child);};visit(actual);
 const entries=Array.isArray(notes)?notes:Object.values(notes).map(desc=>({desc}));
 for(const {desc}of entries)assert(descriptions.includes(desc),'annotation spans exist');
}
const options={lang:'javascript',themes:{light:'github-light',dark:'github-dark'}};
const at={from:{line:1,text:'pha'},to:{line:2,text:'be'}},annotations={notes:[{at,desc:'跨行'}],links:[{at,href:'/ge.html'}],marks:[{at,color:'blue'}]};
const decorated=await codeToHast(code,{...options,transformers:[codeAnnotations(annotations)]});
assert.deepEqual(plain(decorated),await codeToHast(code,options),'composed link, note, and mark preserve source and Shiki styles');
const anchors=[];const visit=node=>{if(node.tagName==='a')anchors.push(node);for(const child of node.children||[])visit(child);};visit(decorated);
assert.equal(anchors.length,2,'cross-line linked note has one fragment per line');assert.equal(anchors[0].properties.href,'/ge.html');assert(anchors[0].properties.className.includes('code-mark'));
const canonical=html=>html.match(/<math[\s\S]*?<\/math>/)[0].replace(/<annotation\b[\s\S]*?<\/annotation>/g,'').replace(/<\/?mrow\b[^>]*>/g,'');
for(const fragment of ['\\theta','\\frac{a+b}{c}','\\text{任意 文本}','\\secondary{o_k}+\\primary{a_r}']){
 const options={displayMode:true,macros:mathMacros,strict:mathStrict,trust:mathTrust,throwOnError:true};
 assert.equal(canonical(katex.renderToString('x+'+fragment,options)),canonical(katex.renderToString('x+\\annotate{sample}{'+fragment+'}',options)),'annotation preserves mathematical structure');
}
assert(mathTrust({command:'\\htmlData',attributes:{'data-note':'sample'}}));
assert(!mathTrust({command:'\\htmlStyle',style:'color:red'}));
console.log('Arbitrary code ranges preserve Shiki tokens; formula notes preserve mathematical structure');
