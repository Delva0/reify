import assert from 'node:assert/strict';
import test from 'node:test';
import {fpSessionKey,validateFpSession} from '../dist/lib/fp-session.js';
import {fpHref} from '../dist/lib/fp-links.js';
import {registerFloatingPanel,unregisterFloatingPanel,floatingLayer} from '../dist/scripts/floating-panels.js';

const a={type:'code',props:{file:'parent.md',ranges:[]}},b={type:'code',props:{file:'child.cpp',ranges:[]}};

test('session validation orders parents first and isolates articles and versions',()=>{
 const parent={id:'a',state:a,modal:true,parentId:null,snapshot:{left:10}},child={id:'b',state:b,modal:false,parentId:'a',snapshot:{left:120,top:140,width:600,height:340}};
 assert.deepEqual(validateFpSession({version:2,entries:[child,parent]}).entries,[parent,child]);
 assert.notEqual(fpSessionKey('owner/repo','a','/one.html'),fpSessionKey('owner/repo','a','/two.html'));
 assert.notEqual(fpSessionKey('owner/repo','a','/one.html'),fpSessionKey('owner/repo','b','/one.html'));
 assert.throws(()=>validateFpSession({version:2,entries:[parent,parent]}),/标识/);
 assert.throws(()=>validateFpSession({version:2,entries:[{...parent,parentId:'b'},child]}),/循环/);
 assert.equal(validateFpSession({version:2,entries:[child]}).entries[0].parentId,null,'a closed parent does not invalidate a retained child');
});

test('initial session restoration preserves an independent non-modal root above an earlier modal root',async()=>{
 const saved=new Map(),install=(key,value)=>{saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
 const storage=new Map(),opened=[],c={type:'code',props:{file:'independent.cpp',ranges:[]}};
 try{
  install('location',new URL('https://example.test/stack.html'+fpHref([a])));
  install('localStorage',{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)});
  install('document',{body:{dataset:{repositoryName:'owner/repo',commit:'abc'}},querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},dispatchEvent(){}});
  install('addEventListener',()=>{});
  install('history',{state:null,replaceState(state,_title,url){this.state=state;globalThis.location=new URL(url);}});
  const key=fpSessionKey('owner/repo','abc','/stack.html');
  storage.set(key,JSON.stringify({version:2,entries:[{id:'modal-a',state:a,modal:true,parentId:null,snapshot:{}},{id:'floating-c',state:c,modal:false,parentId:null,snapshot:{}}]}));
  const module=await import('../dist/scripts/fp-navigation.js?session-independent-stack');
  module.registerFpType('code',(props,context)=>{
   const panel={dataset:{modal:String(context.restore?.modal??true)},style:{},hidden:false,tagName:'SECTION',hasAttribute:()=>false,setAttribute(){}};
   const view={panel,props,snapshot:()=>({}),close(){if(this.closed)return;this.closed=true;unregisterFloatingPanel(panel);context.onClose();}};
   registerFloatingPanel(panel,()=>view.close(),{parent:context.parentPanel,onChange:context.onStateChange});opened.push(view);return view;
  });
  module.initFpNavigation();
  assert.equal(opened.length,2);assert(floatingLayer(opened[1].panel)>floatingLayer(opened[0].panel),'restoring modal URL state must not raise A over the later non-modal C');
  assert.deepEqual(JSON.parse(storage.get(key)).entries.map(entry=>entry.id),['modal-a','floating-c']);
  for(const view of opened)view.close();await Promise.resolve();
 }finally{for(const view of opened)if(!view.closed)view.close();for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
});

