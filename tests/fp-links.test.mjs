import assert from 'node:assert/strict';
import {parseFpUrl,fpHref,withFpState,validateFpState} from '../src/lib/fp-links.js';
import {codeHref,blockHref,internalCodeTargets} from '../src/lib/code-links.js';

const base='https://example.test/article.html?theme=light#mdx-3';
const a={type:'code',props:{file:'src/a.cpp',ranges:[{from:10,to:20}]}},b={type:'code',props:{file:'src/b.cpp',ranges:[]}};
assert.equal(fpHref([a]),'?fp=code&file=src/a.cpp&lines=10-20');
const multi=fpHref([a,b]);assert(multi.startsWith('?fp=!('));assert(!multi.includes('fp.'));
assert.deepEqual(parseFpUrl(multi,base),[a,b]);
assert.deepEqual(parseFpUrl('?fp=!((type:code,file:src/a.cpp,lines:\'10-20\'),(type:code,file:src/b.cpp))',base),[a,b]);
assert.deepEqual(parseFpUrl(fpHref([a,a]),base),[a,a],'two instances can have identical configuration');
assert.deepEqual(parseFpUrl(blockHref('plan-code'),base),[{type:'code',props:{block:'plan-code',ranges:[]}}]);
const special={type:'code',props:{file:"目录/a + !' & # %.cpp",ranges:[{from:2,to:4,color:'blue'}]}};
const remote={type:'code',props:{file:'https://example.test/resource?file=a&value=1%202#part',ranges:[]}};
for(const state of [[special],[special,remote],[remote,special,a],Array.from({length:16},()=>a)]){
 const href=fpHref(state),parsed=parseFpUrl(href,base);assert.deepEqual(parsed,state,'paths and resource URLs survive both encodings');
 assert.equal(fpHref(parsed),href,'canonical encoding is idempotent');
 const url=withFpState(base,state);assert.equal(url.searchParams.get('theme'),'light');assert.equal(url.hash,'#mdx-3');assert.deepEqual(parseFpUrl(url.href,base),state);
}
assert.equal(withFpState(withFpState(base,[a,b]).href,[]).href,base);
assert.equal(fpHref(parseFpUrl(fpHref([a,b]),base).slice(0,1)),codeHref('src/a.cpp',a.props.ranges),'closing one of two panels returns to flat single syntax');
const targets=internalCodeTargets([fpHref([special,b])],base);assert.deepEqual(targets.map(({target})=>target.file),[special.props.file,b.props.file],'all file instances are pre-cached');
assert.throws(()=>parseFpUrl('?fp=code&file=a&edits=x',base));
assert.throws(()=>parseFpUrl('?fp=code&block=a&lines=1',base));
assert.throws(()=>validateFpState([{type:'code',props:{block:'a',edits:[]}}]));
assert.deepEqual(parseFpUrl(fpHref([{type:'code',props:{block:'vector-add',ranges:[]}},a]),base),[{type:'code',props:{block:'vector-add',ranges:[]}},a]);
for(const href of ['?fp=code','?fp=code&file=a&block=b','?fp=other&file=a','?fp=code&fp=code&file=a','?fp=!((type:code,file:a))&file=b','?fp.0=code&fp.0.file=a','?code=a','?fp=%XX','?fp=!((type:code,file:a,extra:b))','?fp=!((type:code,file:!n))','?fp=!((type:constructor,file:a))'])assert.throws(()=>parseFpUrl(href,base),undefined,href);
assert.throws(()=>validateFpState(Array.from({length:17},()=>a)));
assert.equal(parseFpUrl('other.html'+multi,base),null,'other articles retain native navigation');
assert.deepEqual(parseFpUrl('other.html'+multi,base,{samePage:false}),[a,b]);
assert.equal(parseFpUrl('https://external.test/'+multi,base,{samePage:false}),null);
assert.equal(parseFpUrl('#mdx-4',withFpState(base,[a]).href),null);
console.log('FP URLs: named blocks, file resources, flat single, Rison multi, limits and canonical round trips passed');
