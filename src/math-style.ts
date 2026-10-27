import type {Plugin} from 'unified';
import type {Root,RootContent,Properties} from 'hast';
import type {KatexOptions} from 'katex';
import {isRecord} from './lib/data-types.js';
const groups={primary:{color:'steelblue',names:['primary']},secondary:{color:'peru',names:['secondary']}};
export type MathAliases = Partial<Record<keyof typeof groups,string[]>>;
export const mathMacros: Record<string,string>={...Object.fromEntries(Object.values(groups).flatMap(({color,names})=>names.map(name=>['\\'+name,'\\textcolor{'+color+'}{#1}']))),'\\annotate':'\\htmlData{note=#1}{#2}'};
export const createMathMacros=(aliases: MathAliases={})=>Object.fromEntries(Object.entries(aliases).flatMap(([role,names])=>{if(role!=='primary'&&role!=='secondary'||!Array.isArray(names)||names.some(name=>!/^[a-zA-Z]+$/.test(name)))throw Error('数学宏别名无效');return names.map(name=>['\\'+name,'\\textcolor{'+groups[role].color+'}{#1}']);}));
export const mathStrict = (code: string): 'ignore' | 'error'=>code==='htmlExtension'?'ignore':'error';
export const mathTrust: Exclude<KatexOptions['trust'],boolean | undefined> = context=>context.command==='\\htmlData'&&'attributes' in context&&isRecord(context.attributes)&&Object.keys(context.attributes).length===1&&typeof context.attributes['data-note']==='string'&&/^[a-z][a-z0-9-]*$/.test(context.attributes['data-note']);
export const mathThemeColors: Plugin<[],Root> = ()=> (tree,file)=>{
 const failure=file.messages.find(message=>message.source==='rehype-katex');if(failure)file.fail(failure);
 const colors=new Map(Object.entries(groups).map(([role,{color}])=>[color,'var(--math-'+role+')']));
 const visit=(node: Root | RootContent,inside=false)=>{
  const props: Properties | undefined=node.type==='element'?node.properties:undefined;
  inside ||= Array.isArray(props?.className)&&props.className.includes('katex');
  if(inside&&props){
   if(typeof props.style==='string')props.style=props.style.replace(/(^|;)color:\s*([a-z]+|#[\da-f]+)(?=;|$)/gi,(match: string,prefix: string,color: string)=>colors.has(color.toLowerCase())?prefix+'color:'+colors.get(color.toLowerCase()):match);
   for(const key of ['mathcolor','mathColor']){const value=props[key];if(typeof value==='string'&&colors.has(value))props[key]=colors.get(value);}
  }
  if('children' in node)for(const child of node.children)visit(child,inside);
 };visit(tree);
};
