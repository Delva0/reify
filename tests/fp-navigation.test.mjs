import assert from 'node:assert/strict';
import {fpHref,parseFpUrl,fpTypes} from '../src/lib/fp-links.js';
import {registerFpType,showFloatingPanels,initFpNavigation,floatingPanelState,appendFpState} from '../src/scripts/fp-navigation.js';

const descriptors=new Map(),install=(key,value)=>{descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});};
const a={type:'code',props:{file:'src/a.cpp',ranges:[{from:10,to:20}]}},b={type:'code',props:{file:'src/b.cpp',ranges:[]}},storage=new Map(),listeners=new Map(),opened=[],changes=[];
assert.deepEqual(appendFpState([a],[b]),[a,b],'opening a child FP preserves its parent');
assert.deepEqual(appendFpState([a,b],[a]),[b,a],'reopening an existing FP raises it without duplicating the state');
try{
 install('location',new URL('https://example.test/article.html?theme=light#mdx-3'));
 install('localStorage',{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)});
 storage.set('floating-panels-v1:owner/repo@commit',JSON.stringify([a,b]));
 install('document',{body:{dataset:{repositoryName:'owner/repo',commit:'commit'}},addEventListener(){},dispatchEvent:event=>changes.push(event.detail.state)});
 install('addEventListener',(name,fn)=>listeners.set(name,fn));
 install('history',{state:null,pushState(_state,_title,url){globalThis.location=new URL(url);},replaceState(_state,_title,url){globalThis.location=new URL(url);}});
 const factory=(props,{onClose,onDetach,onAttach})=>{const view={props,panel:{dataset:{},style:{}},closed:false,detach(){onDetach();},attach(){onAttach();},close(){if(!view.closed){view.closed=true;onClose();}}};opened.push(view);return view;};
 registerFpType('code',factory);initFpNavigation();assert.deepEqual(floatingPanelState(),[a,b],'refresh restores every saved panel');assert(location.search.startsWith('?theme=light&fp=!('));
 const first=opened[0],second=opened[1];second.close();assert.deepEqual(floatingPanelState(),[a]);assert(!first.closed,'closing the top panel preserves the existing lower instance');assert(location.search.includes('fp=code&file=src/a.cpp'));
 showFloatingPanels([a,b]);assert.equal(opened.length,3,'unchanged lower panel is reused');first.close();assert.deepEqual(floatingPanelState(),[b]);assert(!opened[2].closed,'closing a lower instance does not overwrite the remaining URL state');
 globalThis.location=new URL('https://example.test/article.html'+fpHref([a,b])+'#mdx-3');listeners.get('popstate')();assert.deepEqual(floatingPanelState(),[a,b],'history restores the full list');
 globalThis.location=new URL('https://example.test/article.html#mdx-3');listeners.get('popstate')();assert.equal(floatingPanelState().length,0);assert(opened.every(view=>view.closed));
 fpTypes.example={fields:['name'],parse:props=>props,validate:props=>assert.equal(typeof props.name,'string'),format:props=>props};registerFpType('example',factory);
 const future={type:'example',props:{name:'independent panel'}};
 for(const state of [[future],[a,future]]){showFloatingPanels(state);assert.deepEqual(parseFpUrl(location.href,location.href),state,'a registered future type uses the same single and multi protocol');}
 showFloatingPanels([]);assert.equal(location.search,'');assert.equal(location.hash,'#mdx-3');assert.equal(changes.at(-1).length,0);
 showFloatingPanels([a,b]);const detached=opened.at(-1),remaining=opened.at(-2);detached.detach();
 assert.deepEqual(floatingPanelState(),[a]);assert.equal(location.search,fpHref([a]));assert(!detached.closed);assert(!remaining.closed,'detaching changes URL ownership without closing either viewer');
 assert.deepEqual(JSON.parse(storage.get('floating-panels-v1:owner/repo@commit')),[a],'refresh state excludes the detached panel');
 detached.attach();assert.deepEqual(floatingPanelState(),[a,b]);assert.deepEqual(parseFpUrl(location.href,location.href),[a,b]);assert(!detached.closed,'reattaching restores the same instance and its URL configuration');
 detached.detach();assert.deepEqual(floatingPanelState(),[a]);
 showFloatingPanels([]);assert(remaining.closed);assert(!detached.closed,'URL navigation preserves the non-modal viewer');
 const detachedUrl=location.href;detached.close();assert.equal(location.href,detachedUrl,'closing a non-modal viewer does not alter unrelated URL state');
 console.log('FP state: saved multi-panel restore, independent close, instance reuse, history, future types and unrelated URL fields passed');
}finally{delete fpTypes.example;for(const [key,descriptor]of descriptors)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