test('refresh restores geometry, non-modal state and parent references while URL stays modal-only',async()=>{
 const saved=new Map(),install=(key,value)=>{saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
 const storage=new Map(),listeners=new Map(),opened=[],ready=[];
 try{
  install('location',new URL('https://example.test/article.html'));
  install('localStorage',{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)});
  install('document',{body:{dataset:{repositoryName:'owner/repo',commit:'abc'}},querySelector:()=>null,addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent:event=>{if(event.type==='fpready')ready.push(event.detail.panel);}});
  install('addEventListener',(name,fn)=>listeners.set(name,fn));
  install('history',{state:null,pushState(state,_title,url){this.state=state;globalThis.location=new URL(url);},replaceState(state,_title,url){this.state=state;globalThis.location=new URL(url);}});
  const factory=(props,context)=>{
   const view={props,context,panel:{dataset:{},style:{}},modal:context.restore?.modal??true,box:context.restore?.box||{left:0,top:0,width:500,height:300},ready:Promise.resolve(),snapshot(){return {modal:this.modal,box:this.box};},restore(snapshot){if(snapshot.modal!==undefined)this.modal=snapshot.modal;},detach(){this.modal=false;context.onDetach();},close(){context.onClose();}};
   opened.push(view);return view;
  };
  const first=await import('../dist/scripts/fp-navigation.js?session-first');first.registerFpType('code',factory);first.initFpNavigation();first.showFloatingPanels([a,b]);
  const [parent,child]=opened;assert.equal(child.context.parentPanel,parent.panel);assert.equal(child.context.parentId,parent.panel.dataset.fpSessionId);
  child.detach();child.box={left:-30,top:85,width:730,height:410};child.context.onStateChange();listeners.get('pagehide')();
  assert.equal(location.search,fpHref([a]));
  const key=fpSessionKey('owner/repo','abc','/article.html'),session=validateFpSession(JSON.parse(storage.get(key)));
  assert.equal(session.entries.length,2);assert.equal(session.entries.find(entry=>!entry.modal).snapshot.box.left,-30);
  const refreshed=await import('../dist/scripts/fp-navigation.js?session-refreshed');refreshed.registerFpType('code',factory);refreshed.initFpNavigation();
  const restoredParent=opened[2],restoredChild=opened[3];
  assert.equal(restoredChild.modal,false);assert.deepEqual(restoredChild.box,child.box);assert.equal(restoredChild.context.parentPanel,restoredParent.panel);
  assert.equal(restoredChild.panel.dataset.fpSessionId,child.panel.dataset.fpSessionId);assert.deepEqual(refreshed.floatingPanelState(),[a]);
  await Promise.resolve();assert(ready.includes(restoredParent.panel));assert(ready.includes(restoredChild.panel),'restored content announces readiness for dependent note/editor restoration');
  refreshed.showFloatingPanels([a,b]);assert.equal(opened.length,5,'URL reconciliation creates a new modal occurrence and retains the non-modal instance');assert.equal(restoredChild.modal,false);opened.at(-1).close();
  assert.equal(restoredParent.panel.style.zIndex,undefined,'navigation never owns the layer implementation');
  restoredChild.close();listeners.get('beforeunload')();assert.equal(validateFpSession(JSON.parse(storage.get(key))).entries.length,1,'closed viewers are not restored');
  restoredParent.detach();restoredParent.box={left:35,top:110,width:520,height:280};listeners.get('pagehide')();assert.equal(location.search,'');
  const nonModalRefresh=await import('../dist/scripts/fp-navigation.js?session-non-modal-only');nonModalRefresh.registerFpType('code',factory);nonModalRefresh.initFpNavigation();
  const only=opened.at(-1);assert.equal(only.modal,false);assert.deepEqual(only.box,restoredParent.box);assert.deepEqual(nonModalRefresh.floatingPanelState(),[],'a session without modal URL parameters restores non-modal windows without promoting them');assert.equal(location.search,'');
  only.close();
  const c={type:'code',props:{file:'grandchild.cpp',ranges:[]}};nonModalRefresh.showFloatingPanels([a,b,c]);
  const grandchild=opened.at(-1),grandparent=opened.at(-3);grandchild.detach();nonModalRefresh.showFloatingPanels([a]);
  const retained=validateFpSession(JSON.parse(storage.get(key))).entries.find(entry=>entry.state.props.file==='grandchild.cpp');
  assert.equal(retained.parentId,grandparent.panel.dataset.fpSessionId,'closing an intermediate URL parent reparents a retained non-modal child to its surviving ancestor');
  nonModalRefresh.showFloatingPanels([]);grandchild.close();
  globalThis.location=new URL('https://example.test/other.html');
  const other=await import('../dist/scripts/fp-navigation.js?session-other');other.registerFpType('code',factory);other.initFpNavigation();assert.deepEqual(other.floatingPanelState(),[],'another article does not inherit this article session');
 }finally{for(const [key,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
});
