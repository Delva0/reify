import assert from 'node:assert/strict';
import test from 'node:test';
import {registerTreeBranch,toggleTreeBranch,commitTreeChange} from '../src/scripts/tree-branches.js';

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
