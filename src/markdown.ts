import type {Root,RootContent,Properties} from 'hast';
import type {MdxJsxFlowElement,MdxJsxTextElement} from 'mdast-util-mdx-jsx';
import type {Plugin} from 'unified';
import type {RootContent as MdastContent} from 'mdast';
import type {} from '@astrojs/markdown-remark';
type MarkdownNode=Root | RootContent | MdastContent | MdxJsxFlowElement | MdxJsxTextElement;
interface ExactHeading {depth: number; slug: string; text: string}
const text=(node: MarkdownNode): string=>node.type==='text'?node.value:'children' in node?node.children.map(child=>text(child)).join(''):'';
function isJsx(node: MarkdownNode): node is MdxJsxFlowElement | MdxJsxTextElement{return node.type==='mdxJsxFlowElement'||node.type==='mdxJsxTextElement';}
export const exactHeadings: Plugin<[],Root>=()=> (tree,file)=>{
 const headings: ExactHeading[]=[];
 const visit=(node: MarkdownNode)=>{
  const tag=node.type==='element'?node.tagName:isJsx(node)?node.name:undefined;
  if(tag&&/^h[1-6]$/.test(tag)){
   const declared=isJsx(node)?node.attributes.find(attr=>'name' in attr&&attr.name==='id'):undefined,id=declared&&'value' in declared&&typeof declared.value==='string'?declared.value:'mdx-'+(headings.length+1),title=text(node);headings.push({depth:Number(tag[1]),slug:id,text:title});
   if(node.type==='element'){node.properties||={};node.properties.id=id;node.properties['data-exact-heading']=title;}
   else if(isJsx(node)){node.attributes=node.attributes.filter(attr=>!('name' in attr)||!['id','data-exact-heading'].includes(attr.name));node.attributes.push(...Object.entries({id,'data-exact-heading':title}).map(([name,value])=>({type:'mdxJsxAttribute' as const,name,value})));}
  }
  if('children' in node)for(const child of node.children)visit(child);
 };visit(tree);file.data.astro||={frontmatter:{}};file.data.astro.frontmatter||={};file.data.astro.frontmatter.exactHeadings=headings;
};
export const sourceLocations: Plugin<[],Root>=()=>tree=>{
 const visit=(node: MarkdownNode)=>{
  const p=node.position;
  if(p?.start&&p.end){const props={'data-mdx-line':String(p.start.line),'data-mdx-column':String(p.start.column),'data-mdx-end-line':String(p.end.line),'data-mdx-end-column':String(p.end.column)};
   if(node.type==='element'&&/^(h[1-6]|p|li|pre|table|blockquote|figure|img)$/.test(node.tagName)){node.properties||={};Object.assign(node.properties,props);}
   else if(isJsx(node)&&node.name)for(const [name,value]of Object.entries(props))node.attributes.push({type:'mdxJsxAttribute',name,value});
  }
  if('children' in node)for(const child of node.children)visit(child);
 };visit(tree);
};
export const sourceProps=(props: Properties)=>Object.fromEntries(Object.entries(props).filter(([name])=>name.startsWith('data-mdx-')));
