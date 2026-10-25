const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function headingTreeHtml(nodes,pageHref){
 return '<ul class="tree-sections">'+nodes.map(node=>'<li><div class="tree-row">'+(node.children.length?'<button class="tree-branch" aria-label="'+escape(node.text)+'" aria-expanded="true"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8"/></svg></button>':'<span class="tree-leaf"></span>')+'<a class="tree-heading" data-tip-overflow href="'+escape((node.href.split('#')[0]===pageHref?'':node.href.split('#')[0])+'#'+node.slug)+'" data-heading="'+escape(node.slug)+'">'+escape(node.text)+'</a></div>'+(node.children.length?headingTreeHtml(node.children,pageHref):'')+'</li>').join('')+'</ul>';
}
