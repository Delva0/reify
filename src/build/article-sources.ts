import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readSiteConfig} from '../site-config.js';
import type {SiteConfig} from '../site-config.js';
import {isRecord,jsonRecord} from './data.js';

const assetPattern=/^\/data\/article-sources\/([\da-f]{64}\.(?:md|mdx))$/;
const cacheDirectory=(site: SiteConfig)=>path.join(site.root,'.reify/article-sources');

export async function prepareArticleSource(file: string,site=readSiteConfig()){
 const source=path.resolve(site.contentDir,file),relative=path.relative(site.contentDir,source),extension=path.extname(source).toLowerCase();
 if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||!['.md','.mdx'].includes(extension))throw Error('文章源文件无效：'+file);
 const bytes=await fs.readFile(source),name=createHash('sha256').update(bytes).digest('hex')+extension;
 await fs.mkdir(cacheDirectory(site),{recursive:true});
 try{await fs.writeFile(path.join(cacheDirectory(site),name),bytes,{flag:'wx'});}catch(error){if(!isRecord(error)||error.code!=='EEXIST')throw error;}
 return {href:'/data/article-sources/'+name,language:extension==='.mdx'?'mdx':'markdown',file:path.relative(site.root,source).split(path.sep).join('/')};
}

export function articleSourceAsset(pathname: string,site=readSiteConfig()){
 const name=pathname.match(assetPattern)?.[1];
 if(name)return {file:path.join(cacheDirectory(site),name),type:'text/plain; charset=utf-8'};
}

// SSR and the config hook can have separate module instances. The rendered
// manifests name the exact disk assets required by this build, without a Map.
export async function copyArticleSources(directory: string | URL,site=readSiteConfig()){
 const output=directory instanceof URL?fileURLToPath(directory):path.resolve(directory),assets=new Set<string>();
 const inspect=async (folder: string): Promise<void>=>{
  for(const entry of await fs.readdir(folder,{withFileTypes:true})){
   const file=path.join(folder,entry.name);
   if(entry.isDirectory()&&!['assets','_astro','data'].includes(entry.name))await inspect(file);
   else if(entry.isFile()&&entry.name.endsWith('.html')){
    const html=await fs.readFile(file,'utf8'),json=html.match(/<script\b[^>]*\bid=["']article-pages["'][^>]*>([\s\S]*?)<\/script>/)?.[1];
    if(!json)continue;
    const source=jsonRecord(json).source,href=isRecord(source)?source.href:undefined;
    const name=typeof href==='string'?href.match(assetPattern)?.[1]:undefined;if(name)assets.add(name);
   }
  }
 };
 await inspect(output);if(!assets.size)return;
 const target=path.join(output,'data/article-sources');await fs.mkdir(target,{recursive:true});
 await Promise.all([...assets].map(name=>fs.copyFile(path.join(cacheDirectory(site),name),path.join(target,name))));
}
