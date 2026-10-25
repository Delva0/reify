import assert from 'node:assert/strict';
import {indexTree} from '../src/lib/github-files.js';
import {codeDistribution,share,compactLines,distributionTip} from '../src/lib/code-distribution.js';
const snapshot={repository:'owner/repo',commit:'fixed',entries:[
 {path:'root.cpp',type:'blob',language:'C++',lines:10},
 {path:'src',type:'tree'},
 {path:'src/b.cpp',type:'blob',language:'C++',lines:30},
 {path:'src/p.py',type:'blob',language:'Python',lines:20},
 {path:'src/nested',type:'tree'},
 {path:'src/nested/c.cpp',type:'blob',language:'C++',lines:10},
 {path:'empty',type:'tree'},
 {path:'zero.py',type:'blob',language:'Python',lines:0},
 {path:'unrecognized',type:'blob'},
 {path:'invalid',type:'blob',language:'Invalid',lines:-1}
]};
const distribution=codeDistribution(indexTree(snapshot,'owner/repo','fixed'));
assert.deepEqual(distribution.languages,[{language:'.cpp',lines:50},{language:'.py',lines:20}]);
assert.equal(distribution.total,70);
assert.equal(distribution.lines('src','.cpp'),40);
assert.equal(distribution.lines('src/nested','.cpp'),10);
assert.equal(distribution.lines('src/nested/c.cpp','.cpp'),10);
assert.equal(distribution.lines('src/nested','.py'),0);
assert.equal(distribution.lines('empty','.cpp'),0);
assert.equal(share(distribution.lines('src','.cpp'),distribution.lines('','.cpp')),80);
assert.equal(share(distribution.lines('src/b.cpp','.cpp'),distribution.lines('src','.cpp')),75);
assert.equal(share(distribution.lines('src/nested','.cpp'),distribution.lines('src','.cpp')),25);
assert.equal(share(10,0),0);assert.equal(share(20,10),100);assert.equal(share(-1,10),0);
assert.deepEqual(codeDistribution(new Map([['',[]]])).languages,[]);
assert.equal(compactLines(999),'999');assert.equal(compactLines(1200),'1.2K');assert.equal(compactLines(2100000),'2.1M');
assert.equal(compactLines(1330),'1.33K');
const names=codeDistribution(new Map([['',[{path:'Dockerfile',type:'blob',lines:3},{path:'.gitignore',type:'blob',lines:1},{path:'empty.xyz',type:'blob',lines:0}]]]));
assert.deepEqual(names.languages.map(item=>item.language),['Dockerfile','.gitignore','.xyz']);
assert.equal(distributionTip('a.cpp'),'');
assert.equal(distributionTip('long-name.cpp',{truncated:true}),'long-name.cpp');
assert.equal(distributionTip('a.cpp',{active:true,lines:1330,percentage:30}),'1.33K行 30%');
assert.equal(distributionTip('long.cpp',{truncated:true,active:true,lines:1330,percentage:30}),'long.cpp\n1.33K行 30%');
assert.equal(distributionTip('zero.cpp',{active:true,lines:0}),'');
assert.equal(distributionTip('long-zero.cpp',{truncated:true,active:true,lines:0}),'long-zero.cpp');
console.log('Code distribution: language inventory, ancestor aggregation, parent-relative line widths, empty and unrecognized files passed');
