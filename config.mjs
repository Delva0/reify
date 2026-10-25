import fs from 'node:fs/promises';
import {createReadStream,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {defineConfig} from 'astro/config';
import mdx from '@astrojs/mdx';
import {unified} from '@astrojs/markdown-remark';
import {readSiteConfig} from './src/site-config.mjs';
import {sourceHighlightAssets} from './src/build/source-highlight.mjs';
import {copyFileResources} from './src/build/file-resources.mjs';
import {copyWebDocuments,webDocumentAsset} from './src/build/web-documents.mjs';
import {copyArticleSources,articleSourceAsset} from './src/build/article-sources.mjs';
import {markdownOptions} from './src/markdown-options.mjs';
const packageLocation=fileURLToPath(new URL('.',import.meta.url)),packageRoot=realpathSync.native(packageLocation),publicRoot=path.join(packageRoot,'public');
const require=createRequire(import.meta.url);
const portableHtml=Object.fromEntries(['decode-named-character-reference','hast-util-from-html-isomorphic'].map(name=>[name,require.resolve(name)]));
export function defineReifyConfig({root=process.cwd(),...overrides}={}){
 const project=readSiteConfig(root);process.env.REIFY_PROJECT_ROOT=project.root;
 const markdown=markdownOptions(project);
 const componentModule='reify:components',resolved='\0'+componentModule;
 const integration={name:'reify',hooks:{
  'astro:config:setup':({injectRoute,injectScript,updateConfig,addWatchFile})=>{
   injectRoute({pattern:'/[name]',entrypoint:new URL('./src/pages/[name].astro',import.meta.url)});
   if(project.scripts.length)injectScript('page',project.scripts.map(file=>'import '+JSON.stringify(file.replaceAll('\\','/'))+';').join('\n'));
   addWatchFile(project.configFile);
   updateConfig({vite:{server:{fs:{allow:[packageLocation,packageRoot,project.root]}},plugins:[{name:'reify-components',resolveId:id=>id===componentModule?resolved:undefined,load:id=>id===resolved?Object.entries(project.components).map(([name,file])=>'import '+name+' from '+JSON.stringify(file.replaceAll('\\','/'))+';').join('\n')+'\nexport default {'+Object.keys(project.components).join(',')+'};':undefined}]}});
  },
  'astro:config:done':async({config})=>{await sourceHighlightAssets(config.root);},
  'astro:server:setup':({server})=>{
   server.middlewares.use(async(req,res,next)=>{
    const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname),candidate=path.resolve(publicRoot,'.'+pathname),relative=path.relative(publicRoot,candidate);
    try{const asset=articleSourceAsset(pathname,project)||await webDocumentAsset(pathname);if(asset){res.setHeader('Content-Type',asset.type);if(asset.body)res.end(asset.body);else createReadStream(asset.file).on('error',()=>{res.statusCode=404;res.end();}).pipe(res);return;}}catch{}
    if(!relative.startsWith('..')&&!path.isAbsolute(relative)){try{const own=path.join(project.publicDir,relative);if((await fs.stat(own).catch(()=>null))?.isFile())return next();if((await fs.stat(candidate)).isFile()){res.setHeader('Content-Type',({'.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.txt':'text/plain'}[path.extname(candidate)]||'application/octet-stream'));createReadStream(candidate).pipe(res);return;}}catch{}}
    if(url.pathname==='/')url.pathname='/index';else if(/^\/[^/]+\.html$/.test(url.pathname))url.pathname=url.pathname.slice(0,-5);req.url=url.pathname+url.search;next();
   });
  },
  'astro:build:done':async({dir})=>{await fs.cp(publicRoot,fileURLToPath(dir),{recursive:true,force:false});await copyFileResources(dir);await copyWebDocuments(dir);await copyArticleSources(dir,project);},
 }};
 return defineConfig({root:project.root,publicDir:project.publicDir,cacheDir:path.join(project.root,'.astro'),output:'static',devToolbar:{enabled:false},build:{format:'file'},vite:{resolve:{alias:portableHtml},worker:{format:'es'}},markdown:{processor:unified(markdown),shikiConfig:markdown.shikiConfig},integrations:[mdx(),integration],...overrides});
}
