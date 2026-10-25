import {h} from 'preact';
import {normalizeCodeBlock,serializeCodeBlock} from './code-block.js';
import {sourceProps} from '../markdown.mjs';
export function documentComponents(){
 let sequence=0;
 const box=(tag,className)=>({children,...props})=>h(tag,{...props,class:className},children);
 const Link=({href,children,...props})=>h('a',{href,'data-link':'',...props},children);
 const CodeBlock=props=>{
  const block=normalizeCodeBlock({...props,id:props.id||'embedded-'+(++sequence)}),metadata=serializeCodeBlock(block),definition=h('template',{'data-code-definition':metadata});
  if(!block.render)return h('template',{id:block.id,'data-code-definition':metadata,...sourceProps(props)});
  return h('div',{id:block.id,class:'code-block','data-document-code':'','data-language':block.language,'data-overflow':block.scroll?'scroll':'full',...sourceProps(props)},definition,h('pre',null,h('code',null,block.code??'读取代码…')));
 };
 return {
  Lead:box('div','lead'),Scope:box('div','scope'),Section:({children,...props})=>h('section',props,children),
  table:({children,...props})=>h('div',{class:'table-wrap'},h('table',props,children)),a:Link,
  TextNote:({children,href,desc,label,target,rel,...props})=>h(href?'a':'span',{class:'text-note',href,target,rel,role:href?undefined:'button',tabIndex:href?undefined:0,'aria-label':label,'data-note-description':desc,...sourceProps(props)},children),
  Annotations:({notes})=>h('span',{hidden:true,'data-note-definitions':JSON.stringify(notes)}),CodeBlock,
  pre:({children,...props})=>h('div',{class:'code-block',id:'embedded-'+(++sequence),'data-language':props['data-language']||'text','data-overflow':'full'},h('pre',props,children))
 };
}
