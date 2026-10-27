import {isRecord} from '../lib/data-types.js';
interface BranchActions {setExpanded(expanded: boolean): void; prepareChildren?: ()=>unknown; children?: ()=>HTMLElement[]}
type RootDisposer=(()=>void)&{refresh: ()=>void};
interface Preferences {values: Map<string,boolean>; persist: ()=>void}
const branches=new WeakMap<HTMLElement,BranchActions>(),roots=new WeakMap<HTMLElement,RootDisposer>(),preferences=new Map<string,Preferences>(),commits=new Set<()=>void>();let batching=0;
const childBranches=(list: Element | null | undefined)=>[...(list?.children||[])].map(item=>item.querySelector<HTMLElement>(':scope > .tree-row > .tree-branch,:scope > .tree-repository,:scope > .github-file-row[aria-expanded]')).filter((button): button is HTMLElement=>button!==null);

export function registerTreeBranch(button: HTMLElement,actions: BranchActions){branches.set(button,actions);return ()=>branches.delete(button);}
export function commitTreeChange(commit: ()=>void){if(batching)commits.add(commit);else commit();}
function renderBranch(button: HTMLElement,expanded: boolean){
 const children=button.closest('li')?.querySelector<HTMLElement>(':scope > .tree-children,:scope > ul');
 button.setAttribute('aria-expanded',String(expanded));button.querySelector('path')?.setAttribute('d',expanded?'M2 6h8':'M2 6h8M6 2v8');if(children)children.hidden=!expanded;
}
export function setTreeBranchExpanded(button: HTMLElement,expanded: boolean){const action=branches.get(button);if(action){action.setExpanded(expanded);return;}renderBranch(button,expanded);}
export function registerPersistentTreeBranches(root: ParentNode | null,{key='tree-branches:repository'}={}){
 if(!root)return;
 let preference=preferences.get(key);
 if(!preference){
  const values=new Map<string,boolean>();try{const stored: unknown=JSON.parse(localStorage.getItem(key)||'null');if(isRecord(stored)&&stored.version===1&&Array.isArray(stored.entries))for(const entry of stored.entries)if(Array.isArray(entry)&&typeof entry[0]==='string'&&typeof entry[1]==='boolean')values.set(entry[0],entry[1]);}catch{}
  const persist=()=>{try{localStorage.setItem(key,JSON.stringify({version:1,entries:[...values]}));}catch{}};preference={values,persist};preferences.set(key,preference);
 }
 const {values,persist}=preference;
 for(const button of root.querySelectorAll<HTMLButtonElement>('button[data-tree-key]')){
  const id=button.dataset.treeKey;if(id===undefined)continue;const expanded=values.get(id);if(expanded!==undefined)renderBranch(button,expanded);
  registerTreeBranch(button,{setExpanded(value){renderBranch(button,value);values.set(id,value);commitTreeChange(persist);}});
 }
}
export function directTreeBranches(button: HTMLElement){
 branches.get(button)?.prepareChildren?.();const children=branches.get(button)?.children;if(children)return children();
 return childBranches(button.closest('li')?.querySelector(':scope > ul,:scope > .tree-children > ul,:scope > div > ul'));
}
export function registerTreeRoot(button: HTMLElement | null,content: HTMLElement | null,{key,prepareChildren}: {key?: string; prepareChildren?: ()=>unknown}={}): RootDisposer{
 if(!button||!content)return Object.assign(()=>{},{refresh(){}});
 const existing=roots.get(button);if(existing){existing.refresh();return existing;}
 let expanded=true;try{if(key)expanded=localStorage.getItem(key)!=='false';}catch{}
 const render=(value: boolean)=>{expanded=value;button.setAttribute('aria-expanded',String(value));button.setAttribute('aria-label',(value?'收起':'展开')+(button.dataset.treeRootLabel||''));button.querySelector('path')?.setAttribute('d',value?'M2 6h8':'M2 6h8M6 2v8');content.hidden=!value;};render(expanded);
 const unregister=registerTreeBranch(button,{children:()=>childBranches(content.matches('ul')?content:content.querySelector('ul')),setExpanded(value){render(value);if(key)try{localStorage.setItem(key,String(value));}catch{}}});
 const click=async(event: MouseEvent)=>{if(event.button!==0)return;if(event.ctrlKey&&prepareChildren)try{await prepareChildren();}catch{return;}toggleTreeBranch(button,event);};button.addEventListener('click',click);
 const dispose=Object.assign(()=>{button.removeEventListener('click',click);unregister();roots.delete(button);},{refresh:()=>render(expanded)});roots.set(button,dispose);return dispose;
}
export function toggleTreeBranch(button: HTMLElement,event: {button?: number; ctrlKey?: boolean}={}){
 if(event.button!==undefined&&event.button!==0)return;
 if(!event.ctrlKey){setTreeBranchExpanded(button,button.getAttribute('aria-expanded')!=='true');return;}
 const children=directTreeBranches(button),expand=children.some(child=>child.getAttribute('aria-expanded')!=='true');batching++;
 try{for(const child of children)setTreeBranchExpanded(child,expand);}finally{if(!--batching){const pending=[...commits];commits.clear();for(const commit of pending)commit();}}
}
