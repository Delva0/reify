import assert from 'node:assert/strict';
import test from 'node:test';
import {parse} from 'parse5';
import {prepareWebDocument,webDocumentHtml,webDocumentKey,webEmbeddingAllowed,webDocumentHasContent} from '../dist/lib/web-document.js';
import {webDocumentBootstrap} from '../dist/lib/web-document-frame.js';
import {bindNativeClose} from '../dist/lib/native-close.js';

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
 const guard=frameNodes.find(node=>attr(node,'data-reify-theme-guard')!==undefined);
 assert(guard.childNodes[0].value.includes('background-image:none!important'),'the initial palette also suppresses light source gradients');
 assert(frameNodes.indexOf(guard)<frameNodes.indexOf(frameNodes.find(node=>node.tagName==='body')),'the first parse already contains the dark guard');
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
const listeners={},messages=[],calls=[],styles=[{sheet:{cssRules:[{}]}}],root={dataset:{},style:{setProperty(){}},setAttribute(){},removeAttribute(){}},parent={postMessage:message=>messages.push(message)};let located=0;
 try{
  install('parent',parent);install('DarkReader',{enable:(...args)=>calls.push(['enable',...args]),disable:()=>calls.push(['disable']),setFetchMethod(){}});
  install('document',{documentElement:root,baseURI:'https://source.test/news',head:{append(){}},createElement:()=>({setAttribute(){}}),querySelector:()=>null,querySelectorAll:()=>styles,getElementById:id=>id==='part'?{scrollIntoView(){located++;}}:null,addEventListener:(name,handler)=>listeners[name]=handler});
  install('addEventListener',(name,handler)=>listeners[name]=handler);install('requestAnimationFrame',()=>{});
  install('setTimeout',()=>1);install('clearTimeout',()=>{});install('MutationObserver',class{observe(){}disconnect(){}});
  webDocumentBootstrap({token:'ours',theme:{dark:true,paper:'#161616',ink:'#dedede',scroll:'#555'},anchor:'part',scrollbars:'',externalLinks:['https://source.test/blocked']});
  assert.equal(calls[0][0],'enable');assert.equal(calls[0][1].darkSchemeBackgroundColor,'#161616');assert.equal(root.dataset.reifyTheme,'dark');assert.equal(located,1);
  assert(messages.some(message=>message.type==='reify:web-ready'),'readiness cannot depend on painting an invisible frame');
  listeners.message({source:{},data:{type:'reify:web-theme',token:'ours',theme:{dark:false}}});assert.equal(calls.length,1);
  listeners.message({source:parent,data:{type:'reify:web-theme',token:'wrong',theme:{dark:false}}});assert.equal(calls.length,1);
  listeners.message({source:parent,data:{type:'reify:web-theme',token:'ours',theme:{dark:false}}});assert(styles[0].disabled);assert.equal(root.dataset.reifyTheme,'light');
  listeners.message({source:parent,data:{type:'reify:web-theme',token:'ours',theme:{dark:true}}});assert(!styles[0].disabled);assert.equal(calls.length,1,'switching back reuses the generated styles without running the engine again');
  const click=(href,extra={})=>{const event={button:0,target:{closest:()=>({href,hasAttribute:()=>false})},preventDefault(){this.prevented=true;},...extra};listeners.click(event);return event;};
  assert(click('https://source.test/next').prevented);assert.equal(messages.at(-1).href,'https://source.test/next');
  const before=messages.length;for(const extra of [{ctrlKey:true},{metaKey:true},{button:1}])assert(!click('https://source.test/next',extra).prevented);assert.equal(messages.length,before);
  assert(!click('https://source.test/blocked#part').prevented,'a known unavailable target keeps its native new-tab action inside the frame');assert.equal(messages.length,before);
  assert(click('https://source.test/news#part').prevented);assert.equal(located,2);assert.equal(messages.length,before);
 }finally{for(const [name,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
});

test('a delayed or failed theme engine cannot prevent reading or link handling',()=>{
 const originals=new Map(),install=(name,value)=>{originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
 const listeners={},messages=[],calls=[],engine={},parent={postMessage:message=>messages.push(message)};let pending=true;
 try{
  install('parent',parent);install('DarkReader',undefined);
  install('document',{documentElement:{dataset:{},style:{setProperty(){}},setAttribute(){pending=true;},removeAttribute(){pending=false;}},baseURI:'https://source.test/news',head:{append(){}},createElement:()=>({setAttribute(){}}),querySelector:()=>({addEventListener:(name,handler)=>engine[name]=handler}),querySelectorAll:()=>[],getElementById:()=>null,addEventListener:(name,handler)=>listeners[name]=handler});
  install('addEventListener',(name,handler)=>listeners[name]=handler);install('requestAnimationFrame',()=>{});
  install('setTimeout',()=>1);install('clearTimeout',()=>{});install('MutationObserver',class{observe(){}disconnect(){}});
  webDocumentBootstrap({token:'ours',theme:{dark:true},scrollbars:''});
  assert(messages.some(message=>message.type==='reify:web-ready'));
  assert(pending,'the dark first-paint palette remains active when the engine is missing');
  assert.equal(typeof listeners.click,'function');
  listeners.message({source:parent,data:{type:'reify:web-theme',token:'ours',theme:{dark:false}}});
  assert(!pending);
  globalThis.DarkReader={setFetchMethod(){},enable:()=>calls.push('dark'),disable:()=>calls.push('light')};
  engine.load();assert.deepEqual(calls,[],'a late engine never starts dark generation while the reader is in light mode');
  globalThis.DarkReader.enable=()=>{throw Error('theme unavailable');};
  listeners.message({source:parent,data:{type:'reify:web-theme',token:'ours',theme:{dark:true}}});
  assert(pending,'switching back to dark restores the safe palette even after an engine failure');
  assert(messages.some(message=>message.type==='reify:web-error'));
  const event={button:0,target:{closest:()=>({href:'https://source.test/next',hasAttribute:()=>false})},preventDefault(){this.prevented=true;}};
  listeners.click(event);assert(event.prevented);assert.equal(messages.at(-1).href,'https://source.test/next');
 }finally{for(const [name,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
});

test('a cached dark HTML snapshot keeps inline colors and needs no theme engine',()=>{
 const snapshot='<!doctype html><html><head><style class="darkreader darkreader--inline">[data-darkreader-inline-color]{color:var(--darkreader-inline-color)!important}</style></head><body><p data-darkreader-inline-color style="color:red;--darkreader-inline-color:pink">Cached</p></body></html>';
 const nodes=all(parse(webDocumentHtml({html:'',url:'https://source.test'},{token:'t',nonce:'n',theme:{dark:true,paper:'#161616',ink:'#dedede'},snapshot})));
 assert.equal(nodes.filter(node=>node.tagName==='script').length,1,'only the link/theme bridge runs on a cache hit');
 assert(!nodes.some(node=>attr(node,'data-reify-theme-engine')!==undefined));
 assert.equal(attr(nodes.find(node=>node.tagName==='p'),'style'),'color:red;--darkreader-inline-color:pink');
 assert(nodes.some(node=>attr(node,'class')?.includes('darkreader--inline')));
});

test('isolated HTML forwards platform closing and shares browser search priority',async()=>{
 const originals=new Map(),install=(name,value)=>{originals.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
 const listeners={},messages=[],watchers=[],parent={postMessage:message=>messages.push(message)};
 class Watcher extends EventTarget{active=true;constructor(){super();watchers.push(this);}destroy(){this.active=false;}close(){if(this.active){this.active=false;this.dispatchEvent(new Event('close'));}}}
 try{
  install('parent',parent);install('CloseWatcher',Watcher);
  install('document',{documentElement:{dataset:{},style:{setProperty(){}},removeAttribute(){}},head:{append(){}},createElement:()=>({setAttribute(){}}),querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(name,handler)=>listeners[name]=handler});
  install('addEventListener',(name,handler)=>listeners[name]=handler);install('removeEventListener',(name,handler)=>{if(listeners[name]===handler)delete listeners[name];});
  install('setTimeout',()=>1);install('clearTimeout',()=>{});install('MutationObserver',class{observe(){}disconnect(){}});
  webDocumentBootstrap({token:'ours',theme:{dark:false},scrollbars:''},bindNativeClose);
  assert.equal(watchers.filter(w=>w.active).length,1,'the focused frame owns a platform close watcher');
  const key=(type,key,options={})=>listeners[type]({key,...options,preventDefault(){throw Error('native browser keys stay unclaimed');}});
  key('keydown','f',{ctrlKey:true});
  assert.equal(messages.at(-1).type,'reify:web-close-priority');assert.equal(messages.at(-1).pending,true);assert(!watchers.some(w=>w.active));
  key('keydown','Escape');assert(!messages.some(message=>message.type==='reify:web-close'),'find dismissal never closes an FP');
  key('keyup','Escape');assert.equal(messages.at(-1).pending,false);assert.equal(watchers.filter(w=>w.active).length,1);
  watchers.at(-1).close();await Promise.resolve();
  assert.equal(messages.filter(message=>message.type==='reify:web-close').length,1,'one native request forwards exactly one close to the shared FP stack');
  listeners.message({source:{},data:{type:'reify:web-close-priority',token:'ours',pending:true}});assert(watchers.at(-1).active,'other windows cannot change close handling');
  listeners.message({source:parent,data:{type:'reify:web-close-priority',token:'wrong',pending:true}});assert(watchers.at(-1).active,'other instances cannot change close handling');
  listeners.message({source:parent,data:{type:'reify:web-close-priority',token:'ours',pending:true}});assert(!watchers.some(w=>w.active),'parent search priority also suspends the frame watcher');
  listeners.pagehide();assert(!listeners.keydown&&!listeners.keyup,'disposing the document removes keyboard listeners');
 }finally{for(const [name,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
});
