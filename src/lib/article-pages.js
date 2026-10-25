export const canonicalArticlePath=path=>(path.replace(/\.html$/,'').replace(/\/$/,'')||'/index');
export const articlePageName=(base,index=0)=>base+(index?'-page-'+(index+1):'');
export const articleBasePath=path=>canonicalArticlePath(path).replace(/-page-[1-9]\d*$/,'');
export const renderedHeadings=result=>result.remarkPluginFrontmatter?.exactHeadings||result.headings;
export function headingPages(headings,base){
 if(!headings.some(heading=>heading.depth===1))throw Error('MDX 逻辑学习页需要 H1 标题');
 const pages=[],prefix=[];let page;
 for(const heading of headings){
  if(heading.depth===1){page={id:heading.slug,title:heading.text,href:articlePageName(base,pages.length)+'.html',headings:[]};pages.push(page);if(pages.length===1)for(const item of prefix)page.headings.push({...item,pageId:page.id,href:page.href+'#'+item.slug});}
  if(!page){prefix.push(heading);continue;}
  page.headings.push({...heading,pageId:page.id,href:page.href+'#'+heading.slug});
 }
 return pages;
}
export const serializeArticlePages=value=>JSON.stringify(value).replace(/</g,'\\u003c');
export function redirectArticleAnchor(manifest){
 let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return false;}
 const href=manifest?.anchors?.[id];if(!href)return false;
 const target=new URL(href,location.href),normalize=path=>(path.replace(/\.html$/,'').replace(/\/$/,'')||'/index');
 if(normalize(target.pathname)===normalize(location.pathname))return false;
 target.search=location.search;target.hash=location.hash;location.replace(target.href);return true;
}
export const articlePageBootstrap='('+redirectArticleAnchor.toString()+')(JSON.parse(document.getElementById("article-pages").textContent));';
