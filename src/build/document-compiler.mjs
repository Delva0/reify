import {compile,run} from '@mdx-js/mdx';
import rehypeShiki from '@shikijs/rehype';
import rehypeRaw from 'rehype-raw';
import {parseFrontmatter} from '@astrojs/internal-helpers/frontmatter';
import {markdownOptions} from '../markdown-options.mjs';
import {sourceProps} from '../markdown.mjs';

const compiled=new Map();
const cacheLimit=64;

function staticValue(node){
 if(!node)return false;
 switch(node.type){
  case 'Literal':return typeof node.value!=='object'||node.value===null;
  case 'TemplateLiteral':return node.expressions.length===0;
  case 'ArrayExpression':return node.elements.every(staticValue);
  case 'ObjectExpression':return node.properties.every(item=>item.type==='Property'&&!item.computed&&item.kind==='init'&&staticValue(item.value));
  case 'UnaryExpression':return ['-','+','!'].includes(node.operator)&&staticValue(node.argument);
  case 'CallExpression':return node.arguments.length===0&&node.callee.type==='MemberExpression'&&!node.callee.computed&&node.callee.property.name==='trim'&&['Literal','TemplateLiteral'].includes(node.callee.object.type)&&staticValue(node.callee.object);
  default:return false;
 }
}

// File previews accept the registered components and literal props, without
// executing module code or arbitrary expressions from a fetched document.
export function safeDocument(components){
 return ()=>tree=>{
  const visit=node=>{
   if(node.type==='mdxjsEsm')throw Error('此 MDX 含模块代码，请使用源码视图');
   if(node.name&&/^[A-Z]/.test(node.name)&&!Object.hasOwn(components,node.name))throw Error('文档组件未注册：'+node.name);
   if(['mdxTextExpression','mdxFlowExpression','mdxJsxAttributeValueExpression'].includes(node.type)){
    const body=node.data?.estree?.body;
    if(body?.length!==1||body[0].type!=='ExpressionStatement'||!staticValue(body[0].expression))throw Error('此 MDX 含动态表达式，请使用源码视图');
   }
   for(const item of node.attributes||[]){
    if(/^on/i.test(item.name)||item.type==='mdxJsxExpressionAttribute')throw Error('此 MDX 含动态属性，请使用源码视图');
    if(item.value&&typeof item.value==='object')visit(item.value);
   }
   for(const child of node.children||[])visit(child);
  };
  visit(tree);
 };
}

function highlightedCode(options){
 const highlight=rehypeShiki.call(this,{
  ...options,
  transformers:[...(options.transformers||[]),{pre(node){this.addClassToHast(node,'astro-code');node.properties['data-language']=this.options.lang;}}]
 });
 return async tree=>{
  const blocks=[];
  const visit=node=>{
   for(const [index,child]of (node.children||[]).entries()){
    if(child.type==='element'&&child.tagName==='pre')blocks.push({parent:node,index,source:sourceProps(child.properties||{}),position:child.position});
    visit(child);
   }
  };
  visit(tree);
  await highlight(tree);
  // rehype-shiki replaces each pre with a fragment. Keep the original source
  // span so rendered line selections work on code as they do on prose.
  for(const {parent,index,source,position}of blocks){
   const replacement=parent.children[index];
   const pre=replacement.type==='element'?replacement:replacement.children?.find(node=>node.type==='element'&&node.tagName==='pre');
   if(pre?.tagName==='pre'){
    Object.assign(pre.properties,source);
    pre.position=position;
   }
  }
 };
}

function compilerOptions({format,site,components,runtimeName}){
 const options=markdownOptions(site);
 return {
  format,
  outputFormat:'function-body',
  jsxImportSource:runtimeName,
  development:false,
  remarkRehypeOptions:{allowDangerousHtml:true},
  remarkPlugins:[...options.remarkPlugins,safeDocument(components)],
  rehypePlugins:[
   ...(format==='md'?[rehypeRaw]:[]),
   ...options.rehypePlugins,
   [highlightedCode,options.shikiConfig]
  ]
 };
}

async function compileContent(source,options,runtime){
 const {content}=parseFrontmatter(source,{frontmatter:'empty-with-lines'});
 const code=await compile(content,compilerOptions(options));
 return (await run(code,runtime)).default;
}

// Both platforms compile the same Markdown/MDX semantics. Only the JSX runtime
// and component registry belong to the Astro or worker adapter.
export async function compileDocument(source,{format='md',site={},components={},runtime,runtimeName='astro'}={}){
 const key=JSON.stringify([runtimeName,format,source,site.mathAliases||{},Object.keys(components).sort()]);
 if(!compiled.has(key)){
  const pending=compileContent(source,{format,site,components,runtimeName},runtime).catch(error=>{
   compiled.delete(key);
   throw error;
  });
  compiled.set(key,pending);
  if(compiled.size>cacheLimit)compiled.delete(compiled.keys().next().value);
 }
 return compiled.get(key);
}
