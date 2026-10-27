export interface ArticleHeading {depth: number; slug: string; text: string}
export interface PageHeading extends ArticleHeading {pageId: string; href: string}
export interface ArticlePage {id: string; title: string; href: string; headings: PageHeading[]}
export interface ArticleManifest {anchors?: Record<string,string>; pages?: ArticlePage[]}
export const canonicalArticlePath=(path: string)=>(path.replace(/\.html$/,'').replace(/\/$/,'')||'/index');
export const articleSourceId=(source: string)=>source.replaceAll('\\','/').replace(/^\.\//,'').replace(/\.mdx$/,'');
export const articlePageName=(base: string,index=0)=>base+(index?'-page-'+(index+1):'');
export const articleBasePath=(path: string)=>canonicalArticlePath(path).replace(/-page-[1-9]\d*$/,'');
export const renderedHeadings=(result: {remarkPluginFrontmatter?: {exactHeadings?: ArticleHeading[]}; headings: ArticleHeading[]})=>result.remarkPluginFrontmatter?.exactHeadings||result.headings;
export function headingPages(headings: ArticleHeading[],base: string): ArticlePage[]{
 if(!headings.some(heading=>heading.depth===1))throw Error('MDX 逻辑学习页需要 H1 标题');
 const pages: ArticlePage[]=[],prefix: ArticleHeading[]=[];let page: ArticlePage|undefined;
 for(const heading of headings){
  if(heading.depth===1){page={id:heading.slug,title:heading.text,href:articlePageName(base,pages.length)+'.html',headings:[]};pages.push(page);if(pages.length===1)for(const item of prefix)page.headings.push({...item,pageId:page.id,href:page.href+'#'+item.slug});}
  if(!page){prefix.push(heading);continue;}
  page.headings.push({...heading,pageId:page.id,href:page.href+'#'+heading.slug});
 }
 return pages;
}
export const serializeArticlePages=(value: unknown)=>JSON.stringify(value).replace(/</g,'\\u003c');
export function redirectArticleAnchor(manifest: ArticleManifest|null|undefined,navigate?: (href: string)=>unknown){
 let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return false;}
 const href=manifest?.anchors?.[id];if(!href)return false;
 const target=new URL(href,location.href),normalize=(path: string)=>(path.replace(/\.html$/,'').replace(/\/$/,'')||'/index');
 if(normalize(target.pathname)===normalize(location.pathname))return false;
 target.search=location.search;target.hash=location.hash;if(navigate)navigate(target.href);else location.replace(target.href);return true;
}
export const articlePageBootstrap='('+redirectArticleAnchor.toString()+')(JSON.parse(document.getElementById("article-pages").textContent));';
