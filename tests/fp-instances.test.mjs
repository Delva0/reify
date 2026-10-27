import assert from 'node:assert/strict';
import {fpHref} from '../dist/lib/fp-links.js';
import {fpSessionKey,fpReadingLimit,rememberFpInstance,validateFpSession} from '../dist/lib/fp-session.js';

const a={type:'code',props:{file:'same.cpp',ranges:[]}},saved=new Map(),storage=new Map(),listeners=new Map(),frames=new Map(),opened=[];let frame=0,snapshots=0,writes=0;
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
const flush=()=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();};
try{
 install('location',new URL('https://wiki.test/article.html#heading'));
 install('localStorage',{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{writes++;storage.set(key,value);}});
 install('document',{body:{dataset:{repositoryName:'owner/repo',commit:'abc'}},querySelector:()=>null,addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent:event=>listeners.get(event.type)?.(event)});
 install('addEventListener',(name,fn)=>listeners.set(name,fn));
 install('requestAnimationFrame',fn=>{frames.set(++frame,fn);return frame;});install('cancelAnimationFrame',id=>frames.delete(id));
 const history={state:{unrelated:'preserved'},records:[],at:0,
  pushState(state,_title,url){this.records.splice(++this.at);this.records.push({state:structuredClone(state),url:String(url)});this.state=structuredClone(state);globalThis.location=new URL(url);},
  replaceState(state,_title,url){this.records[this.at]={state:structuredClone(state),url:String(url)};this.state=structuredClone(state);globalThis.location=new URL(url);},
  go(delta){this.at+=delta;const record=this.records[this.at];this.state=structuredClone(record.state);globalThis.location=new URL(record.url);listeners.get('popstate')({state:this.state});},
 };
 history.records.push({state:structuredClone(history.state),url:location.href});install('history',history);
 const factory=(props,context)=>{
  const restored=structuredClone(context.restore||{}),view={props,context,panel:{dataset:{},style:{}},reading:restored,closed:false,modal:restored.modal??true,
   snapshot(){snapshots++;return {...this.reading,box:this.box||{left:11,top:12,width:500,height:300},modal:this.modal};},
   detach(){this.modal=false;context.onDetach();},
   close(){if(this.closed)return;this.closed=true;context.onClose(this.snapshot());},
  };opened.push(view);return view;
 };
 const module=await import('../dist/scripts/fp-navigation.js?independent-instances');module.registerFpType('code',factory);module.initFpNavigation();
 module.openFloatingPanels([a]);const first=opened.at(-1),firstId=first.panel.dataset.fpSessionId;first.reading={scroll:[{top:20,left:3}],documentMode:'source'};first.context.onStateChange();flush();
 const child={type:'code',props:{block:'stable-child'}},link={dataset:{},href:fpHref([child]),getAttribute(){return this.href;},removeAttribute(){},closest:()=>first.panel};
 module.enhanceFloatingLinks({querySelectorAll:()=>[link]});
 assert.equal(link.dataset.fpTarget,fpHref([child]),'ordinary clicks retain a child-only target');
 assert.equal(new URL(link.href).search,fpHref([a,child]),'native new-tab links reconstruct the parent that owns the code definition');
 module.enhanceFloatingLinks({querySelectorAll:()=>[link]});assert.equal(new URL(link.href).search,fpHref([a,child]),'repeated hydration does not duplicate ancestors');
 const origin={closest:()=>first.panel};module.openFloatingPanels([a],{origin});const second=opened.at(-1),secondId=second.panel.dataset.fpSessionId;
 assert.notEqual(secondId,firstId);assert.equal(second.context.parentPanel,first.panel);assert.equal(second.context.origin,origin);assert(!first.closed);assert.deepEqual(module.floatingPanelState(),[a,a]);
 assert.equal(second.context.restore.scroll[0].top,20,'a new occurrence can start from the most recent reading without sharing the old instance');
 second.reading={scroll:[{top:80,left:9}],documentMode:'rendered',documents:[{page:2,top:80,left:9}]};second.context.onStateChange();flush();
 assert.deepEqual(history.state.reifyFp.ids,[firstId,secondId]);assert.equal(history.state.unrelated,'preserved');assert.equal(location.search,fpHref([a,a]));
 history.go(-1);assert(second.closed);assert(!first.closed);assert.deepEqual(module.floatingPanelState(),[a]);
 const key=fpSessionKey('owner/repo','abc','/article.html'),session=JSON.parse(storage.get(key));
 assert.equal(session.readings[0].snapshot.scroll[0].top,20,'the shared target cache now reflects the surviving A instance');
 assert.equal(session.archive.find(entry=>entry.id===secondId).snapshot.scroll[0].top,80,'B keeps a separate instance snapshot after Back closes it');
 history.go(1);const forward=opened.at(-1);assert.equal(forward.panel.dataset.fpSessionId,secondId);assert.equal(forward.context.restore.scroll[0].top,80,'Forward restores B by identity rather than using A’s state-key reading');assert.equal(forward.context.restore.documents[0].page,2);assert.equal(forward.context.parentPanel,first.panel);assert(!first.closed);
 assert.equal(history.records.length,3,'Back/Forward reconciliation does not append browser history');
 history.go(-2);assert.deepEqual(module.floatingPanelState(),[]);history.go(2);const restoredPair=opened.slice(-2);assert.equal(restoredPair[0].panel.dataset.fpSessionId,firstId);assert.equal(restoredPair[1].panel.dataset.fpSessionId,secondId);assert.equal(restoredPair[1].context.parentPanel,restoredPair[0].panel,'restoring an entire archived stack preserves parent references before entries become live');assert.equal(restoredPair[0].context.restore.scroll[0].top,20);assert.equal(restoredPair[1].context.restore.scroll[0].top,80);
 module.showFloatingPanels([]);module.openFloatingPanels([a]);const floating=opened.at(-1);flush();
 const beforeDrag={snapshots,writes};document.dispatchEvent({type:'paneldragstart',target:floating.panel});floating.detach();
 assert.equal(location.search,'','detaching updates URL ownership during the drag');
 for(let i=0;i<8;i++){floating.context.onStateChange();flush();}
 assert.deepEqual({snapshots,writes},beforeDrag,'dragging neither measures other panels nor serializes session storage');
 floating.box={left:140,top:90,width:500,height:300};document.dispatchEvent({type:'paneldragend',target:floating.panel});flush();
 assert.equal(writes,beforeDrag.writes+1,'release persists the settled session once');assert.equal(snapshots,beforeDrag.snapshots+1);
 assert.deepEqual(JSON.parse(storage.get(key)).entries[0].snapshot.box,floating.box);
 document.dispatchEvent({type:'paneldragstart',target:floating.panel});floating.box.left=155;listeners.get('pagehide')();
 assert.equal(JSON.parse(storage.get(key)).entries[0].snapshot.box.left,155,'leaving the page during a drag still saves its current geometry');
 document.dispatchEvent({type:'paneldragend',target:floating.panel});flush();
 module.openFloatingPanels([a]);const modal=opened.at(-1);
 assert(!floating.closed);assert.equal(floating.modal,false);assert.notEqual(modal.panel.dataset.fpSessionId,floating.panel.dataset.fpSessionId);assert.deepEqual(module.floatingPanelState(),[a]);
 const count=opened.length;module.showFloatingPanels([a]);assert.equal(opened.length,count,'URL reconciliation may reuse its matching modal instance');module.showFloatingPanels([a,a]);assert.equal(opened.length,count+1);assert.equal(floating.modal,false,'same-target URL states never promote the retained non-modal instance');
 listeners.get('pagehide')();const live=validateFpSession(JSON.parse(storage.get(key)));assert.equal(live.entries.length,3);assert.equal(new Set(live.entries.map(entry=>entry.id)).size,3);
 module.showFloatingPanels([]);floating.close();flush();
 const cache=new Map();for(let i=0;i<fpReadingLimit+3;i++)rememberFpInstance(cache,{id:'archive-'+i,state:a,modal:true,parentId:null},{scroll:[{top:i,left:0}]});
 assert.equal(cache.size,fpReadingLimit);assert(!cache.has('archive-0'));rememberFpInstance(cache,{id:'archive-4',state:a,modal:true,parentId:null},{box:{left:1}});assert.equal(cache.get('archive-4').snapshot.scroll[0].top,4,'a partial loading snapshot does not erase an archived reading');
 console.log('Every link opens a distinct FP; same-target modal/non-modal windows, history IDs and bounded archived readings remain independent.');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
