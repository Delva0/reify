import {h} from 'preact';
import {normalizeCodeBlock,serializeCodeBlock} from './code-block.js';
import {sourceProps} from '../markdown.mjs';

// JSX adapter for documents compiled in a worker. Article/SSR documents keep
// their Astro registry; code tools, annotations and source loading hydrate the
// same metadata and markup after this initial render.
export function documentComponents(){
 let sequence=0;
 const nextId=()=>'embedded-'+(++sequence);
 const box=(tag,className)=>({children,...props})=>h(tag,{...props,class:className},children);
 const Link=({href,children,...props})=>h('a',{href,'data-link':'',...props},children);
 const CodeBlock=props=>{
  const block=normalizeCodeBlock({...props,id:props.id||nextId()});
  const metadata=serializeCodeBlock(block);
  if(!block.render)return h('template',{id:block.id,'data-code-definition':metadata,...sourceProps(props)});
  return h('div',{
   id:block.id,
   class:'code-block',
   'data-document-code':'',
   'data-language':block.language,
   'data-overflow':block.scroll?'scroll':'full',
   ...sourceProps(props)
  },h('template',{'data-code-definition':metadata}),h('pre',null,h('code',null,block.code??'读取代码…')));
 };
 const Pre=({children,...props})=>h('div',{
  class:'code-block',
  id:nextId(),
  'data-language':props['data-language']||'text',
  'data-overflow':'full'
 },h('pre',props,children));
 const TextNote=({children,href,desc,label,target,rel,...props})=>h(href?'a':'span',{
  class:'text-note',
  href,target,rel,
  role:href?undefined:'button',
  tabIndex:href?undefined:0,
  'aria-label':label,
  'data-note-description':desc,
  ...sourceProps(props)
 },children);
 return {
  Lead:box('div','lead'),
  Scope:box('div','scope'),
  Section:({children,...props})=>h('section',props,children),
  table:({children,...props})=>h('div',{class:'table-wrap'},h('table',props,children)),
  a:Link,
  TextNote,
  Annotations:({notes})=>h('span',{hidden:true,'data-note-definitions':JSON.stringify(notes)}),
  CodeBlock,
  pre:Pre
 };
}
