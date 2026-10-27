import assert from 'node:assert/strict';
import test from 'node:test';
import {webDocumentRestriction,externalPageTarget} from '../dist/lib/web-navigation.js';
import {fpHref} from '../dist/lib/fp-links.js';

test('only conclusive response headers identify unavailable external reading views',()=>{
 for(const values of [{'X-Frame-Options':'SAMEORIGIN'},{'X-Frame-Options':'DENY'},{'Content-Security-Policy':"frame-ancestors 'none'"},{'Content-Security-Policy':"frame-ancestors 'self'"}])assert.equal(webDocumentRestriction(new Headers(values)),'embedding');
 for(const values of [{},{'Content-Security-Policy':'frame-ancestors https://blog.example'},{'Content-Security-Policy':'frame-ancestors *','X-Frame-Options':'DENY'}])assert.equal(webDocumentRestriction(new Headers(values)),null);
 assert.equal(webDocumentRestriction(new Headers({'Content-Type':'application/pdf'})),'content-type');
});

test('cached capabilities route normal clicks to native tabs before any FP is created',async()=>{
 const fetcher=globalThis.fetch,base='https://blog.example/article.html',denied='https://social.example/channel';
 const link=href=>({dataset:{},getAttribute:()=>href,hasAttribute:()=>false,closest:selector=>selector.startsWith('.document,')});
 try{
  let requests=0;globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify({version:1,pages:{},external:[denied]}));};
  const policy=await import('../dist/scripts/web-document-index.js?capabilities-test');
  assert.equal(externalPageTarget(link(denied),{button:0},base,base,policy.opensExternalWebPage),null,'before metadata arrives, behavior is unchanged');
  await policy.loadWebDocumentIndex();await policy.loadWebDocumentIndex();assert.equal(requests,1);
  assert.equal(externalPageTarget(link(denied+'#about'),{button:0},base,base,policy.opensExternalWebPage),denied+'#about');
  const protocol=fpHref([{type:'page',props:{url:denied}}]);assert.equal(externalPageTarget(link(protocol),{button:0},base,base,policy.opensExternalWebPage),denied);
  assert.equal(externalPageTarget(link('https://unknown.example'),{button:0},base,base,policy.opensExternalWebPage),null);
  for(const event of [{button:1},{button:0,ctrlKey:true},{button:0,metaKey:true},{button:0,shiftKey:true},{button:0,altKey:true}])assert.equal(externalPageTarget(link(denied),event,base,base,policy.opensExternalWebPage),null);
 }finally{globalThis.fetch=fetcher;}
});
