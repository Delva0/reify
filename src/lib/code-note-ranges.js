export const codeNoteProperties=(desc,group,focusable=true)=>({className:['text-note'],tabIndex:focusable?0:-1,'data-note-group':String(group),'data-note-description':desc});
export function codeAnnotationProperties(range,group,focusable=true){
 if(!range.decorations)return codeNoteProperties(range.desc,group,focusable);
 const {note,link,mark}=range.decorations,props=note?codeNoteProperties(note.desc,group,focusable):{};
 if(link){props.href=link.href;props.tabIndex=focusable?0:-1;}
 if(mark){props.className=[...(props.className||[]),'code-mark'];props['data-mark-color']=mark.color;}
 props['data-code-annotation-group']=String(group);return props;
}
export const codeNodeLength=(node,tree)=>tree.isText(node)?tree.text(node).length:tree.children(node).reduce((sum,child)=>sum+codeNodeLength(child,tree),0);
export const hastCodeTree={isText:node=>node.type==='text',text:node=>node.value,children:node=>node.children||[],copy:node=>node,withText:(node,value)=>({...node,value}),withChildren:(node,children)=>({...node,children}),wrap:(properties,children)=>({type:'element',tagName:properties.href?'a':'span',properties,children})};
export function decorateCodeLine(nodes,offset,ranges,tree){
 const size=nodes.reduce((sum,node)=>sum+codeNodeLength(node,tree),0);
 const slice=(items,from,to)=>{
  let cursor=0;const result=[];
  for(const node of items){const length=codeNodeLength(node,tree),start=Math.max(0,from-cursor),end=Math.min(length,to-cursor);cursor+=length;if(start>=end)continue;
   result.push(start===0&&end===length?tree.copy(node):tree.isText(node)?tree.withText(node,tree.text(node).slice(start,end)):tree.withChildren(node,slice(tree.children(node),start,end)));
  }return result;
 };
 const children=[];let cursor=0;
 for(const [id,range]of ranges.entries()){
  const from=Math.max(offset,range.start)-offset,to=Math.min(offset+size,range.end)-offset;if(from>=to)continue;
  children.push(...slice(nodes,cursor,from),tree.wrap(codeAnnotationProperties(range,range.group??id,!range.focused),slice(nodes,from,to)));range.focused=true;cursor=to;
 }
 return {length:size,children:children.length?[...children,...slice(nodes,cursor,size)]:null};
}
