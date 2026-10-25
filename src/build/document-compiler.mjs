import {compile,run} from '@mdx-js/mdx';
import rehypeShiki from '@shikijs/rehype';
import rehypeRaw from 'rehype-raw';
import {parseFrontmatter} from '@astrojs/internal-helpers/frontmatter';
import {markdownOptions} from '../markdown-options.mjs';
const compiled=new Map();
function staticValue(node){
 if(!node)return false;
 if(node.type==='Literal')return typeof node.value!=='object'||node.value===null;
 if(node.type==='TemplateLiteral')return node.expressions.length===0;
 if(node.type==='ArrayExpression')return node.elements.every(staticValue);
 if(node.type==='ObjectExpression')return node.properties.every(item=>item.type==='Property'&&!item.computed&&item.kind==='init'&&staticValue(item.value));
 if(node.type==='UnaryExpression')return ['-','+','!'].includes(node.operator)&&staticValue(node.argument);
 if(node.type==='CallExpression')return node.arguments.length===0&&node.callee.type==='MemberExpression'&&!node.callee.computed&&node.callee.property.name==='trim'&&['Literal','TemplateLiteral'].includes(node.callee.object.type)&&staticValue(node.callee.object);
 return false;
}
export function safeDocument(components){return ()=>tree=>{
 const visit=node=>{
  if(node.type==='mdxjsEsm')throw Error('此 MDX 含模块代码，请使用源码视图');
  if(node.name&&/^[A-Z]/.test(node.name)&&!Object.hasOwn(components,node.name))throw Error('文档组件未注册：'+node.name);
  if(node.type==='mdxTextExpression'||node.type==='mdxFlowExpression'||node.type==='mdxJsxAttributeValueExpression'){const body=node.data?.estree?.body;if(body?.length!==1||body[0].type!=='ExpressionStatement'||!staticValue(body[0].expression))throw Error('此 MDX 含动态表达式，请使用源码视图');}
  for(const item of node.attributes||[]){if(/^on/i.test(item.name)||item.type==='mdxJsxExpressionAttribute')throw Error('此 MDX 含动态属性，请使用源码视图');if(item.value&&typeof item.value==='object')visit(item.value);}
  for(const child of node.children||[])visit(child);
 };visit(tree);
};}
export async function compileDocument(source,{format='md',site={},components={},runtime,runtimeName='astro'}={}){
 const key=runtimeName+'\0'+format+'\0'+source+'\0'+JSON.stringify(site.mathAliases||{})+'\0'+Object.keys(components).sort().join(',');
 if(!compiled.has(key))compiled.set(key,(async()=>{const options=markdownOptions(site),content=parseFrontmatter(source,{frontmatter:'empty-with-lines'}).content,code=await compile(content,{format,outputFormat:'function-body',jsxImportSource:runtimeName,development:false,remarkRehypeOptions:{allowDangerousHtml:true},remarkPlugins:[...options.remarkPlugins,safeDocument(components)],rehypePlugins:[...(format==='md'?[rehypeRaw]:[]),...options.rehypePlugins,[rehypeShiki,{...options.shikiConfig,transformers:[{pre(node){this.addClassToHast(node,'astro-code');}}]}]]});return (await run(code,runtime)).default;})().catch(error=>{compiled.delete(key);throw error;}));
 if(compiled.size>64)compiled.delete(compiled.keys().next().value);return compiled.get(key);
}
