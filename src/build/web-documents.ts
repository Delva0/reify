import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readSiteConfig} from '../site-config.js';
import {readingLinkState} from '../lib/link-panels.js';
import {parseFpUrl} from '../lib/fp-links.js';
import {prepareWebDocument,webDocumentKey,webEmbeddingAllowed,webDocumentHasContent,webDocumentLinks} from '../lib/web-document.js';
import {webDocumentRestriction} from '../lib/web-navigation.js';
import {isRecord,jsonRecord,stringMap} from './data.js';
type WebDocument=Awaited<ReturnType<typeof prepareWebDocument>>;
interface Manifest {pages: Record<string,string>; external: Set<string>}
const require=createRequire(import.meta.url),documents=new Map<string,Promise<WebDocument | null>>(),assets=new Map<string,string>(),external=new Set<string>(),checks=new Map<string,Promise<void>>();
const engineRoot=()=>path.dirname(require.resolve('darkreader'));
const cacheDirectory=()=>path.join(readSiteConfig().root,'.reify/web-pages');
const digest=(value: string)=>createHash('sha256').update(value).digest('hex');
const request=(url: string)=>fetch(url,{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{Accept:'text/html,text/css;q=0.9,*/*;q=0.5'}});
async function textResponse(response: Response,limit: number){
 if(!response.ok)throw Error('HTTP '+response.status);
 if(Number(response.headers.get('content-length'))>limit)throw Error('文档资源过大');
 const value=await response.text();if(value.length>limit)throw Error('文档资源过大');return value;
}
function cachedDocument(value: unknown): WebDocument{
 if(!isRecord(value)||value.version!==1||typeof value.url!=='string'||typeof value.title!=='string'||typeof value.html!=='string')throw Error('网页缓存无效');
 return {version:1,url:value.url,title:value.title,html:value.html};
}
async function snapshot(url: string): Promise<WebDocument | null>{
 const id=digest('web-document-v1:'+url),file=path.join(cacheDirectory(),id+'.json');
 let data: WebDocument | undefined;try{const stat=await fs.stat(file);if(Date.now()-stat.mtimeMs<86400000)data=cachedDocument(JSON.parse(await fs.readFile(file,'utf8')));}catch{}
 if(!data){
  const response=await request(url);if(!response.ok)return null;
  const restriction=webDocumentRestriction(response.headers);if(restriction){external.add(url);return null;}
  if(!response.headers.get('content-type')?.includes('text/html')||!webEmbeddingAllowed(response.headers))return null;
  const html=await textResponse(response,4000000),styles=new Map<string,Promise<string>>();
  data=await prepareWebDocument(html,response.url,{loadStyle:(source: string)=>{let pending=styles.get(source);if(!pending){pending=request(source).then(response=>textResponse(response,2000000));styles.set(source,pending);}return pending;}});
  await fs.mkdir(cacheDirectory(),{recursive:true});await fs.writeFile(file,JSON.stringify(data));
 }
 if(!webDocumentHasContent(data.html)){external.add(url);return null;}
 const asset='/data/web-pages/'+id+'.json';assets.set(url,asset);return data;
}
async function checkExternalLink(url: string){
 const file=path.join(cacheDirectory(),'checks',digest(url)+'.json');let result: {external: boolean} | undefined;
 try{const stat=await fs.stat(file);if(Date.now()-stat.mtimeMs<86400000){const value=jsonRecord(await fs.readFile(file,'utf8'));if(typeof value.external==='boolean')result={external:value.external};}}catch{}
 if(!result){
  result={external:false};try{const response=await fetch(url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(8000)});if(response.ok)result.external=Boolean(webDocumentRestriction(response.headers));}catch{}
  await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(result));
 }
 if(result.external)external.add(url);
}
function mergeManifest(target: Manifest,value: unknown){
 if(!isRecord(value))throw Error('网页 manifest 无效');
 Object.assign(target.pages,stringMap(value.pages||value,'manifest.pages'));
 const links=value.external||[];if(!Array.isArray(links)||links.some((url: unknown)=>typeof url!=='string'))throw Error('manifest.external 无效');
 for(const url of links)if(typeof url==='string')target.external.add(url);
}
const manifestIndex=(value: Manifest)=>({version:1,pages:value.pages,external:[...value.external]});
export async function prepareWebDocuments(hrefs: string[],page: string){
 const base=new URL(page,'https://article.local'),targets=new Set<string>();
 for(const href of hrefs){
  try{
   const reading=readingLinkState(href,base.href),state=parseFpUrl(href,base.href,{samePage:false})||(reading?[reading]:[]);
   for(const item of state)if(item.type==='page'){const url=new URL(item.props.url,base);if(url.origin!==base.origin&&/^https?:$/.test(url.protocol)&&!url.username&&!url.password)targets.add(webDocumentKey(url.href));}
  }catch{}
 }
 await Promise.all([...targets].map(url=>{if(!documents.has(url))documents.set(url,snapshot(url).catch(()=>null));return documents.get(url);}));
 const candidates=new Set<string>();for(const url of targets){const resource=await documents.get(url);if(resource)for(const href of webDocumentLinks(resource.html,resource.url))if(!targets.has(href))candidates.add(href);}
 const origins=new Map<string,string>();for(const href of candidates){const origin=new URL(href).origin;if(!origins.has(origin))origins.set(origin,href);}
 const linked=new Set([...new Set([...origins.values(),...candidates])].slice(0,32));
 const pending=[...linked];await Promise.all(Array.from({length:Math.min(6,pending.length)},async()=>{while(pending.length){const url=pending.shift();if(url===undefined)break;if(!checks.has(url))checks.set(url,checkExternalLink(url));await checks.get(url);}}));
 const manifest={pages:Object.fromEntries([...targets].flatMap(url=>{const asset=assets.get(url);return asset?[[url,asset]]:[];})),external:[...new Set([...targets,...linked])].filter(url=>external.has(url))},directory=path.join(cacheDirectory(),'manifests');
 await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,digest(page)+'.json'),JSON.stringify(manifest));
}
export async function copyWebDocuments(directory: URL){
 const output=fileURLToPath(directory),target=path.join(output,'data/web-pages');await fs.mkdir(target,{recursive:true});
 const index: Manifest={pages:{},external:new Set()};for(const name of await fs.readdir(output))if(name.endsWith('.html'))try{mergeManifest(index,JSON.parse(await fs.readFile(path.join(cacheDirectory(),'manifests',digest('/'+name)+'.json'),'utf8')));}catch{}
 for(const asset of Object.values(index.pages)){const file=path.basename(asset);if(/^[\da-f]{64}\.json$/.test(file))await fs.copyFile(path.join(cacheDirectory(),file),path.join(target,file));}
 await fs.writeFile(path.join(target,'index.json'),JSON.stringify(manifestIndex(index)));
 const vendor=path.join(output,'assets/darkreader');await fs.mkdir(vendor,{recursive:true});
 for(const name of ['darkreader.js','LICENSE'])await fs.copyFile(path.join(engineRoot(),name),path.join(vendor,name));
}
export async function webDocumentAsset(pathname: string){
 if(pathname==='/assets/darkreader/darkreader.js')return {file:path.join(engineRoot(),'darkreader.js'),type:'text/javascript'};
 if(pathname==='/assets/darkreader/LICENSE')return {file:path.join(engineRoot(),'LICENSE'),type:'text/plain'};
 if(pathname==='/data/web-pages/index.json'){
  const index: Manifest={pages:Object.fromEntries(assets),external:new Set(external)},directory=path.join(cacheDirectory(),'manifests');
  try{for(const file of await fs.readdir(directory))if(/^[\da-f]{64}\.json$/.test(file))mergeManifest(index,JSON.parse(await fs.readFile(path.join(directory,file),'utf8')));}catch{}
  return {body:JSON.stringify(manifestIndex(index)),type:'application/json'};
 }
 if(/^\/data\/web-pages\/[\da-f]{64}\.json$/.test(pathname))return {file:path.join(cacheDirectory(),path.basename(pathname)),type:'application/json'};
}
