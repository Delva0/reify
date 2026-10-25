import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function readSiteConfig(root=process.env.REIFY_PROJECT_ROOT||process.cwd()){
 root=path.resolve(root instanceof URL?fileURLToPath(root):root);
 const configFile=path.join(root,'reify.config.json');
 const input=fs.existsSync(configFile)?JSON.parse(fs.readFileSync(configFile,'utf8')):{};
 const resolve=value=>path.resolve(root,value);
 const repositories=input.repositories?JSON.parse(fs.readFileSync(resolve(input.repositories),'utf8')):[];
 const pages=input.pages||[];
 const ids=new Set();for(const item of [...repositories,...pages]){if(typeof item.id!=='string'||ids.has(item.id))throw Error('导航 id 必须唯一');ids.add(item.id);}
 const readData=file=>file?JSON.parse(fs.readFileSync(resolve(file),'utf8')):{};
 return {...input,root,configFile,title:input.title||'Reify',home:input.home||'index.html',navigationLabel:input.navigationLabel||'文章',contentDir:resolve(input.content||'content'),publicDir:resolve(input.public||'public'),repositories,pages,fileMaps:readData(input.fileMaps),components:Object.fromEntries(Object.entries(input.components||{}).map(([name,file])=>{if(!/^[A-Z]\w*$/.test(name))throw Error('组件名称无效：'+name);return [name,resolve(file)];})),scripts:(input.scripts||[]).map(resolve)};
}
export function readFacts(file,site=readSiteConfig()){
 return file?JSON.parse(fs.readFileSync(path.resolve(site.root,file),'utf8')):{repositories:{},facts:[]};
}
