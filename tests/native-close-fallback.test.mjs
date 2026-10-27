import assert from 'node:assert/strict';
import {bindNativeClose} from '../dist/lib/native-close.js';

const saved=new Map(),events=new Map(),watchers=[];
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
class NativeWatcher extends EventTarget{
 active=true;
 constructor(){super();watchers.push(this);}
 destroy(){this.active=false;}
 close(){if(!this.active)return;this.dispatchEvent(new Event('close'));this.destroy();}
}
let panels=2,closed=0,focused=true,controller;
const key=(type,key,options={})=>{const event={key,...options,preventDefault(){this.defaultPrevented=true;},stopPropagation(){}};events.get(type)?.(event);return event;};
try{
 install('CloseWatcher',NativeWatcher);install('document',{hasFocus:()=>focused});
 install('addEventListener',(type,handler)=>events.set(type,handler));
 install('removeEventListener',(type,handler)=>{if(events.get(type)===handler)events.delete(type);});
 controller=bindNativeClose(()=>{closed++;panels--;},{active:()=>panels>0});
 key('keydown','Escape');assert.equal(closed,0,'the native browser close request gets priority over keyboard fallback');
 watchers.at(-1).close();await Promise.resolve();key('keyup','Escape');
 assert.equal(closed,1,'a native close and its keyup close only one of two panels');
 const missed=watchers.at(-1);key('keydown','Escape');key('keyup','Escape');await Promise.resolve();
 assert.equal(closed,2,'keyup closes the next panel when CloseWatcher delivers no event');
 assert(!missed.active,'a watcher that missed a native request is released');
 assert(watchers.every(watcher=>!watcher.active),'closing the final panel leaves no watcher');

 panels=1;controller.sync();key('keydown','f',{ctrlKey:true});
 key('keydown','Escape');key('keyup','Escape');assert.equal(closed,2,'Escape reserved for browser search leaves the panel open');
 key('keydown','Escape');key('keyup','Escape');await Promise.resolve();
 assert.equal(closed,3,'the next Escape still closes the panel if the restored watcher also misses its event');

 panels=1;controller.sync();key('keyup','Escape');assert.equal(closed,3,'a browser-consumed keydown cannot trigger fallback from keyup alone');
 const cancelled=key('keydown','Escape');cancelled.defaultPrevented=true;key('keyup','Escape');
 assert.equal(closed,3,'a later keyboard handler can cancel Escape without closing the panel');
 key('keydown','Escape');focused=false;key('keyup','Escape');focused=true;
 assert.equal(closed,3,'losing page focus before keyup leaves the native interface in control');
 key('keydown','Escape',{isComposing:true});key('keyup','Escape');assert.equal(closed,3,'IME input does not close panels');
 key('keydown','Escape');controller.dispose();key('keyup','Escape');assert.equal(closed,3,'disposing a pending keyboard fallback cannot close a later panel');
 console.log('Native closing wins; missed CloseWatcher events fall back once without swallowing search, cancelled keys or browser-owned Escape.');
}finally{controller?.dispose();for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
