import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isRecord,jsonRecord,string,optionalString,stringMap} from './build/data.js';
import type {MathAliases} from './math-style.js';
export interface NavigationPage {id: string; source: string; page: string; title?: string; group?: string; [key: string]: unknown}
export interface RepositoryVersion {id: string; label: string; commit: string; source: string; snapshot?: string; facts?: string; [key: string]: unknown}
export interface Repository {id: string; name: string; page: string; title?: string; defaultVersion: string; versions: RepositoryVersion[]; [key: string]: unknown}
export interface SiteConfig {
 [key: string]: unknown;
 root: string; configFile: string; title: string; home: string; navigationLabel: string;
 content?: string; public?: string; contentDir: string; publicDir: string; repositories: Repository[];
 pages: NavigationPage[]; fileMaps: Record<string,unknown>; components: Record<string,string>; scripts: string[]; mathAliases?: MathAliases;
}
function page(value: unknown): NavigationPage{if(!isRecord(value))throw Error('导航页面无效');return {...value,id:string(value.id,'id'),source:string(value.source,'source'),page:string(value.page,'page'),title:optionalString(value.title,'title'),group:optionalString(value.group,'group')};}
function repository(value: unknown): Repository{
 if(!isRecord(value)||!Array.isArray(value.versions))throw Error('仓库配置无效');
 const versions=value.versions.map((item: unknown): RepositoryVersion=>{if(!isRecord(item))throw Error('仓库版本无效');return {...item,id:string(item.id,'id'),label:string(item.label,'label'),commit:string(item.commit,'commit'),source:string(item.source,'source'),snapshot:optionalString(item.snapshot,'snapshot'),facts:optionalString(item.facts,'facts')};});
 return {...value,id:string(value.id,'id'),name:string(value.name,'name'),page:string(value.page,'page'),title:optionalString(value.title,'title'),defaultVersion:string(value.defaultVersion,'defaultVersion'),versions};
}
export function readSiteConfig(directory: string | URL=process.env.REIFY_PROJECT_ROOT||process.cwd()): SiteConfig{
 const root=path.resolve(directory instanceof URL?fileURLToPath(directory):directory),configFile=path.join(root,'reify.config.json');
 const input=fs.existsSync(configFile)?jsonRecord(fs.readFileSync(configFile,'utf8')):{};
 const resolve=(value: string)=>path.resolve(root,value);
 const repositoryData: unknown=input.repositories?JSON.parse(fs.readFileSync(resolve(string(input.repositories,'repositories')),'utf8')):[];
 if(!Array.isArray(repositoryData))throw Error('repositories 必须是数组');
 const repositories=repositoryData.map(repository),pageData=input.pages||[];
 if(!Array.isArray(pageData))throw Error('pages 必须是数组');const pages=pageData.map(page);
 const ids=new Set<string>();for(const item of [...repositories,...pages]){if(ids.has(item.id))throw Error('导航 id 必须唯一');ids.add(item.id);}
 const readData=(file: unknown)=>file?jsonRecord(fs.readFileSync(resolve(string(file,'数据文件')),'utf8')):{};
 const content=optionalString(input.content,'content'),publicPath=optionalString(input.public,'public');
 const components=Object.fromEntries(Object.entries(stringMap(input.components||{},'components')).map(([name,file])=>{if(!/^[A-Z]\w*$/.test(name))throw Error('组件名称无效：'+name);return [name,resolve(file)];}));
 const scripts=input.scripts||[];if(!Array.isArray(scripts))throw Error('scripts 必须是数组');
 let mathAliases: MathAliases | undefined;
 if(input.mathAliases!==undefined){if(!isRecord(input.mathAliases))throw Error('mathAliases 必须是对象');mathAliases={};for(const [role,names]of Object.entries(input.mathAliases)){if(role!=='primary'&&role!=='secondary'||!Array.isArray(names)||names.some((name: unknown)=>typeof name!=='string'))throw Error('数学宏别名无效');mathAliases[role]=names.map(name=>string(name,'数学宏别名'));}}
 return {...input,root,configFile,title:optionalString(input.title,'title')||'Reify',home:optionalString(input.home,'home')||'index.html',navigationLabel:optionalString(input.navigationLabel,'navigationLabel')||'文章',content,public:publicPath,contentDir:resolve(content||'content'),publicDir:resolve(publicPath||'public'),repositories,pages,fileMaps:readData(input.fileMaps),components,scripts:scripts.map(item=>resolve(string(item,'script'))),mathAliases};
}
export function readFacts(file?: string,site=readSiteConfig()){
 return file?jsonRecord(fs.readFileSync(path.resolve(site.root,file),'utf8'),'facts'):{repositories:{},facts:[]};
}
