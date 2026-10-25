import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';
import test from 'node:test';

test('the built document worker renders without a DOM',{skip:!process.env.REIFY_BUILD_DIR,timeout:30000},async()=>{
 const assets=path.join(process.env.REIFY_BUILD_DIR,'_astro'),entry=fs.readdirSync(assets).find(name=>/^document-render-.*\.js$/.test(name));
 assert(entry,'a document renderer worker is included in the build');
 const bridge=`import {parentPort,workerData} from 'node:worker_threads';globalThis.self=globalThis;self.postMessage=value=>parentPort.postMessage(value);await import(workerData.entry);await self.onmessage({data:{job:1,source:workerData.source,options:{id:'bundle',format:'md'}}});`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge)),{workerData:{entry:pathToFileURL(path.join(assets,entry)).href,source:'# 文档\n\n实体 &copy;、公式 $x^2$。\n\n<table><tr><td>value</td></tr></table>\n\n```python\nresult = f(value)\n```'}});
 try{
  const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
  assert(!result.error,result.error);assert(result.html.includes('katex'));assert(result.html.includes('data-file-document'));assert(result.html.includes('--shiki-dark'));
 }finally{await worker.terminate();}
});
