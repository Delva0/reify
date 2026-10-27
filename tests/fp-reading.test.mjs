import assert from 'node:assert/strict';
import test from 'node:test';
import {fpHref,fpTypes} from '../dist/lib/fp-links.js';
import {readingSnapshot,rememberFpReading,fpReadingLimit,fpSessionKey} from '../dist/lib/fp-session.js';

const a={type:'code',props:{file:'a.cpp',ranges:[{from:10,to:20}]}};
test('reading cache is bounded, records source/render state and excludes window geometry',()=>{
 const cache=new Map(),reading={wrap:true,documentWrap:false,documentMode:'rendered',documents:[{page:2,top:1440,left:85}],scroll:[{top:900,left:40}],modal:false,box:{left:100,top:100,width:600,height:400}};
 assert.deepEqual(readingSnapshot(reading),{wrap:true,documentWrap:false,documentMode:'rendered',documents:reading.documents,scroll:reading.scroll});
 for(let i=0;i<fpReadingLimit+4;i++)rememberFpReading(cache,{type:'code',props:{file:i+'.cpp',ranges:[]}},reading);
 assert.equal(cache.size,fpReadingLimit);assert(!cache.has(fpHref([{type:'code',props:{file:'0.cpp',ranges:[]}}])));
 rememberFpReading(cache,a,reading);rememberFpReading(cache,a,{box:reading.box});assert.equal(cache.get(fpHref([a])).snapshot.scroll[0].top,900,'loading-only window snapshots never overwrite previous reading');
});

test('close, history reopening and refresh retain the latest reading without synchronous scroll writes',async()=>{
 const saved=new Map(),install=(key,value)=>{saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
 const storage=new Map(),listeners=new Map(),opened=[],frames=new Map();let writes=0,frame=0;
 try{
  install('location',new URL('https://wiki.test/article.html'));
  install('localStorage',{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{++writes;storage.set(key,value);}});
  install('document',{body:{dataset:{repositoryName:'owner/repo',commit:'abc'}},querySelector:()=>null,addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent(){}});
  install('addEventListener',(name,fn)=>listeners.set(name,fn));
  install('requestAnimationFrame',fn=>{frames.set(++frame,fn);return frame;});install('cancelAnimationFrame',id=>frames.delete(id));
  install('history',{state:null,pushState(state,_title,url){this.state=state;globalThis.location=new URL(url);},replaceState(state,_title,url){this.state=state;globalThis.location=new URL(url);}});
  const factory=(props,context)=>{
   const view={props,context,panel:{dataset:{},style:{}},reading:{...context.restore},snapshot(){return {box:{left:1,top:2,width:500,height:300},...this.reading};},close(){context.onClose(this.snapshot());}};opened.push(view);return view;
  };
  const module=await import('../dist/scripts/fp-navigation.js?reading-latest');module.registerFpType('code',factory);module.initFpNavigation();module.showFloatingPanels([a]);
  const first=opened.at(-1);first.reading={wrap:true,documentWrap:false,documentMode:'rendered',documents:[{page:2,top:1440,left:85}],scroll:[{top:900,left:40},{top:0,left:0},{top:1440,left:85}]};
  const before=writes;for(let i=0;i<30;i++)first.context.onStateChange();assert.equal(writes,before);assert.equal(frames.size,1);
  for(const fn of frames.values())fn();frames.clear();assert.equal(writes,before+1,'all scroll updates share one frame persistence pass');
  first.reading.scroll[0].top=955;first.close();
  const key=fpSessionKey('owner/repo','abc','/article.html');assert.equal(JSON.parse(storage.get(key)).entries.length,0);assert.equal(JSON.parse(storage.get(key)).readings[0].snapshot.scroll[0].top,955,'close captures the final position even before another animation frame');
  globalThis.location=new URL('https://wiki.test/article.html'+fpHref([a]));listeners.get('popstate')();
  const reopened=opened.at(-1);assert.equal(reopened.context.restore.scroll[0].top,955);assert.equal(reopened.context.restore.documents[0].page,2);assert.equal(reopened.context.restore.documentWrap,false);assert.equal(reopened.context.restore.box,undefined,'closed reading cache does not override new window placement');
  reopened.close();
  const session=JSON.parse(storage.get(key));session.entries=[{id:'saved-a',state:a,modal:true,parentId:null,snapshot:{scroll:[{top:333,left:7}],documentMode:'source'}}];storage.set(key,JSON.stringify(session));
  const refreshed=await import('../dist/scripts/fp-navigation.js?reading-active-priority');refreshed.registerFpType('code',factory);refreshed.initFpNavigation();assert.equal(opened.at(-1).context.restore.scroll[0].top,333,'live session snapshot takes priority over an older reading cache');opened.at(-1).close();
  fpTypes.readingPage={fields:['href'],parse:props=>props,validate:props=>assert.equal(typeof props.href,'string'),format:props=>props};module.registerFpType('readingPage',factory);
  const page={type:'readingPage',props:{href:'chapter.html'}};module.showFloatingPanels([page]);const pageView=opened.at(-1);pageView.reading={documentMode:'rendered',documents:[{page:3,top:800,left:0}],scroll:[{top:800,left:0}]};pageView.close();module.showFloatingPanels([page]);assert.equal(opened.at(-1).context.restore.documents[0].page,3,'future page FP types reuse the same reading cache');opened.at(-1).close();
 }finally{delete fpTypes.readingPage;for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
});
