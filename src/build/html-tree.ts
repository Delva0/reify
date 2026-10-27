import type {DefaultTreeAdapterTypes as Tree} from 'parse5';
export type HtmlNode = Tree.Node;
export type HtmlParent = Tree.ParentNode;
export type HtmlElement = Tree.Element;
export type HtmlChild = Tree.ChildNode;
export const isElement = (node: HtmlNode): node is HtmlElement => 'tagName' in node;
export const children = (node: HtmlNode): HtmlChild[] => 'childNodes' in node ? node.childNodes : [];
export const attribute = (node: HtmlNode,name: string): HtmlElement['attrs'][number] | undefined => isElement(node) ? node.attrs.find(item=>item.name===name) : undefined;
export function setAttribute(node: HtmlNode,name: string,value: string | undefined){
 if(!isElement(node))return;
 const old=attribute(node,name);
 if(value===undefined)node.attrs=node.attrs.filter(item=>item.name!==name);
 else if(old)old.value=value;
 else node.attrs.push({name,value});
}
export const textContent = (node: HtmlNode): string => node.nodeName==='#text'&&'value' in node ? node.value : children(node).map(textContent).join('');
export function walkHtml(node: HtmlNode,visit: (node: HtmlNode)=>void){
 visit(node);
 if(attribute(node,'data-file-document'))return;
 for(const child of children(node))walkHtml(child,visit);
}
export function cloneChildren(node: HtmlChild,nodes: HtmlChild[]): HtmlChild{
 if(!('childNodes' in node))return {...node};
 return {...node,attrs:node.attrs.map(item=>({...item})),childNodes:nodes};
}
