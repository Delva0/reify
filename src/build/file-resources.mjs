import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {codeToHtml} from 'shiki';
import {readSiteConfig} from '../site-config.mjs';
import {internalCodeTargets} from '../lib/code-links.js';
import {fileResource} from '../lib/file-resource.js';
import {readFile,encodeFilePath} from '../lib/github-files.js';
import {resourceLanguage} from '../lib/code-language.js';
import {articleBasePath} from '../lib/article-pages.js';
import {parseFragment} from 'parse5';
import {resolveCodeAnnotations} from '../lib/code-annotations.js';
import {parseFpUrl} from '../lib/fp-links.js';

let publicDir,repositories,cacheDir;
function configureResources(){if(publicDir)return;({publicDir,repositories}=readSiteConfig());cacheDir=path.join(publicDir,'data/file-cache');}
const pending=new Map(),entries={},snapshots=new Map();let writing=Promise.resolve();
const digest=value=>createHash('sha256').update(value).digest('hex');
const canonical=pathname=>(pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/index');
async function writeChanged(file,value){await fs.mkdir(path.dirname(file),{recursive:true});try{if(await fs.readFile(file,'utf8')===value)return;}catch{}await fs.writeFile(file,value);}
function contextFor(pathname){const base=articleBasePath(pathname);for(const repository of repositories)for(const version of repository.versions)if(base==='/'+repository.id+'-'+version.id||(version.id===repository.defaultVersion&&base===canonical('/'+repository.page)))return {repository:repository.name,commit:version.commit,snapshot:version.snapshot};}
async function prepareResource(resource,context){
 const key=digest('file-resource-v1:'+resource.url),record=path.join(cacheDir,key+'.json');
 if(context?.snapshot&&!snapshots.has(context.snapshot))snapshots.set(context.snapshot,fs.readFile(path.join(publicDir,context.snapshot),'utf8').then(JSON.parse));
 const local=context?.snapshot?await snapshots.get(context.snapshot):null,source=local&&context.commit===local.sha&&resource.url===`https://raw.githubusercontent.com/${context.repository}/${local.sha}/${encodeFilePath(resource.path)}`&&local.files.find(file=>file.path===resource.path&&typeof file.text==='string');
 if(source)return {kind:'code',language:resource.language,lines:source.text.split('\n').length,asset:'/data/highlight/'+local.sha+'/'+encodeFilePath(resource.path)+'.html'};
 let old;try{old=JSON.parse(await fs.readFile(record,'utf8'));if(old.asset)await fs.access(path.join(publicDir,old.asset));if(/\/[\da-f]{40}\//i.test(resource.url))return old;}catch{old=undefined;}
 const response=await fetch(resource.url,{signal:AbortSignal.timeout(20000),headers:{...(old?.etag?{'If-None-Match':old.etag}:{}),...(old?.modified?{'If-Modified-Since':old.modified}:{})}});
 if(response.status===304&&old)return old;
 const file=await readFile(resource.url,undefined,{fetcher:async()=>response});
 let result={kind:file.kind,message:file.message,etag:response.headers.get('etag'),modified:response.headers.get('last-modified')};
 if(file.kind==='text'){
  const language=resourceLanguage(resource.path,file.contentType);
  const html=await codeToHtml(file.text,{lang:language,themes:{light:'github-light',dark:'github-dark'}}),asset='/data/file-cache/'+key+'/'+digest(html)+'.html';
  await writeChanged(path.join(publicDir,asset),html);result={...result,kind:'code',asset,language,lines:file.text.split('\n').length};
 }else if(file.kind==='image'){
  const bytes=Buffer.from(await file.blob.arrayBuffer()),extension=path.extname(resource.path).replace(/[^.\w]/g,'')||'.bin',asset='/data/file-cache/'+key+'/'+digest(bytes)+extension;
  await fs.mkdir(path.dirname(path.join(publicDir,asset)),{recursive:true});await fs.writeFile(path.join(publicDir,asset),bytes);result={...result,asset,mime:file.blob.type};
 }
 await writeChanged(record,JSON.stringify(result));return result;
}
function cachedResource(resource,context){
 if(!pending.has(resource.url))pending.set(resource.url,prepareResource(resource,context).then(entry=>(entries[resource.url]=entry)).catch(error=>{pending.delete(resource.url);throw Error(resource.url+': '+error.message);}));return pending.get(resource.url);
}
const textOf=node=>node.nodeName==='#text'?node.value:(node.childNodes||[]).map(textOf).join('');
const codeSources=new Map();
async function sourceText(resource,context){
 if(!codeSources.has(resource.url))codeSources.set(resource.url,(async()=>{const entry=await cachedResource(resource,context);if(entry.kind!=='code')throw Error(resource.title+': CodeBlock src 必须是文本文件');const html=await fs.readFile(path.join(publicDir,decodeURIComponent(entry.asset)),'utf8');return {code:textOf(parseFragment(html)),language:entry.language};})().catch(error=>{codeSources.delete(resource.url);throw error;}));
 return codeSources.get(resource.url);
}
export async function loadCodeSource(src,page){configureResources();const context=contextFor(page),resource=fileResource(src,context);return {...await sourceText(resource,context),url:resource.url};}
export async function prepareArticleResources(hrefs,page,blocks={},anchors={}){
 configureResources();
 const base=new URL(page,'https://article.local'),resources={},targets=[];
 for(const href of [...hrefs,...Object.values(blocks).flatMap(block=>block.links.map(link=>link.href))])for(const {props}of parseFpUrl(href,base,{samePage:false})||[]){const url=new URL(href,base);if(props.block&&articleBasePath(url.pathname)===articleBasePath(base.pathname)&&!Object.hasOwn(anchors,props.block))throw Error('代码块不存在：'+props.block);}
 const definitions=Object.values(blocks),queue=[...definitions];
 await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{while(queue.length){const block=queue.shift(),source=block.src?await loadCodeSource(block.src,page):{code:block.code};try{resolveCodeAnnotations(source.code,block);if(block.ranges.some(range=>range.to>source.code.split('\n').length))throw Error('行范围超出代码');}catch(error){throw Error(block.id+': '+error.message);}}}));
 for(const {target,url}of internalCodeTargets(hrefs||[],base,blocks)){const context=contextFor(url.pathname),resource=fileResource(target.file,context);targets.push({target,resource,context});}
 const files=[...targets];await Promise.all(Array.from({length:Math.min(4,files.length)},async()=>{while(files.length){const {resource,context,target}=files.shift(),entry=await cachedResource(resource,context);if(entry.lines&&target.ranges.some(range=>range.to>entry.lines))throw Error(resource.title+': 行范围超出文件');resources[resource.url]=entry;}}));
 if(targets.length)writing=writing.then(async()=>{let previous={};try{previous=JSON.parse(await fs.readFile(path.join(cacheDir,'index.json'),'utf8'));}catch{}await writeChanged(path.join(cacheDir,'index.json'),JSON.stringify({...previous,...entries}));});await writing;return resources;
}
export async function copyFileResources(directory){
 configureResources();
 const output=fileURLToPath(directory),index={...entries};await writing;
 try{await fs.access(cacheDir);await fs.cp(cacheDir,path.join(output,'data/file-cache'),{recursive:true});}catch(error){if(error.code!=='ENOENT')throw error;}
 for(const name of await fs.readdir(output))if(name.endsWith('.html')){const html=await fs.readFile(path.join(output,name),'utf8'),json=html.match(/<script id="file-resources"[^>]*>([\s\S]*?)<\/script>/)?.[1];if(json)Object.assign(index,JSON.parse(json));}
 await writeChanged(path.join(output,'data/file-cache/index.json'),JSON.stringify(index));
}
