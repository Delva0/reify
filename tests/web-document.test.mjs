import assert from 'node:assert/strict';
import test from 'node:test';
import {parse} from 'parse5';
import {prepareWebDocument,webDocumentHtml,webDocumentKey,webEmbeddingAllowed,webDocumentHasContent} from '../src/lib/web-document.js';
import {webDocumentBootstrap} from '../src/lib/web-document-frame.js';

const all=node=>[node,...(node.childNodes||[]).flatMap(all),...(node.content?[...all(node.content)]:[])];
const attr=(node,name)=>node.attrs?.find(item=>item.name===name)?.value;
test('HTML previews keep layout and image addresses while removing executable third-party content',async()=>{
 const styles=new Map([
  ['https://source.test/css/news.css','@import url("./reset.css") screen;body{background:#fff;color:#111;background-image:url(../img/banner.svg)}'],
  ['https://source.test/css/reset.css','h1{margin:0}'],
 ]);
 const resource=await prepareWebDocument('<!doctype html><title>News</title><link rel="stylesheet" href="../css/news.css"><meta http-equiv="refresh" content="0;url=https://evil.test"><script>parent.steal()</script><body onload="steal()"><h1 id="news">News</h1><img data-src="../img/news.png" onerror="steal()"><a href="../next.html#x">Next</a><a href="javascript:steal()">bad</a><iframe srcdoc="bad"></iframe><template><script>steal()</script></template>', 'https://source.test/news/article.html',{loadStyle:url=>styles.get(url)});
 const nodes=all(parse(resource.html));
 assert.equal(resource.title,'News');assert(resource.html.includes('@media screen{h1{margin:0}}'));
 assert(resource.html.includes('https://source.test/img/banner.svg'));assert.equal(attr(nodes.find(n=>n.tagName==='base'),'href'),'https://source.test/news/article.html');
 assert.equal(attr(nodes.find(n=>n.tagName==='img'),'src'),'../img/news.png');
 assert.equal(attr(nodes.find(n=>n.tagName==='a'),'href'),'https://source.test/next.html#x');
 assert(!nodes.some(n=>['script','iframe','object','embed'].includes(n.tagName)));
 assert(!nodes.some(n=>n.attrs?.some(a=>/^on/i.test(a.name)||a.name==='srcdoc'||a.value.startsWith('javascript:'))));
 assert(!nodes.some(n=>n.tagName==='meta'&&attr(n,'http-equiv')));
 const html=webDocumentHtml(resource,{token:'instance',nonce:'trusted',theme:{dark:true},engine:'https://wiki.test/assets/darkreader/darkreader.js',anchor:'news',scrollbars:'/* </script> */'}),frameNodes=all(parse(html)),scripts=frameNodes.filter(n=>n.tagName==='script');
 assert.equal(scripts.length,2);assert(scripts.every(n=>attr(n,'nonce')==='trusted'));
 assert.equal(attr(scripts[0],'src'),'https://wiki.test/assets/darkreader/darkreader.js');
 assert.equal(attr(scripts[0],'async'),'','theme loading must not block the readable document');
 assert(attr(frameNodes.find(n=>attr(n,'http-equiv')==='Content-Security-Policy'),'content').includes("script-src 'nonce-trusted'"));
 assert(html.includes('\\u003c/script>'),'configuration cannot terminate its trusted bootstrap script');
 const hostile=await prepareWebDocument('<link rel="stylesheet" href="https://source.test/hostile.css"><p>News</p>','https://source.test/news',{loadStyle:async()=>'</style><script>steal()</script><style>'});
 assert(!all(parse(hostile.html)).some(node=>node.tagName==='script'),'CSS responses cannot escape their style element');
});

test('public HTML cache keys ignore anchors and embedding restrictions remain effective',()=>{
 assert.equal(webDocumentKey('https://source.test/news?lang=en#part'),'https://source.test/news?lang=en');
 assert(webEmbeddingAllowed(new Headers()));assert(webEmbeddingAllowed(new Headers({'Content-Security-Policy':'frame-ancestors *'})));
 for(const headers of [{'X-Frame-Options':'DENY'},{'X-Frame-Options':'SAMEORIGIN'},{'Content-Security-Policy':"frame-ancestors 'self'"}])assert(!webEmbeddingAllowed(new Headers(headers)));
 assert(!webDocumentHasContent('<head><style>body{color:red}</style></head><body><div id="app"></div><script>redirect()</script>'),'script-only redirect shells keep their original browser view');
 assert(webDocumentHasContent('<body><p>Hello</p>'));assert(webDocumentHasContent('<body><img src="figure.svg">'));
});

