import assert from 'node:assert/strict';
import test from 'node:test';
import {loadSourceData,sourceText,bundledSource} from '../src/scripts/sources.js';

test('incremental article changes keep source snapshots and highlighting isolated by source URL and commit',async()=>{
 const saved=new Map(),install=(key,value)=>{saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
 const dataset={sourceUrl:'/data/a.json',commit:'aaa'},calls=[];
 try{
  install('document',{body:{dataset}});
  install('fetch',async url=>{calls.push(url);return {ok:true,json:async()=>({sha:url.includes('/a.json')?'aaa':'bbb',files:[{path:'same.cpp',text:url.includes('/a.json')?'source A':'source B'}]}),text:async()=>url};});
  install('DOMParser',class{parseFromString(html){return {querySelector:()=>({html,classList:{add(){}}})};}});
  assert.equal(await sourceText('same.cpp'),'source A');assert.equal((await loadSourceData()).sha,'aaa');
  assert((await bundledSource('same.cpp')).html.includes('/aaa/'));
  dataset.sourceUrl='/data/b.json';dataset.commit='bbb';assert.equal(await sourceText('same.cpp'),'source B');assert((await bundledSource('same.cpp')).html.includes('/bbb/'));
  dataset.sourceUrl='/data/a.json';dataset.commit='aaa';assert.equal(await sourceText('same.cpp'),'source A');await bundledSource('same.cpp');
  const fixed={sourceUrl:'/data/b.json',commit:'bbb'};assert.equal(await sourceText('same.cpp',fixed),'source B');assert((await bundledSource('same.cpp',fixed)).html.includes('/bbb/'),'a child FP uses its source article rather than the host body');
  assert.equal(calls.filter(url=>url.endsWith('.json')).length,2,'returning to an article reuses its own immutable source snapshot');
  assert.equal(calls.filter(url=>url.endsWith('.html')).length,2,'same paths from different commits never share a highlighted source');
 }finally{for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
});
