const groups={
 primary:{color:'steelblue',names:['primary']},
 secondary:{color:'peru',names:['secondary']},
};

export const mathMacros={...Object.fromEntries(Object.values(groups).flatMap(({color,names})=>names.map(name=>['\\'+name,'\\textcolor{'+color+'}{#1}']))),'\\annotate':'\\htmlData{note=#1}{#2}'};
export const createMathMacros=(aliases={})=>Object.fromEntries(Object.entries(aliases).flatMap(([role,names])=>{if(!groups[role]||!Array.isArray(names)||names.some(name=>!/^[a-zA-Z]+$/.test(name)))throw Error('数学宏别名无效');return names.map(name=>['\\'+name,'\\textcolor{'+groups[role].color+'}{#1}']);}));
export const mathStrict=code=>code==='htmlExtension'?'ignore':'error';
export const mathTrust=context=>context.command==='\\htmlData'&&Object.keys(context.attributes).length===1&&/^[a-z][a-z0-9-]*$/.test(context.attributes['data-note']);

export const mathThemeColors=()=>(tree,file)=>{
 const failure=file.messages?.find(message=>message.source==='rehype-katex');if(failure)file.fail(failure);
 const colors=new Map(Object.entries(groups).map(([role,{color}])=>[color,'var(--math-'+role+')']));
 const visit=(node,inside=false)=>{
  const props=node.properties;
  inside ||= props?.className?.includes('katex');
  if(inside&&props){
   if(typeof props.style==='string')props.style=props.style.replace(/(^|;)color:\s*([a-z]+|#[\da-f]+)(?=;|$)/gi,(match,prefix,color)=>colors.has(color.toLowerCase())?prefix+'color:'+colors.get(color.toLowerCase()):match);
   for(const key of ['mathcolor','mathColor'])if(colors.has(props[key]))props[key]=colors.get(props[key]);
  }
  for(const child of node.children||[])visit(child,inside);
 };visit(tree);
};
