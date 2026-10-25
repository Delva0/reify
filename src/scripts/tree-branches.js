const branches=new WeakMap(),roots=new WeakMap(),preferences=new Map(),commits=new Set();let batching=0;
const childBranches=list=>[...(list?.children||[])].map(item=>item.querySelector(':scope > .tree-row > .tree-branch,:scope > .tree-repository,:scope > .github-file-row[aria-expanded]')).filter(Boolean);

export function registerTreeBranch(button,actions){branches.set(button,actions);return ()=>branches.delete(button);}
export function commitTreeChange(commit){if(batching)commits.add(commit);else commit();}

function renderBranch(button,expanded){
 const children=button.closest('li')?.querySelector(':scope > .tree-children,:scope > ul');
 button.setAttribute('aria-expanded',String(expanded));
 button.querySelector('path')?.setAttribute('d',expanded?'M2 6h8':'M2 6h8M6 2v8');
 if(children)children.hidden=!expanded;
}
export function setTreeBranchExpanded(button,expanded){
 const action=branches.get(button);if(action){action.setExpanded(expanded);return;}renderBranch(button,expanded);
}

export function registerPersistentTreeBranches(root,{key='tree-branches:repository'}={}){
 if(!root)return;
 if(!preferences.has(key)){
  const values=new Map();try{const stored=JSON.parse(localStorage.getItem(key)||'null');if(stored?.version===1&&Array.isArray(stored.entries))for(const entry of stored.entries)if(Array.isArray(entry)&&typeof entry[0]==='string'&&typeof entry[1]==='boolean')values.set(entry[0],entry[1]);}catch{}
  const persist=()=>{try{localStorage.setItem(key,JSON.stringify({version:1,entries:[...values]}));}catch{}};
  preferences.set(key,{values,persist});
 }
 const {values,persist}=preferences.get(key);
 for(const button of root.querySelectorAll('button[data-tree-key]')){
  const id=button.dataset.treeKey;
  if(values.has(id))renderBranch(button,values.get(id));
  registerTreeBranch(button,{setExpanded(value){renderBranch(button,value);values.set(id,value);commitTreeChange(persist);}});
 }
}

export function directTreeBranches(button){
 branches.get(button)?.prepareChildren?.();
 const children=branches.get(button)?.children;if(children)return children();
 const list=button.closest('li')?.querySelector(':scope > ul,:scope > .tree-children > ul,:scope > div > ul');
 return childBranches(list);
}

export function registerTreeRoot(button,content,{key,prepareChildren}={}){
 if(!button||!content)return ()=>{};
 if(roots.has(button)){const existing=roots.get(button);existing.refresh();return existing;}
 let expanded=true;try{if(key)expanded=localStorage.getItem(key)!=='false';}catch{}
 const render=value=>{expanded=value;button.setAttribute('aria-expanded',String(value));button.setAttribute('aria-label',(value?'收起':'展开')+button.dataset.treeRootLabel);button.querySelector('path')?.setAttribute('d',value?'M2 6h8':'M2 6h8M6 2v8');content.hidden=!value;};
 render(expanded);
 const unregister=registerTreeBranch(button,{children:()=>childBranches(content.matches('ul')?content:content.querySelector('ul')),setExpanded(value){render(value);if(key)try{localStorage.setItem(key,String(value));}catch{}}});
 const click=async event=>{if(event.button!==0)return;if(event.ctrlKey&&prepareChildren)try{await prepareChildren();}catch{return;}toggleTreeBranch(button,event);};
 button.addEventListener('click',click);
 const dispose=()=>{button.removeEventListener('click',click);unregister();roots.delete(button);};dispose.refresh=()=>render(expanded);roots.set(button,dispose);return dispose;
}

export function toggleTreeBranch(button,event={}){
 if(event.button!==undefined&&event.button!==0)return;
 if(!event.ctrlKey){setTreeBranchExpanded(button,button.getAttribute('aria-expanded')!=='true');return;}
 const children=directTreeBranches(button),expand=children.some(child=>child.getAttribute('aria-expanded')!=='true');
 batching++;
 try{for(const child of children)setTreeBranchExpanded(child,expand);}
 finally{if(!--batching){const pending=[...commits];commits.clear();for(const commit of pending)commit();}}
}
