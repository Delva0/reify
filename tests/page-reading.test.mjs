import assert from 'node:assert/strict';
import test from 'node:test';
import {createPageReadingStore,pageReadingScope,pageReadingTarget} from '../dist/scripts/page-reading.js';

test('main reading cache isolates H1 pages and versions, batches writes and resumes after refresh',()=>{
 const storage=new Map(),timers=new Map();let timer=0,writes=0;
 const options={storage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{writes++;storage.set(key,value);}},limit:3,schedule:fn=>{timers.set(++timer,fn);return timer;},cancel:id=>timers.delete(id)};
 const cache=createPageReadingStore(options),data={repositoryName:'owner/repo',commit:'abc'},a=pageReadingScope('https://wiki.test/article.html?fp=code&file=a.cpp#section',data),b=pageReadingScope('https://wiki.test/article-page-2.html',data);
 assert.equal(a,pageReadingScope('https://wiki.test/article#other',data),'FP and anchor state do not split the physical page reading position');assert.notEqual(a,b);assert.notEqual(a,pageReadingScope('https://wiki.test/article.html',{...data,commit:'def'}));
 for(let y=0;y<100;y++)cache.remember(a,{x:0,y});cache.remember(b,{x:8,y:500});assert.equal(writes,0);assert.equal(timers.size,1,'scroll frames share one throttled storage write');cache.flush();assert.equal(writes,1);assert.equal(timers.size,0);
 const refreshed=createPageReadingStore(options);assert.deepEqual(refreshed.read(a),{x:0,y:99});assert.deepEqual(refreshed.read(b),{x:8,y:500});
 cache.remember('third',{x:0,y:3});cache.remember('fourth',{x:0,y:4});cache.flush();assert.equal(createPageReadingStore(options).read(a),null,'the persisted reading index is bounded');assert.equal(createPageReadingStore(options).read(b).y,500);
 cache.remember(b,{x:0,y:NaN});assert.deepEqual(cache.read(b),{x:8,y:500});
});

test('explicit anchors win new links, while reload and Back/Forward restore their own history positions',()=>{
 const url=new URL('https://wiki.test/article.html#section'),scope='page-a',stored={x:0,y:800},state={reifyNavigation:{scope,scroll:{x:0,y:300}}};
 for(const reason of ['link','navigate'])assert.equal(pageReadingTarget({url,scope,reason,state,stored}),null);
 for(const reason of ['reload','back_forward','popstate'])assert.deepEqual(pageReadingTarget({url,scope,reason,state,stored}),{x:0,y:300});
 assert.deepEqual(pageReadingTarget({url,scope:'page-b',reason:'reload',state,stored}),stored,'a history snapshot from another article/version is ignored');
 assert.deepEqual(pageReadingTarget({url,scope,reason:'reload',stored}),stored);url.hash='';assert.deepEqual(pageReadingTarget({url,scope,reason:'link',stored}),stored);
});

test('page navigation restores before capturing zero and preserves same-page history and native anchor priority',async()=>{
 const saved=new Map(),install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
 const storage=new Map(),windowEvents=new Map(),documentEvents=new Map(),frames=new Map(),timers=new Map();let frame=0,timer=0,writes=0,anchors=0;
 try{
  const data={repositoryName:'owner/repo',commit:'abc'};install('location',new URL('https://wiki.test/article.html#section'));install('scrollX',0);install('scrollY',0);
  const scope=pageReadingScope(location.href,data);storage.set('reading-pages-v1',JSON.stringify({version:1,entries:[[scope,{x:0,y:650}]]}));
  install('localStorage',{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{writes++;storage.set(key,value);}});
  install('document',{body:{dataset:data},documentElement:{outerHTML:'<html></html>'},querySelector:()=>null,querySelectorAll:()=>[],getElementById:()=>({scrollIntoView(){anchors++;globalThis.scrollY=99;}}),addEventListener:(name,fn)=>documentEvents.set(name,fn)});
  install('performance',{getEntriesByType:()=>[{type:'reload'}]});install('history',{state:{other:'preserved',reifyFp:{ids:['existing-fp']},reifyNavigation:{scope,scroll:{x:0,y:700}}},replaceState(state,_title,url){this.state=state;globalThis.location=new URL(url);}});
  install('scrollTo',(x,y)=>{globalThis.scrollX=x;globalThis.scrollY=y;});install('addEventListener',(name,fn)=>windowEvents.set(name,fn));
  install('requestAnimationFrame',fn=>{frames.set(++frame,fn);return frame;});install('cancelAnimationFrame',id=>frames.delete(id));
  install('setTimeout',fn=>{timers.set(++timer,fn);return timer;});install('clearTimeout',id=>timers.delete(id));
  const flush=()=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();};
  const first=await import('../dist/scripts/page-navigation.js?reading-initial');first.initPageNavigation();assert.equal(history.scrollRestoration,'manual');assert.equal(history.state.reifyNavigation.scroll.y,700,'initialization does not replace an existing history offset with zero');flush();assert.equal(scrollY,700);assert.equal(anchors,0);assert.equal(writes,0);
  for(let y=710;y<810;y++){globalThis.scrollY=y;windowEvents.get('scroll')();}assert.equal(frames.size,1);flush();assert.equal(writes,0);assert.equal(history.state.reifyNavigation.scroll.y,809);assert.equal(history.state.other,'preserved');assert.deepEqual(history.state.reifyFp,{ids:['existing-fp']});
  windowEvents.get('pagehide')();assert.equal(writes,1);assert.equal(JSON.parse(storage.get('reading-pages-v1')).entries[0][1].y,809);
  globalThis.scrollY=0;const refreshed=await import('../dist/scripts/page-navigation.js?reading-refreshed');refreshed.initPageNavigation();flush();assert.equal(scrollY,809,'refresh resumes the last main-document reading position');
  const earlier={...history.state,reifyNavigation:{scope,scroll:{x:0,y:250}}};history.state=earlier;globalThis.location=new URL('https://wiki.test/article.html#earlier');windowEvents.get('popstate')({state:earlier});flush();assert.equal(scrollY,250,'Back/Forward within one article also restores its per-entry position');
  globalThis.location=new URL('https://wiki.test/article.html#native');windowEvents.get('popstate')({state:null});flush();assert.equal(scrollY,99,'a native fragment entry without a saved scroll snapshot still follows its anchor');
  globalThis.performance={getEntriesByType:()=>[{type:'navigate'}]};globalThis.location=new URL('https://wiki.test/article.html#explicit');const anchor=await import('../dist/scripts/page-navigation.js?reading-new-anchor');anchor.initPageNavigation();flush();assert.equal(scrollY,99);assert.equal(anchors,2,'a newly opened explicit anchor remains authoritative');windowEvents.get('pagehide')();
 }finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
});
