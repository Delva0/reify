import assert from 'node:assert/strict';
import {articleCodeBlock} from '../src/scripts/article-pages.js';
const saved=new Map(),install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,configurable:true,writable:true});};
const local={id:'local'},first={id:'one'},second={id:'two'},recovered={id:'retry'};let reads=0,failed=true;
try{
 install('location',{href:'https://wiki.test/article-page-2.html',origin:'https://wiki.test',pathname:'/article-page-2.html'});
 install('document',{getElementById:id=>id==='local'?local:null,querySelector:()=>({textContent:JSON.stringify({anchors:{one:'article.html',two:'article.html',retry:'article-page-3.html',external:'https://other.test/article.html',current:'article-page-2.html'}})})});
 install('fetch',async url=>{reads++;if(url.endsWith('page-3.html')&&failed)throw Error('offline');return {ok:true,text:async()=>url};});
 install('DOMParser',class{parseFromString(){return {getElementById:id=>({one:first,two:second,retry:recovered})[id]};}});
 assert.equal(await articleCodeBlock('local'),local);assert.equal(reads,0);
 assert.deepEqual(await Promise.all([articleCodeBlock('one'),articleCodeBlock('two')]),[first,second]);assert.equal(reads,1,'multiple panels from the same page share a single HTML request');
 assert.equal(await articleCodeBlock('one'),first);assert.equal(reads,1);
 assert.equal(await articleCodeBlock('unknown'),null);assert.equal(await articleCodeBlock('external'),null);assert.equal(await articleCodeBlock('current'),null);assert.equal(reads,1,'unknown or external targets never fetch arbitrary documents');
 await assert.rejects(articleCodeBlock('retry'),/offline/);failed=false;assert.equal(await articleCodeBlock('retry'),recovered);assert.equal(reads,3,'failed page requests may be retried');
 console.log('Cross-page code blocks share requests, keep local blocks synchronous, reject foreign targets and recover after failure');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
