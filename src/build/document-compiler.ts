import {compile,run} from '@mdx-js/mdx';
import type {CompileOptions,RunOptions} from '@mdx-js/mdx';
import type {Node as EstreeNode} from 'estree';
import type {Root as MdastRoot,RootContent as MdastContent} from 'mdast';
import type {MdxJsxAttributeValueExpression} from 'mdast-util-mdx-jsx';
import type {Root,RootContent,Element,Properties,Parents} from 'hast';
import type {Position} from 'unist';
import type {Plugin} from 'unified';
import rehypeShiki from '@shikijs/rehype';
import type {RehypeShikiOptions} from '@shikijs/rehype';
import rehypeRaw from 'rehype-raw';
import {parseFrontmatter} from '@astrojs/internal-helpers/frontmatter';
import {markdownOptions} from '../markdown-options.js';
import {sourceProps} from '../markdown.js';
import type {MathAliases} from '../math-style.js';

const compiled=new Map<string,Promise<Awaited<ReturnType<typeof run>>['default']>>();
const cacheLimit=64;
type DocumentNode=MdastRoot | MdastContent | MdxJsxAttributeValueExpression;
export interface DocumentCompileOptions {
 format?: 'md' | 'mdx'; site?: {mathAliases?: MathAliases};
 components?: object; runtime?: RunOptions; runtimeName?: string;
}
function staticValue(node: EstreeNode | null | undefined): boolean{
 if(!node)return false;
 switch(node.type){
  case 'Literal':return typeof node.value!=='object'||node.value===null;
  case 'TemplateLiteral':return node.expressions.length===0;
  case 'ArrayExpression':return node.elements.every(staticValue);
  case 'ObjectExpression':return node.properties.every(item=>item.type==='Property'&&!item.computed&&item.kind==='init'&&staticValue(item.value));
  case 'UnaryExpression':return ['-','+','!'].includes(node.operator)&&staticValue(node.argument);
  case 'CallExpression':return node.arguments.length===0&&node.callee.type==='MemberExpression'&&!node.callee.computed&&node.callee.property.type==='Identifier'&&node.callee.property.name==='trim'&&['Literal','TemplateLiteral'].includes(node.callee.object.type)&&staticValue(node.callee.object);
  default:return false;
 }
}
// File previews accept the registered components and literal props, without
// executing module code or arbitrary expressions from a fetched document.
export function safeDocument(components: object): Plugin<[],MdastRoot>{
 return ()=>tree=>{
  const visit=(node: DocumentNode)=>{
   if(node.type==='mdxjsEsm')throw Error('此 MDX 含模块代码，请使用源码视图');
   if('name' in node&&node.name&&/^[A-Z]/.test(node.name)&&!Object.hasOwn(components,node.name))throw Error('文档组件未注册：'+node.name);
   if(node.type==='mdxTextExpression'||node.type==='mdxFlowExpression'||node.type==='mdxJsxAttributeValueExpression'){
    const body=node.data?.estree?.body;
    if(body?.length!==1||body[0].type!=='ExpressionStatement'||!staticValue(body[0].expression))throw Error('此 MDX 含动态表达式，请使用源码视图');
   }
   if('attributes' in node)for(const item of node.attributes){
    if(item.type==='mdxJsxExpressionAttribute'||/^on/i.test(item.name))throw Error('此 MDX 含动态属性，请使用源码视图');
    if(item.value&&typeof item.value==='object')visit(item.value);
   }
   if('children' in node)for(const child of node.children)visit(child);
  };
  visit(tree);
 };
}
const highlightedCode: Plugin<[RehypeShikiOptions],Root>=function(options){
 const highlight=rehypeShiki.call(this,{
  ...options,
  transformers:[...(options.transformers||[]),{pre(node){this.addClassToHast(node,'astro-code');node.properties['data-language']=this.options.lang;}}]
 });
 if(!highlight)throw Error('代码高亮插件无效');
 return async(tree,file)=>{
  const blocks: {parent: Parents; index: number; source: Properties; position?: Position}[]=[];
  const visit=(node: Root | RootContent)=>{
   if(!('children' in node))return;
   for(const [index,child]of node.children.entries()){
    if(child.type==='element'&&child.tagName==='pre')blocks.push({parent:node,index,source:sourceProps(child.properties),position:child.position});
    visit(child);
   }
  };
  visit(tree);
  await highlight(tree,file,()=>{});
  // rehype-shiki replaces each pre with a fragment. Keep the original source
  // span so rendered line selections work on code as they do on prose.
  for(const {parent,index,source,position}of blocks){
   const replacement=parent.children[index];
   const pre: Element | undefined=replacement.type==='element'?replacement:'children' in replacement?replacement.children.find((node): node is Element=>node.type==='element'&&node.tagName==='pre'):undefined;
   if(pre?.tagName==='pre'){Object.assign(pre.properties,source);pre.position=position;}
  }
 };
};
function compilerOptions({format,site,components,runtimeName}: Required<Pick<DocumentCompileOptions,'format' | 'site' | 'components' | 'runtimeName'>>): CompileOptions{
 const options=markdownOptions(site);
 return {
  format,outputFormat:'function-body',jsxImportSource:runtimeName,development:false,
  remarkRehypeOptions:{allowDangerousHtml:true},
  remarkPlugins:[...options.remarkPlugins,safeDocument(components)],
  rehypePlugins:[...(format==='md'?[rehypeRaw]:[]),...options.rehypePlugins,[highlightedCode,options.shikiConfig]]
 };
}
async function compileContent(source: string,options: Parameters<typeof compilerOptions>[0],runtime: RunOptions){
 const {content}=parseFrontmatter(source,{frontmatter:'empty-with-lines'});
 const code=await compile(content,compilerOptions(options));return (await run(code,runtime)).default;
}
// Both platforms compile the same Markdown/MDX semantics. Only the JSX runtime
// and component registry belong to the Astro or worker adapter.
export async function compileDocument(source: string,{format='md',site={},components={},runtime,runtimeName='astro'}: DocumentCompileOptions={}){
 if(!runtime)throw Error('文档 JSX runtime 未配置');
 const key=JSON.stringify([runtimeName,format,source,site.mathAliases||{},Object.keys(components).sort()]);
 let pending=compiled.get(key);
 if(!pending){
  pending=compileContent(source,{format,site,components,runtimeName},runtime).catch(error=>{compiled.delete(key);throw error;});
  compiled.set(key,pending);if(compiled.size>cacheLimit){const oldest=compiled.keys().next().value;if(oldest!==undefined)compiled.delete(oldest);}
 }
 return pending;
}
