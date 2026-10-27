import assert from 'node:assert/strict';
import vm from 'node:vm';
import {sidebarBootstrap,sidebarDefinitions} from '../dist/lib/sidebar-state.js';
import {initSidebar} from '../dist/scripts/sidebars.js';
const element=()=>{
 const attributes=new Map(),listeners=new Map(),classes=new Set();
 return {dataset:{},focusCount:0,setAttribute:(key,value)=>attributes.set(key,value),getAttribute:key=>attributes.get(key)??null,hasAttribute:key=>attributes.has(key),addEventListener:(type,callback)=>listeners.set(type,callback),dispatch(type,event={}){listeners.get(type)?.(event);},focus(){this.focusCount++;},classList:{contains:value=>classes.has(value),remove:value=>classes.delete(value),toggle(value){if(classes.has(value)){classes.delete(value);return false;}classes.add(value);return true;}}};
};
const root=element(),nodes=new Map(),values=new Map([['tree-collapsed','true'],['github-files-collapsed','true']]),media=[];
for(const definition of Object.values(sidebarDefinitions)){nodes.set(definition.panel,element());nodes.set(definition.toggle,element());}
const storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},document={documentElement:root,querySelector:selector=>nodes.get(selector)};
vm.runInNewContext(sidebarBootstrap,{document,localStorage:storage});
assert.equal(root.getAttribute('data-tree-collapsed'),'true');assert.equal(root.getAttribute('data-files-collapsed'),'true','both preferences exist before deferred client modules initialize');
globalThis.document=document;globalThis.localStorage=storage;globalThis.matchMedia=()=>{const item={matches:true,addEventListener(type,callback){this.change=callback;}};media.push(item);return item;};
const visible=[];initSidebar('repository');initSidebar('files',value=>visible.push(value));
const left=nodes.get('.tree-toggle'),right=nodes.get('.github-files-toggle'),files=nodes.get('.github-files');
assert.equal(left.getAttribute('aria-expanded'),'false');assert.equal(right.getAttribute('aria-expanded'),'false');assert.deepEqual(visible,[false]);
 const mediaCount=media.length;assert.equal(initSidebar('files').panel,files);assert.equal(media.length,mediaCount,'refreshing an unchanged sidebar reuses its controller and global media listener');
right.dispatch('click');assert.equal(root.getAttribute('data-files-collapsed'),'false');assert.equal(root.getAttribute('data-tree-collapsed'),'true');assert.equal(values.get('github-files-collapsed'),'false');assert.equal(right.getAttribute('aria-label'),'收起文件列表');assert.equal(visible.at(-1),true);
media[1].matches=false;media[1].change();assert.equal(visible.at(-1),false,'narrow layout starts with a closed overlay');
right.dispatch('click');assert(files.classList.contains('is-open'));assert.equal(visible.at(-1),true);assert.equal(values.get('github-files-collapsed'),'false','overlay visibility does not overwrite desktop preference');
files.dispatch('keydown',{key:'Escape'});assert(!files.classList.contains('is-open'));assert.equal(visible.at(-1),false);assert.equal(right.focusCount,1);
media[1].matches=true;media[1].change();assert.equal(visible.at(-1),true,'wide layout restores its persisted visibility');
right.dispatch('click');const refreshed=element();vm.runInNewContext(sidebarBootstrap,{document:{documentElement:refreshed},localStorage:storage});assert.equal(refreshed.getAttribute('data-files-collapsed'),'true','closing applies to the next document before client initialization');
const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};assert.doesNotThrow(()=>vm.runInNewContext(sidebarBootstrap,{document,localStorage:denied}));globalThis.localStorage=denied;assert.doesNotThrow(()=>left.dispatch('click'));
delete globalThis.document;delete globalThis.localStorage;delete globalThis.matchMedia;
console.log('Sidebar state: pre-paint restoration, independent toggles, persistence, responsive overlays, keyboard focus, and unavailable storage passed');
