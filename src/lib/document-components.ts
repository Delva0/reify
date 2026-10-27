import {h} from 'preact';
import type {ComponentChildren} from 'preact';
import type {Properties} from 'hast';
import {normalizeCodeBlock,serializeCodeBlock} from './code-block.js';
import {sourceProps} from '../markdown.js';
interface DocumentProps {children?:ComponentChildren;[key:string]:unknown}
interface LinkProps extends DocumentProps {href?:string}
interface NoteProps extends LinkProps {desc?:string;label?:string;target?:string;rel?:string}
const locationProps=(props:DocumentProps)=>{const locations:Properties={};for(const [name,value]of Object.entries(props))if(name.startsWith('data-mdx-')&&(typeof value==='string'||typeof value==='number'))locations[name]=value;return sourceProps(locations);};
// Documents compiled in a worker hydrate the shared code and annotation tools.
export function documentComponents(){
 let sequence=0;
 const nextId=()=>'embedded-'+(++sequence);
 const box=(tag:'div',className:string)=>({children,...props}:DocumentProps)=>h(tag,{...props,class:className},children);
 const Link=({href,children,...props}:LinkProps)=>h('a',{href,'data-link':'',...props},children);
 const CodeBlock=(props:DocumentProps)=>{
  const block=normalizeCodeBlock({...props,id:props.id||nextId()});
  const metadata=serializeCodeBlock(block);
  if(!block.render)return h('template',{id:block.id,'data-code-definition':metadata,...locationProps(props)});
  return h('div',{
   id:block.id,class:'code-block','data-document-code':'','data-language':block.language,'data-overflow':block.scroll?'scroll':'full',...locationProps(props)
  },h('template',{'data-code-definition':metadata}),h('pre',null,h('code',null,block.code??'读取代码…')));
 };
 const Pre=({children,...props}:DocumentProps)=>h('div',{
  class:'code-block',id:nextId(),'data-language':props['data-language']||'text','data-overflow':'full'
 },h('pre',props,children));
 const TextNote=({children,href,desc,label,target,rel,...props}:NoteProps)=>h(href?'a':'span',{
  class:'text-note',href,target,rel,role:href?undefined:'button',tabIndex:href?undefined:0,'aria-label':label,'data-note-description':desc,...locationProps(props)
 },children);
 return {
  Lead:box('div','lead'),Scope:box('div','scope'),
  Section:({children,...props}:DocumentProps)=>h('section',props,children),
  table:({children,...props}:DocumentProps)=>h('div',{class:'table-wrap'},h('table',props,children)),
  a:Link,TextNote,
  Annotations:({notes}:{notes:unknown})=>h('span',{hidden:true,'data-note-definitions':JSON.stringify(notes)}),CodeBlock,pre:Pre
 };
}
