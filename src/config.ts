import fs from 'node:fs/promises';
import {createReadStream,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import type {AstroIntegration, AstroUserConfig} from 'astro';
export type ReifyConfigOptions = Omit<AstroUserConfig,'root'> & {root?: string | URL};
import mdx from '@astrojs/mdx';
import {unified} from '@astrojs/markdown-remark';
import {readSiteConfig} from './site-config.js';
import {sourceHighlightAssets} from './build/source-highlight.js';
import {copyFileResources} from './build/file-resources.js';
import {copyWebDocuments,webDocumentAsset} from './build/web-documents.js';
import {copyArticleSources,articleSourceAsset} from './build/article-sources.js';
import {markdownOptions} from './markdown-options.js';
const packageLocation=fileURLToPath(new URL('..',import.meta.url)),packageRoot=realpathSync.native(packageLocation),publicRoot=path.join(packageRoot,'public');
const mimeTypes: Record<string,string>={'.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain'};
const require=createRequire(import.meta.url);
const portableHtml=Object.fromEntries(['decode-named-character-reference','hast-util-from-html-isomorphic'].map(name=>[name,require.resolve(name)]));
export function defineReifyConfig({root=process.cwd(),...overrides}: ReifyConfigOptions={}): AstroUserConfig{
 const project=readSiteConfig(root);process.env.REIFY_PROJECT_ROOT=project.root;
 const markdown=markdownOptions(project);
 const componentModule='reify:components',resolved='\0'+componentModule;
 const integration: AstroIntegration={name:'reify',hooks:{
  'astro:config:setup':({injectRoute,injectScript,updateConfig,addWatchFile})=>{
   injectRoute({pattern:'/[name]',entrypoint:new URL('./pages/[name].astro',import.meta.url)});
   if(project.scripts.length)injectScript('page',project.scripts.map(file=>'import '+JSON.stringify(file.replaceAll('\\','/'))+';').join('\n'));
   addWatchFile(project.configFile);
   updateConfig({vite:{server:{fs:{allow:[packageLocation,packageRoot,project.root]}},plugins:[{name:'reify-components',resolveId:id=>id===componentModule?resolved:undefined,load:id=>id===resolved?Object.entries(project.components).map(([name,file])=>'import '+name+' from '+JSON.stringify(file.replaceAll('\\','/'))+';').join('\n')+'\nexport default {'+Object.keys(project.components).join(',')+'};':undefined}]}});
  },
  'astro:config:done':async({config})=>{await sourceHighlightAssets(config.root);},
  'astro:server:setup':({server})=>{
   server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url||'/','http://localhost'),pathname=decodeURIComponent(url.pathname),candidate=path.resolve(publicRoot,'.'+pathname),relative=path.relative(publicRoot,candidate);
    try{const asset=articleSourceAsset(pathname,project)||await webDocumentAsset(pathname);if(asset){res.setHeader('Content-Type',asset.type);if('body' in asset&&asset.body!==undefined)res.end(asset.body);else if(asset.file)createReadStream(asset.file).on('error',()=>{res.statusCode=404;res.end();}).pipe(res);return;}}catch{}
    if(!relative.startsWith('..')&&!path.isAbsolute(relative)){try{const own=path.join(project.publicDir,relative);if((await fs.stat(own).catch(()=>null))?.isFile())return next();if((await fs.stat(candidate)).isFile()){res.setHeader('Content-Type',(mimeTypes[path.extname(candidate)]||'application/octet-stream'));createReadStream(candidate).pipe(res);return;}}catch{}}
    if(url.pathname==='/')url.pathname='/index';else if(/^\/[^/]+\.html$/.test(url.pathname))url.pathname=url.pathname.slice(0,-5);req.url=url.pathname+url.search;next();
   });
  },
  'astro:build:done':async({dir})=>{await fs.cp(publicRoot,fileURLToPath(dir),{recursive:true,force:false});await copyFileResources(dir);await copyWebDocuments(dir);await copyArticleSources(dir,project);},
 }};
 return {root:project.root,publicDir:project.publicDir,cacheDir:path.join(project.root,'.astro'),output:'static',devToolbar:{enabled:false},build:{format:'file'},vite:{resolve:{alias:portableHtml},worker:{format:'es'}},markdown:{processor:unified(markdown),shikiConfig:markdown.shikiConfig},integrations:[mdx(),integration],...overrides};
}
