import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';

test('static HTML assets cross the prerender boundary, retain requested URLs and publish only current pages',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'reify-web-test-')),oldRoot=process.env.REIFY_PROJECT_ROOT,fetcher=globalThis.fetch,requested=[];
 try{
  process.env.REIFY_PROJECT_ROOT=root;await fs.writeFile(path.join(root,'reify.config.json'),'{}');
  globalThis.fetch=async url=>{
   requested.push(url);const shell=url.endsWith('/shell'),blocked=url.endsWith('/blocked');
   const response=new Response(shell?'<html><body><script>redirect()</script></body></html>':'<!doctype html><title>Guide</title><h1>Guide</h1><p>Published content</p>',{headers:{'Content-Type':'text/html',...(blocked?{'X-Frame-Options':'DENY'}:{})}});
   Object.defineProperty(response,'url',{value:url.endsWith('/guide')?'https://source.example/guide-v2':url});return response;
  };
  const producer=await import('../src/build/web-documents.mjs?producer');
  await producer.prepareWebDocuments(['https://source.example/guide#part','https://source.example/shell','https://source.example/blocked'],'/index.html');
  await producer.prepareWebDocuments(['https://source.example/stale'],'/removed.html');
  const output=path.join(root,'dist');await fs.mkdir(output);await fs.writeFile(path.join(output,'index.html'),'<!doctype html><title>Blog</title>');
  const publisher=await import('../src/build/web-documents.mjs?publisher');
  await publisher.copyWebDocuments(pathToFileURL(output+path.sep));
  const index=JSON.parse(await fs.readFile(path.join(output,'data/web-pages/index.json'),'utf8'));
  assert.deepEqual(Object.keys(index.pages),['https://source.example/guide']);
  const document=JSON.parse(await fs.readFile(path.join(output,index.pages['https://source.example/guide']),'utf8'));
  assert.equal(document.url,'https://source.example/guide-v2');assert(document.html.includes('Published content'));
  assert((await fs.stat(path.join(output,'assets/darkreader/darkreader.js'))).size>100000);
  assert((await fs.readFile(path.join(output,'assets/darkreader/LICENSE'),'utf8')).includes('MIT'));
  const cached=await import('../src/build/web-documents.mjs?cached'),before=requested.length;
  await cached.prepareWebDocuments(['https://source.example/guide'],'/index.html');assert.equal(requested.length,before,'fresh snapshots reuse their styles and HTML without another network request');
 }finally{
  globalThis.fetch=fetcher;if(oldRoot===undefined)delete process.env.REIFY_PROJECT_ROOT;else process.env.REIFY_PROJECT_ROOT=oldRoot;
  assert.equal(path.dirname(root),os.tmpdir());assert(path.basename(root).startsWith('reify-web-test-'));await fs.rm(root,{recursive:true,force:true});
 }
});
