import assert from 'node:assert/strict';

const saved=new Map(),windowEvents=new Map(),documentEvents=new Map(),closed=[],watchers=[];let mutation;
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
class Panel{
 constructor(name,layer,hidden=false){this.name=name;this.dataset={floatingLayer:String(layer)};this.hidden=hidden;this.tagName='DIV';}
 hasAttribute(){return false;}
 addEventListener(){}
 closest(){return this;}
}
class NativeWatcher extends EventTarget{
 active=true;
 constructor(){super();watchers.push(this);}
 destroy(){this.active=false;}
 close(){if(!this.active)return;this.dispatchEvent(new Event('close'));this.destroy();}
}
try{
 install('Element',Panel);install('CloseWatcher',NativeWatcher);
 install('MutationObserver',class{constructor(callback){mutation=callback;}observe(){}});
 install('document',{body:{},addEventListener:(type,fn)=>documentEvents.set(type,fn)});
 install('addEventListener',(type,fn)=>windowEvents.set(type,fn));
 const {registerFloatingPanel,unregisterFloatingPanel}=await import('../dist/scripts/floating-panels.js?native-close');
 const note=new Panel('note',85),editor=new Panel('editor',200),hidden=new Panel('hidden',300,true);
 for(const panel of [note,editor,hidden])registerFloatingPanel(panel,event=>{closed.push([panel.name,event.type]);panel.hidden=true;});
 assert.equal(watchers.length,1,'one browser close watcher represents the complete FP stack');
 const key=(type,key,options={})=>{const event={type,key,...options,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;}};windowEvents.get(type)(event);return event;};
 const find=key('keydown','f',{ctrlKey:true});
 assert(!find.defaultPrevented&&!find.stopped,'Ctrl+F retains its native browser action');
 assert.equal(watchers.filter(w=>w.active).length,0,'native search suspends the page close watcher');
 documentEvents.get('pointerdown')({target:editor});mutation();
 assert.equal(watchers.filter(w=>w.active).length,0,'clicking the FP and changing page focus does not withdraw native Escape priority');
 const escape=key('keydown','Escape');mutation();
 assert(!escape.defaultPrevented&&!escape.stopped,'Escape reaches browser chrome unchanged');
 assert.deepEqual(closed,[],'the Escape used to dismiss native search never closes an FP');
 assert.equal(watchers.filter(w=>w.active).length,0,'visibility updates cannot rearm CloseWatcher during the reserved Escape');
 key('keyup','Escape');
 assert.deepEqual(closed,[],'Escape keyup only restores future FP closing');
 assert.equal(watchers.filter(w=>w.active).length,1,'one native watcher returns after the browser close operation');
 watchers.at(-1).close();await Promise.resolve();
 assert.deepEqual(closed,[['editor','close']],'the platform close request dismisses only the highest visible panel');
 assert.equal(watchers.filter(w=>w.active).length,1,'the next panel has one fresh native close request');
 watchers[0].close();assert.equal(closed.length,1,'an obsolete watcher cannot close another panel');
 key('keydown','f',{metaKey:true});
 assert.equal(watchers.filter(w=>w.active).length,0,'Cmd+F uses the same priority');
 key('keyup','Escape');
 assert.equal(watchers.filter(w=>w.active).length,1,'Escape consumed in browser chrome needs no page keydown to restore FP closing');
 assert.equal(closed.length,1,'browser-owned Escape leaves the underlying FP open');
 watchers.at(-1).close();await Promise.resolve();
 assert.deepEqual(closed,[['editor','close'],['note','close']]);
 assert.equal(watchers.filter(w=>w.active).length,0,'no close watcher remains for hidden panels');
 hidden.hidden=false;mutation();assert.equal(watchers.filter(w=>w.active).length,1,'showing an already registered note restores platform closing');
 hidden.hidden=true;mutation();assert.equal(watchers.filter(w=>w.active).length,0,'pointer dismissal releases native close handling');
 hidden.hidden=false;mutation();unregisterFloatingPanel(hidden);
 assert.equal(watchers.filter(w=>w.active).length,0,'unregistering a viewer releases its platform handler');
 console.log('Native search keeps its Escape after page focus returns; keyup restores top-only FP closing without dismissing both');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
