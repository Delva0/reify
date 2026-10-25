#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const framework=path.dirname(fileURLToPath(import.meta.url));
const excluded=new Set(['.git','node_modules','.astro','.reify','dist','.openai']);
export function mirrorPackageConfig(pkg,lock){
 pkg=structuredClone(pkg);lock=lock&&structuredClone(lock);
 if(pkg.dependencies?.reify?.startsWith('file:')){
  pkg.dependencies.reify='file:../reify';
  if(lock){const link=lock.packages?.['node_modules/reify'];if(link?.link&&link.resolved!=='../reify'){lock.packages['../reify']=lock.packages[link.resolved];delete lock.packages[link.resolved];link.resolved='../reify';}lock.packages[''].dependencies.reify=pkg.dependencies.reify;}
 }
 return {pkg,lock};
}
const copy=(source,target)=>fs.cpSync(source,target,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>excluded.has(part))});
function command(args,cwd){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd,stdio:'inherit',env:process.env});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('命令退出：'+code)));});}
async function install(directory){
 const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),lock=path.join(directory,'package-lock.json');
 if(!fs.existsSync(lock))await command([npm,'install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'],directory);
 const digest=createHash('sha256').update(fs.readFileSync(lock)).update(fs.readFileSync(path.join(directory,'package.json'))).digest('hex'),marker=path.join(directory,'node_modules/.reify-lock');
 if(!fs.existsSync(marker)||fs.readFileSync(marker,'utf8')!==digest){await command([npm,'ci','--ignore-scripts','--prefer-offline','--no-audit','--no-fund'],directory);fs.writeFileSync(marker,digest);}
}
function watchInputs(source,target){
 const scan=()=>{const files=new Map();const walk=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(excluded.has(entry.name))continue;const file=path.join(directory,entry.name),relative=path.relative(source,file);if(/^public[\\/]data[\\/](file-cache|highlight|trees)([\\/]|$)/.test(relative))continue;if(entry.isDirectory())walk(file);else{const stat=fs.statSync(file);files.set(relative,stat.mtimeMs+':'+stat.size);}}};walk(source);return files;};
 let previous=scan();return setInterval(()=>{const next=scan();for(const [file,stamp]of next)if(previous.get(file)!==stamp){const destination=path.join(target,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(source,file),destination);}for(const file of previous.keys())if(!next.has(file))fs.rmSync(path.join(target,file),{force:true});previous=next;},2000);
}
export async function runReify(action='dev',{root=process.cwd(),args=[]}={}){
 root=path.resolve(root);const mirrored=process.platform==='win32'&&root.startsWith('\\\\');
 let project=root,packageRoot=framework;
 if(mirrored){
  let cache=path.join(process.env.LOCALAPPDATA||os.tmpdir(),'Reify',createHash('sha256').update(root).digest('hex').slice(0,12));fs.mkdirSync(cache,{recursive:true});cache=fs.realpathSync.native(cache);
  project=path.join(cache,'site');packageRoot=path.join(cache,'reify');fs.mkdirSync(project,{recursive:true});fs.mkdirSync(packageRoot,{recursive:true});copy(framework,packageRoot);copy(root,project);
  const packageFile=path.join(project,'package.json'),lockFile=path.join(project,'package-lock.json'),result=mirrorPackageConfig(JSON.parse(fs.readFileSync(packageFile,'utf8')),fs.existsSync(lockFile)?JSON.parse(fs.readFileSync(lockFile,'utf8')):null);
  fs.writeFileSync(packageFile,JSON.stringify(result.pkg,null,2)+'\n');if(result.lock)fs.writeFileSync(lockFile,JSON.stringify(result.lock,null,2)+'\n');
 }
 const canResolve=(directory,id)=>{try{return createRequire(path.join(directory,'package.json')).resolve(id);}catch{return null;}};
 if(mirrored||!canResolve(packageRoot,'astro/package.json'))await install(packageRoot);
 if(mirrored||!canResolve(project,'reify/config'))await install(project);
 if(mirrored){const link=path.join(project,'node_modules/reify');if(fs.lstatSync(link,{throwIfNoEntry:false})?.isSymbolicLink()&&!fs.existsSync(link)){try{fs.unlinkSync(link);}catch{fs.rmdirSync(link);}fs.symlinkSync(packageRoot,link,'junction');}}
 if(action==='test'){const files=fs.readdirSync(path.join(packageRoot,'tests')).filter(file=>file.endsWith('.test.mjs')).map(file=>'tests/'+file);await command(['--test',...files],packageRoot);return;}
 if(action==='check'){await command(['check.mjs'],project);return;}
 if(!['dev','build','preview'].includes(action))throw Error('未知命令：'+action);
 const cli=path.join(path.dirname(canResolve(packageRoot,'astro/package.json')),'bin/astro.mjs');
 const timers=mirrored&&action==='dev'?[watchInputs(framework,packageRoot),watchInputs(root,project)]:[];
 const cleanup=()=>timers.forEach(clearInterval);process.once('SIGINT',cleanup);process.once('SIGTERM',cleanup);
 try{await command([cli,action,...(action==='build'?[]:['--host','127.0.0.1',...(args.includes('--port')?[]:['--port',process.env.ASTRO_PORT||'4179'])]),...args],project);}finally{cleanup();}
 if(mirrored&&action==='build')fs.cpSync(path.join(project,'dist'),path.join(root,'dist'),{recursive:true});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const values=process.argv.slice(2),action=values.shift()||'dev',at=values.indexOf('--root'),root=at>=0?values.splice(at,2)[1]:fs.existsSync(path.join(process.cwd(),'reify.config.json'))?process.cwd():path.join(framework,'examples/minimal');
 await runReify(action,{root,args:values});
}
