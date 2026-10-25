const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function headingTreeItemsHtml(nodes,pageHref){
 return nodes.map(node=>{
  const branch=node.children.length?'<button class="tree-branch" aria-label="'+escape(node.text)+'" data-tree-key="heading:'+escape(node.href)+'" aria-expanded="true"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8"/></svg></button>':'<span class="tree-leaf"></span>';
  const href=(node.href.split('#')[0]===pageHref?'':node.href.split('#')[0])+'#'+node.slug;
  const link='<a class="tree-heading" data-tip-overflow href="'+escape(href)+'" data-heading="'+escape(node.slug)+'">'+escape(node.text)+'</a>';
  return '<li><div class="tree-row">'+branch+link+'</div>'+(node.children.length?headingTreeHtml(node.children,pageHref):'')+'</li>';
 }).join('');
}
export const headingTreeHtml=(nodes,pageHref)=>'<ul class="tree-sections">'+headingTreeItemsHtml(nodes,pageHref)+'</ul>';
