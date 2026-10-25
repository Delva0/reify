import assert from 'node:assert/strict';
import {readRepositoryTree,readFile,encodeFilePath,indexTree,MAX_SOURCE_BYTES} from '../src/lib/github-files.js';

assert.equal(encodeFilePath('src/a #中文.cpp'),'src/a%20%23%E4%B8%AD%E6%96%87.cpp');
const entry=(path,type='blob')=>({path,type,size:10});
const entries=[entry('z'),entry('b','tree'),entry('a.txt'),entry('a','tree'),entry('b/nested','tree'),entry('b/nested/中文 file.cpp'),entry('submodule','commit')];
const snapshot={repository:'owner/repo',commit:'fixed',entries};
const indexed=indexTree(snapshot,'owner/repo','fixed');
assert.deepEqual(indexed.get('').map(x=>[x.path,x.type]),[['a','tree'],['b','tree'],['a.txt','blob'],['submodule','commit'],['z','blob']]);
assert.equal(indexed.get('b/nested')[0].path,'中文 file.cpp');
assert.equal(indexed.get('a').length,0,'empty trees remain browsable');
assert.throws(()=>indexTree(snapshot,'owner/repo','wrong-commit'),/版本不一致/);
assert.throws(()=>indexTree({...snapshot,entries:[entry('missing/child')]},'owner/repo','fixed'),/缺少父目录/);
assert.throws(()=>indexTree({...snapshot,entries:[entry('../escape')]},'owner/repo','fixed'),/无效/);
assert.throws(()=>indexTree({...snapshot,entries:[entry('same'),entry('same')]},'owner/repo','fixed'),/无效/);

let calls=0;
const url='/data/trees/repo/fixed.json',fetcher=async requested=>{assert.equal(requested,url);++calls;return Response.json(snapshot);};
const [a,b]=await Promise.all([readRepositoryTree(url,'owner/repo','fixed',{fetcher}),readRepositoryTree(url,'owner/repo','fixed',{fetcher})]);
assert.equal(calls,1);assert.equal(a,b);
for(const children of a.values())for(const child of children)assert(child.path);
assert.equal(calls,1,'traversing every folder requires no additional requests');
await readRepositoryTree('/data/trees/repo/next.json','owner/repo','next',{fetcher:async()=>{++calls;return Response.json({...snapshot,commit:'next'});}});assert.equal(calls,2,'commit switch loads its own immutable snapshot');
let attempts=0;
await assert.rejects(readRepositoryTree('/retry.json','owner/repo','fixed',{fetcher:async()=>{++attempts;return new Response('',{status:503});}}),/读取失败/);
await readRepositoryTree('/retry.json','owner/repo','fixed',{fetcher:async()=>{++attempts;return Response.json(snapshot);}});assert.equal(attempts,2,'failed promises must not poison retry');
await assert.rejects(readRepositoryTree('/wrong.json','owner/repo','fixed',{fetcher:async()=>Response.json({...snapshot,commit:'stale'})}),/版本不一致/);

let downloads=0;const getText=async()=>{++downloads;return new Response('int main() { return 0; }',{headers:{'content-type':'text/plain'}});};
const text=await readFile('https://raw.example/c.cpp',23,{fetcher:getText});assert.equal(text.kind,'text');assert.match(text.text,/main/);
await readFile('https://raw.example/c.cpp',23,{fetcher:getText});assert.equal(downloads,1);
assert.equal((await readFile('too-big',MAX_SOURCE_BYTES+1,{fetcher:()=>{throw Error('must not download');}})).kind,'unsupported');
assert.equal((await readFile('binary',4,{fetcher:async()=>new Response(new Uint8Array([1,0,2,3]))})).kind,'unsupported');
assert.equal((await readFile('invalid-encoding',2,{fetcher:async()=>new Response(new Uint8Array([0xff,0xff]))})).kind,'unsupported');
assert.equal((await readFile('image',4,{fetcher:async()=>new Response(new Uint8Array([1,2,3,4]),{headers:{'content-type':'image/png'}})})).kind,'image');
assert.equal((await readFile('uncapped',undefined,{fetcher:async()=>new Response(new Uint8Array(MAX_SOURCE_BYTES+1))})).kind,'unsupported','enforce cap without Content-Length');
await assert.rejects(readFile('retry-file',4,{fetcher:async()=>new Response('',{status:404})}),/未找到/);
assert.equal((await readFile('retry-file',4,{fetcher:getText})).kind,'text');
console.log('GitHub files: one snapshot request for all folders, version isolation, retries, encoded paths, byte cap, binary/image handling passed');
