const isElementNode=(node:Node):node is Element=>node.nodeType===1;
const key=(node: Node)=>{
 if(!isElementNode(node))return null;
 if(node.id)return 'id:'+node.id;
 if(node.hasAttribute('data-header-identity'))return 'header:identity';
 for(const name of ['symmetric-button','tree-toggle','version-picker','github-files-toggle','reader-annotation-control','theme-toggle','tree-root'])if(node.classList.contains(name))return name;
 const repository=node.matches('li')?node.querySelector(':scope > .tree-repository'):node.matches('.tree-repository')?node:null;
 if(repository)return 'repo:'+repository.getAttribute('aria-label');
 const heading=node.matches('li')?node.querySelector(':scope > .tree-row > a[data-heading]'):node.matches('a[data-heading]')?node:null;
 if(heading)return 'heading:'+heading.getAttribute('href');
 return null;
};
export interface PatchOptions {onRemove?(node: Node): void; preserve?(node: Node): boolean}
export function patchChildren(target: Element,source: Element,{onRemove=()=>{},preserve=()=>false}: PatchOptions={}){
 const original=[...target.childNodes],keyed=new Map<string,ChildNode>(),used=new Set<Node>();for(const node of original){const id=key(node);if(id)keyed.set(id,node);}let cursor=target.firstChild;
 for(const incoming of source.childNodes){
  const id=key(incoming),candidate=id?keyed.get(id):cursor&&!key(cursor)?cursor:null;
  const same=candidate&&!used.has(candidate)&&candidate.nodeType===incoming.nodeType&&candidate.nodeName===incoming.nodeName;
  const node=same?candidate:target.ownerDocument.importNode(incoming,true);used.add(node);
  if(node!==cursor)target.insertBefore(node,cursor);
  if(same&&!preserve(node)&&!node.isEqualNode(incoming)){
   if(isElementNode(node)&&isElementNode(incoming)){
    for(const attribute of [...node.attributes])if(!incoming.hasAttribute(attribute.name))node.removeAttribute(attribute.name);
    for(const attribute of incoming.attributes)if(node.getAttribute(attribute.name)!==attribute.value)node.setAttribute(attribute.name,attribute.value);
    patchChildren(node,incoming,{onRemove,preserve});
   }else if(node.nodeValue!==incoming.nodeValue)node.nodeValue=incoming.nodeValue;
  }
  cursor=node.nextSibling;
 }
 for(const node of original)if(!used.has(node)&&node.parentNode===target){onRemove(node);node.remove();}
}
export function patchTree(target: Element,source: Element,options?: PatchOptions){
 const branches=new Map([...target.querySelectorAll('.tree-repository,.tree-branch[aria-expanded]')].map(button=>[button,button.getAttribute('aria-expanded')||'false']));
 patchChildren(target,source,options);
 for(const [button,expanded]of branches){
  if(!target.contains(button))continue;button.setAttribute('aria-expanded',expanded);
  const children=button.hasAttribute('data-tree-root-toggle')?target.querySelector<HTMLElement>('#'+button.getAttribute('aria-controls')):button.closest('li')?.querySelector<HTMLElement>(':scope > .tree-children,:scope > .tree-sections');if(children)children.hidden=expanded!=='true';
  button.querySelector('path')?.setAttribute('d',expanded==='true'?'M2 6h8':'M2 6h8M6 2v8');
 }
}
