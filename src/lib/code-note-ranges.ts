import type {ElementContent} from 'hast';
import type {CodeDecoration} from './code-annotations.js';
export interface AnnotationProperties {className?: string[];tabIndex?: number;href?: string;[key:string]: string|string[]|number|undefined}
export interface MutableAnnotationRange {start:number;end:number;decorations?:CodeDecoration;desc?:string;group?:string|number;focused?:boolean}
export interface CodeTree<T> {isText(node:T):boolean;text(node:T):string;children(node:T):T[];copy(node:T):T;withText(node:T,value:string):T;withChildren(node:T,children:T[]):T;wrap(properties:AnnotationProperties,children:T[]):T}
export const codeNoteProperties=(desc: string|undefined,group: string|number,focusable=true): AnnotationProperties=>({className:['text-note'],tabIndex:focusable?0:-1,'data-note-group':String(group),'data-note-description':desc});
export function codeAnnotationProperties(range: MutableAnnotationRange,group: string|number,focusable=true): AnnotationProperties{
 if(!range.decorations)return codeNoteProperties(range.desc,group,focusable);
 const {note,link,mark}=range.decorations,props: AnnotationProperties=note?codeNoteProperties(note.desc,group,focusable):{};
 if(link){props.href=link.href;props.tabIndex=focusable?0:-1;}
 if(mark){props.className=[...(props.className||[]),'code-mark'];props['data-mark-color']=mark.color;}
 props['data-code-annotation-group']=String(group);return props;
}
export const codeNodeLength=<T>(node:T,tree:CodeTree<T>):number=>tree.isText(node)?tree.text(node).length:tree.children(node).reduce((sum,child)=>sum+codeNodeLength(child,tree),0);
export const hastCodeTree: CodeTree<ElementContent>={isText:node=>node.type==='text',text:node=>node.type==='text'?node.value:'',children:node=>node.type==='element'?node.children:[],copy:node=>node,withText:(node,value)=>node.type==='text'?{...node,value}:node,withChildren:(node,children)=>node.type==='element'?{...node,children}:node,wrap:(properties,children)=>({type:'element',tagName:properties.href?'a':'span',properties,children})};
export function decorateCodeLine<T>(nodes:T[],offset:number,ranges:MutableAnnotationRange[],tree:CodeTree<T>){
 const size=nodes.reduce((sum,node)=>sum+codeNodeLength(node,tree),0);
 const slice=(items:T[],from:number,to:number):T[]=>{
  let cursor=0;const result:T[]=[];
  for(const node of items){const length=codeNodeLength(node,tree),start=Math.max(0,from-cursor),end=Math.min(length,to-cursor);cursor+=length;if(start>=end)continue;
   result.push(start===0&&end===length?tree.copy(node):tree.isText(node)?tree.withText(node,tree.text(node).slice(start,end)):tree.withChildren(node,slice(tree.children(node),start,end)));
  }return result;
 };
 const children:T[]=[];let cursor=0;
 for(const [id,range]of ranges.entries()){
  const from=Math.max(offset,range.start)-offset,to=Math.min(offset+size,range.end)-offset;if(from>=to)continue;
  children.push(...slice(nodes,cursor,from),tree.wrap(codeAnnotationProperties(range,range.group??id,!range.focused),slice(nodes,from,to)));range.focused=true;cursor=to;
 }
 return {length:size,children:children.length?[...children,...slice(nodes,cursor,size)]:null};
}
