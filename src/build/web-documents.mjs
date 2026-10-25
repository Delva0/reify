import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readSiteConfig} from '../site-config.mjs';
import {readingLinkState} from '../lib/link-panels.js';
import {parseFpUrl} from '../lib/fp-links.js';
import {prepareWebDocument,webDocumentKey,webEmbeddingAllowed,webDocumentHasContent} from '../lib/web-document.js';

const require=createRequire(import.meta.url),documents=new Map(),assets=new Map();
const engineRoot=()=>path.dirname(require.resolve('darkreader'));
const cacheDirectory=()=>path.join(readSiteConfig().root,'.reify/web-pages');
const digest=value=>createHash('sha256').update(value).digest('hex');
const request=url=>fetch(url,{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{Accept:'text/html,text/css;q=0.9,*/*;q=0.5'}});
async function textResponse(response,limit){
 if(!response.ok)throw Error('HTTP '+response.status);
 if(Number(response.headers.get('content-length'))>limit)throw Error('文档资源过大');
 const value=await response.text();if(value.length>limit)throw Error('文档资源过大');return value;
}
async function snapshot(url){
 const id=digest('web-document-v1:'+url),file=path.join(cacheDirectory(),id+'.json');
 let data;try{const stat=await fs.stat(file);if(Date.now()-stat.mtimeMs<86400000)data=JSON.parse(await fs.readFile(file,'utf8'));}catch{}
 if(!data){
  const response=await request(url);if(!response.headers.get('content-type')?.includes('text/html')||!webEmbeddingAllowed(response.headers))return null;
  const html=await textResponse(response,4000000),styles=new Map();
  data=await prepareWebDocument(html,response.url,{loadStyle:source=>{if(!styles.has(source))styles.set(source,request(source).then(response=>textResponse(response,2000000)));return styles.get(source);}});
  await fs.mkdir(cacheDirectory(),{recursive:true});await fs.writeFile(file,JSON.stringify(data));
 }
 if(!webDocumentHasContent(data.html))return null;
 const asset='/data/web-pages/'+id+'.json';assets.set(url,asset);return data;
}
export async function prepareWebDocuments(hrefs,page){
 const base=new URL(page,'https://article.local'),targets=new Set();
 for(const href of hrefs){
  try{
   const state=parseFpUrl(href,base,{samePage:false})||[readingLinkState(href,base.href)].filter(Boolean);
   for(const item of state)if(item.type==='page'){const url=new URL(item.props.url,base);if(url.origin!==base.origin&&/^https?:$/.test(url.protocol)&&!url.username&&!url.password)targets.add(webDocumentKey(url));}
  }catch{}
 }
 await Promise.all([...targets].map(url=>{if(!documents.has(url))documents.set(url,snapshot(url).catch(()=>null));return documents.get(url);}));
 const manifest=Object.fromEntries([...targets].filter(url=>assets.has(url)).map(url=>[url,assets.get(url)])),directory=path.join(cacheDirectory(),'manifests');
 await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,digest(page)+'.json'),JSON.stringify(manifest));
}
export async function copyWebDocuments(directory){
 const output=fileURLToPath(directory),target=path.join(output,'data/web-pages');await fs.mkdir(target,{recursive:true});
 const pages={};for(const name of await fs.readdir(output))if(name.endsWith('.html'))try{Object.assign(pages,JSON.parse(await fs.readFile(path.join(cacheDirectory(),'manifests',digest('/'+name)+'.json'),'utf8')));}catch{}
 for(const asset of Object.values(pages)){const file=path.basename(asset);if(/^[\da-f]{64}\.json$/.test(file))await fs.copyFile(path.join(cacheDirectory(),file),path.join(target,file));}
 await fs.writeFile(path.join(target,'index.json'),JSON.stringify({version:1,pages}));
 const vendor=path.join(output,'assets/darkreader');await fs.mkdir(vendor,{recursive:true});
 for(const name of ['darkreader.js','LICENSE'])await fs.copyFile(path.join(engineRoot(),name),path.join(vendor,name));
}
export async function webDocumentAsset(pathname){
 if(pathname==='/assets/darkreader/darkreader.js')return {file:path.join(engineRoot(),'darkreader.js'),type:'text/javascript'};
 if(pathname==='/assets/darkreader/LICENSE')return {file:path.join(engineRoot(),'LICENSE'),type:'text/plain'};
 if(pathname==='/data/web-pages/index.json'){
  const pages={...Object.fromEntries(assets)},directory=path.join(cacheDirectory(),'manifests');
  try{for(const file of await fs.readdir(directory))if(/^[\da-f]{64}\.json$/.test(file))Object.assign(pages,JSON.parse(await fs.readFile(path.join(directory,file),'utf8')));}catch{}
  return {body:JSON.stringify({version:1,pages}),type:'application/json'};
 }
 if(/^\/data\/web-pages\/[\da-f]{64}\.json$/.test(pathname))return {file:path.join(cacheDirectory(),path.basename(pathname)),type:'application/json'};
}