test('isolated Dark Reader follows only its parent theme and preserves native modified links',()=>{
 const originals=new Map(),install=(name,value)=>{originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
 const listeners={},messages=[],calls=[],root={dataset:{},style:{setProperty(){}},},parent={postMessage:message=>messages.push(message)};let located=0;
 try{
  install('parent',parent);install('DarkReader',{enable:(...args)=>calls.push(['enable',...args]),disable:()=>calls.push(['disable']),setFetchMethod(){}});
  install('document',{documentElement:root,baseURI:'https://source.test/news',head:{append(){}},createElement:()=>({}),querySelector:()=>null,getElementById:id=>id==='part'?{scrollIntoView(){located++;}}:null,addEventListener:(name,handler)=>listeners[name]=handler});
  install('addEventListener',(name,handler)=>listeners[name]=handler);install('requestAnimationFrame',()=>{});
  webDocumentBootstrap({token:'ours',theme:{dark:true,paper:'#161616',ink:'#dedede',scroll:'#555'},anchor:'part',scrollbars:''});
  assert.equal(calls[0][0],'enable');assert.equal(calls[0][1].darkSchemeBackgroundColor,'#161616');assert.equal(root.dataset.reifyTheme,'dark');assert.equal(located,1);
  assert(messages.some(message=>message.type==='reify:web-ready'),'readiness cannot depend on painting an invisible frame');
  listeners.message({source:{},data:{type:'reify:web-theme',token:'ours',theme:{dark:false}}});assert.equal(calls.length,1);
  listeners.message({source:parent,data:{type:'reify:web-theme',token:'wrong',theme:{dark:false}}});assert.equal(calls.length,1);
  listeners.message({source:parent,data:{type:'reify:web-theme',token:'ours',theme:{dark:false}}});assert.equal(calls.at(-1)[0],'disable');assert.equal(root.dataset.reifyTheme,'light');
  const click=(href,extra={})=>{const event={button:0,target:{closest:()=>({href,hasAttribute:()=>false})},preventDefault(){this.prevented=true;},...extra};listeners.click(event);return event;};
  assert(click('https://source.test/next').prevented);assert.equal(messages.at(-1).href,'https://source.test/next');
  const before=messages.length;for(const extra of [{ctrlKey:true},{metaKey:true},{button:1}])assert(!click('https://source.test/next',extra).prevented);assert.equal(messages.length,before);
  assert(click('https://source.test/news#part').prevented);assert.equal(located,2);assert.equal(messages.length,before);
 }finally{for(const [name,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
});

test('a delayed or failed theme engine cannot prevent reading or link handling',()=>{
 const originals=new Map(),install=(name,value)=>{originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
 const listeners={},messages=[],calls=[],engine={},parent={postMessage:message=>messages.push(message)};
 try{
  install('parent',parent);install('DarkReader',undefined);
  install('document',{documentElement:{dataset:{},style:{setProperty(){}}},baseURI:'https://source.test/news',head:{append(){}},createElement:()=>({}),querySelector:()=>({addEventListener:(name,handler)=>engine[name]=handler}),getElementById:()=>null,addEventListener:(name,handler)=>listeners[name]=handler});
  install('addEventListener',(name,handler)=>listeners[name]=handler);install('requestAnimationFrame',()=>{});
  webDocumentBootstrap({token:'ours',theme:{dark:true},scrollbars:''});
  assert(messages.some(message=>message.type==='reify:web-ready'));
  assert.equal(typeof listeners.click,'function');
  listeners.message({source:parent,data:{type:'reify:web-theme',token:'ours',theme:{dark:false}}});
  globalThis.DarkReader={setFetchMethod(){},enable:()=>calls.push('dark'),disable:()=>calls.push('light')};
  engine.load();assert.deepEqual(calls,['light'],'a late engine uses the current parent theme');
  globalThis.DarkReader.enable=()=>{throw Error('theme unavailable');};
  listeners.message({source:parent,data:{type:'reify:web-theme',token:'ours',theme:{dark:true}}});
  assert(messages.some(message=>message.type==='reify:web-error'));
  const event={button:0,target:{closest:()=>({href:'https://source.test/next',hasAttribute:()=>false})},preventDefault(){this.prevented=true;}};
  listeners.click(event);assert(event.prevented);assert.equal(messages.at(-1).href,'https://source.test/next');
 }finally{for(const [name,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
});
