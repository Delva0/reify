const isRadio=(node: HTMLElement): node is HTMLInputElement=>'type' in node&&node.type==='radio';
const focusable='a[href],area[href],button,input,select,textarea,iframe,object,embed,summary,[tabindex],[contenteditable],audio[controls],video[controls]';

// aria-modal describes the reading boundary. Keep interaction on the same
// layers without invalidating whole accessibility subtrees through inert.
export function createModalInteraction(){
 const roots=new Set<HTMLElement>();let modal: HTMLElement | undefined,lastFocus: HTMLElement | undefined,initialized=false,redirecting=false;
 const blocked=(node: EventTarget | null)=>Boolean(node&&[...roots].some(root=>root===node||root.contains?.(node as Node)));
 const candidates=()=>{
  const available=[...(document.querySelectorAll?.<HTMLElement>(focusable)||[])].filter(node=>
   !blocked(node)&&node.tabIndex>=0&&!node.matches?.(':disabled')&&!node.closest?.('[inert]')&&node.getClientRects?.().length
  );
  return available.filter(node=>{
   if(!isRadio(node)||!node.name)return true;
   const group=available.filter(other=>isRadio(other)&&other.name===node.name&&other.form===node.form);
   return node===(group.find(other=>isRadio(other)&&other.checked)||group[0]);
  }).map((node,index)=>({node,index,order:node.tabIndex||Infinity})).sort((a,b)=>a.order-b.order||a.index-b.index).map(item=>item.node);
 };
 const focus=(node: HTMLElement | undefined | null)=>node?.focus?.({preventScroll:true});
 const redirect=()=>{
  if(redirecting||!modal)return;
  redirecting=true;
  try{
   const available=candidates(),previous=lastFocus&&available.includes(lastFocus)?lastFocus:null;
   focus(previous||available.find(node=>modal===node||modal?.contains?.(node))||available[0]||modal);
  }finally{redirecting=false;}
 };
 const guard=(event: Event)=>{if(!modal||!blocked(event.target))return;event.preventDefault();event.stopImmediatePropagation();};
 const onFocus=(event: FocusEvent)=>{
  if(!modal)return;
  if(blocked(event.target)){event.stopImmediatePropagation();redirect();}
  else lastFocus=event.target as HTMLElement;
 };
 const onTab=(event: KeyboardEvent)=>{
  if(!modal||event.defaultPrevented||event.key!=='Tab'||event.ctrlKey||event.metaKey||event.altKey||event.isComposing||document.hasFocus?.()===false)return;
  const available=candidates();event.preventDefault();
  if(!available.length){focus(modal);return;}
  const current=document.activeElement,index=available.indexOf(current as HTMLElement);
  if(index>=0){focus(available[(index+(event.shiftKey?-1:1)+available.length)%available.length]);return;}
  const next=event.shiftKey?[...available].reverse().find(node=>(current?node.compareDocumentPosition(current):0)&4):available.find(node=>(current?node.compareDocumentPosition(current):0)&2);
  focus(next||available[event.shiftKey?available.length-1:0]);
 };
 const init=()=>{
  if(initialized)return;initialized=true;
  for(const type of ['pointerdown','pointerup','click','auxclick','dblclick','contextmenu','selectstart'])document.addEventListener(type,guard,true);
  document.addEventListener('focusin',onFocus,true);document.addEventListener('keydown',onTab);
 };
 const setBlocked=(node: HTMLElement,value: boolean)=>{
  if(value){if(roots.has(node))return;roots.add(node);if(node.dataset)node.dataset.floatingBlocked='';}
  else{if(!roots.delete(node))return;if(node.dataset)delete node.dataset.floatingBlocked;}
 };
 const sync=(panel: HTMLElement | undefined,affected: HTMLElement[])=>{
  modal=panel;lastFocus=panel?lastFocus:undefined;
  const next=new Set(affected);
  for(const root of roots)if(!next.has(root))setBlocked(root,false);
  for(const root of next)setBlocked(root,true);
  if(modal&&blocked(document.activeElement))redirect();
 };
 return {init,sync,blocked,release:(node: HTMLElement)=>setBlocked(node,false)};
}
