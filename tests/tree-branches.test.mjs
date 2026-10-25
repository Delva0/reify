import assert from 'node:assert/strict';
import test from 'node:test';
import {registerTreeBranch,registerTreeRoot,toggleTreeBranch,commitTreeChange} from '../src/scripts/tree-branches.js';

function folder(name,expanded=false,children=[]){
 const list={children,hidden:!expanded},path={value:expanded?'M2 6h8':'M2 6h8M6 2v8',setAttribute(_name,value){this.value=value;}};
 const button={name,expanded:String(expanded),closest:()=>item,getAttribute(){return this.expanded;},setAttribute(_name,value){this.expanded=value;},querySelector:()=>path};
 const item={button,list,querySelector(selector){return selector.includes('.tree-row')?button:list;}};
 return item;
}
const leaf=()=>({querySelector:()=>null});
const expanded=item=>item.button.getAttribute('aria-expanded')==='true';

test('Ctrl+click toggles only direct child folders and keeps the current node and deeper state',()=>{
 const grandchild=folder('grandchild',true),first=folder('first',true,[grandchild]),second=folder('second',false),parent=folder('parent',true,[first,leaf(),second]);
 toggleTreeBranch(parent.button,{ctrlKey:true,button:0});
 assert(expanded(parent));assert(expanded(first));assert(expanded(second));assert(expanded(grandchild));
 assert(!first.list.hidden&&!second.list.hidden);
 toggleTreeBranch(parent.button,{ctrlKey:true,button:0});
 assert(expanded(parent));assert(!expanded(first));assert(!expanded(second));assert(expanded(grandchild),'collapsing a direct folder does not erase its descendant state');
 assert(first.list.hidden&&second.list.hidden);assert.equal(first.button.querySelector().value,'M2 6h8M6 2v8');
 toggleTreeBranch(parent.button,{button:0});assert(!expanded(parent),'ordinary clicks still toggle the current branch');
 assert(expanded(grandchild));
});

test('file folders reuse their lazy in-memory renderer and batch persistence once',()=>{
 let prepares=0,saves=0;const paths=new Set(['a','a/deep']),deep=folder('deep',true),a=folder('a',true,[deep]),b=folder('b',false),parent=folder('parent',false);
 const persist=()=>saves++;
 const bind=item=>registerTreeBranch(item.button,{setExpanded(value){item.button.expanded=String(value);item.list.hidden=!value;if(value)paths.add(item.button.name);else paths.delete(item.button.name);commitTreeChange(persist);}});
 bind(a);bind(b);
 registerTreeBranch(parent.button,{prepareChildren(){if(!prepares++){parent.list.children=[a,leaf(),b];}},setExpanded(value){parent.button.expanded=String(value);parent.list.hidden=!value;commitTreeChange(persist);}});
 toggleTreeBranch(parent.button,{ctrlKey:true,button:0});
 assert.equal(saves,1,'one shortcut is one persistence transaction');assert(!expanded(parent),'preparing lazy children does not toggle their parent');
 assert(expanded(a)&&expanded(b)&&expanded(deep));assert(paths.has('a/deep'));
 toggleTreeBranch(parent.button,{ctrlKey:true,button:0});
 assert.equal(saves,2);assert(!expanded(a)&&!expanded(b));assert(paths.has('a/deep'),'deeper expansion remains in the existing file-browser state');
 assert(!paths.has('a')&&!paths.has('b'));
});

test('Ctrl+click with no child folders is a no-op and non-left clicks are ignored',()=>{
 const noFolders=folder('parent',true,[leaf(),leaf()]);toggleTreeBranch(noFolders.button,{ctrlKey:true,button:0});assert(expanded(noFolders));
 const child=folder('child',false),parent=folder('parent',true,[child]);toggleTreeBranch(parent.button,{ctrlKey:true,button:2});assert(!expanded(child));
 toggleTreeBranch(parent.button,{ctrlKey:false,button:2});assert(expanded(parent));
});

test('tree roots share folder toggles, restore collapsed state and prepare lazy direct children',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),saved=new Map([['files-root','false']]);
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)}});
 const attributes=new Map(),listeners=new Map(),path={setAttribute(){}};
 const button={dataset:{treeRootLabel:'文件'},getAttribute:key=>attributes.get(key),setAttribute:(key,value)=>attributes.set(key,value),querySelector:()=>path,addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type),closest:()=>null};
 const grandchild=folder('deep',true),first=folder('a',true,[grandchild]),second=folder('b',false),list={children:[first,leaf(),second]};let ready=false,prepares=0;
 const content={hidden:false,matches:()=>false,querySelector:()=>ready?list:null};
 try{
  const dispose=registerTreeRoot(button,content,{key:'files-root',prepareChildren:async()=>{prepares++;await Promise.resolve();ready=true;}});
  assert(content.hidden);assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(button.getAttribute('aria-label'),'展开文件');
  assert.equal(registerTreeRoot(button,content),dispose,'refresh does not add a second click binding');
  content.hidden=false;registerTreeRoot(button,content);assert(content.hidden,'incremental DOM updates reapply the existing root state');
  await listeners.get('click')({button:0});assert(!content.hidden);assert.equal(saved.get('files-root'),'true');
  await listeners.get('click')({button:0,ctrlKey:true});assert.equal(prepares,1);assert(expanded(first)&&expanded(second)&&expanded(grandchild));
  await listeners.get('click')({button:0,ctrlKey:true});assert(!expanded(first)&&!expanded(second));assert(expanded(grandchild));assert(!content.hidden,'Ctrl+click keeps the root itself expanded');
  await listeners.get('click')({button:0});assert(content.hidden);assert.equal(saved.get('files-root'),'false');
  dispose();assert.equal(listeners.size,0);
 }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;}
});
