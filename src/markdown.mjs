export const exactHeadings=()=> (tree,file)=>{
 const headings=[],text=node=>node.type==='text'?node.value:(node.children||[]).map(text).join('');
 const visit=node=>{
  const tag=node.type==='element'?node.tagName:/^mdxJsx/.test(node.type)?node.name:undefined;
  if(/^h[1-6]$/.test(tag||'')){
   const declared=node.type!=='element'&&node.attributes?.find(attr=>attr.name==='id'),id=declared&&typeof declared.value==='string'?declared.value:'mdx-'+(headings.length+1),title=text(node);headings.push({depth:Number(tag[1]),slug:id,text:title});
   if(node.type==='element'){node.properties||={};node.properties.id=id;node.properties['data-exact-heading']=title;}
   else{node.attributes=(node.attributes||[]).filter(attr=>!['id','data-exact-heading'].includes(attr.name));node.attributes.push(...Object.entries({id,'data-exact-heading':title}).map(([name,value])=>({type:'mdxJsxAttribute',name,value})));}
  }
  for(const child of node.children||[])visit(child);
 };visit(tree);file.data.astro||={};file.data.astro.frontmatter||={};file.data.astro.frontmatter.exactHeadings=headings;
};
export const sourceLocations=()=>tree=>{
 const visit=node=>{
  const p=node.position;
  if(p?.start&&p?.end){const props={'data-mdx-line':String(p.start.line),'data-mdx-column':String(p.start.column),'data-mdx-end-line':String(p.end.line),'data-mdx-end-column':String(p.end.column)};
   if(node.type==='element'&&/^(h[1-6]|p|li|pre|table|blockquote|figure|img)$/.test(node.tagName)){node.properties||={};Object.assign(node.properties,props);}
   else if(/^mdxJsx/.test(node.type)&&node.name){node.attributes||=[];for(const [name,value]of Object.entries(props))node.attributes.push({type:'mdxJsxAttribute',name,value});}
  }
  for(const child of node.children||[])visit(child);
 };visit(tree);
};
export const sourceProps=props=>Object.fromEntries(Object.entries(props).filter(([name])=>name.startsWith('data-mdx-')));
