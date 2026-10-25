const branches=new WeakMap(),commits=new Set();let batching=0;

export function registerTreeBranch(button,actions){branches.set(button,actions);return ()=>branches.delete(button);}
export function commitTreeChange(commit){if(batching)commits.add(commit);else commit();}

export function setTreeBranchExpanded(button,expanded){
 const action=branches.get(button);if(action){action.setExpanded(expanded);return;}
 const children=button.closest('li')?.querySelector(':scope > .tree-children,:scope > ul');
 button.setAttribute('aria-expanded',String(expanded));
 button.querySelector('path')?.setAttribute('d',expanded?'M2 6h8':'M2 6h8M6 2v8');
 if(children)children.hidden=!expanded;
}

export function directTreeBranches(button){
 branches.get(button)?.prepareChildren?.();
 const list=button.closest('li')?.querySelector(':scope > ul,:scope > .tree-children > ul,:scope > div > ul');
 return [...(list?.children||[])].map(item=>item.querySelector(':scope > .tree-row > .tree-branch,:scope > .tree-repository,:scope > .github-file-row[aria-expanded]')).filter(Boolean);
}

export function toggleTreeBranch(button,event={}){
 if(event.button!==undefined&&event.button!==0)return;
 if(!event.ctrlKey){setTreeBranchExpanded(button,button.getAttribute('aria-expanded')!=='true');return;}
 const children=directTreeBranches(button),expand=children.some(child=>child.getAttribute('aria-expanded')!=='true');
 batching++;
 try{for(const child of children)setTreeBranchExpanded(child,expand);}
 finally{if(!--batching){const pending=[...commits];commits.clear();for(const commit of pending)commit();}}
}
