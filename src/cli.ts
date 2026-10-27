#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const framework=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
interface PackageManifest {dependencies?: Record<string,string>; [key: string]: unknown}
interface LockPackage {dependencies?: Record<string,string>; link?: boolean; resolved?: string; [key: string]: unknown}
interface PackageLock {packages?: Record<string,LockPackage>; [key: string]: unknown}
interface RunOptions {root?: string; args?: string[]}
const record=(value: unknown): value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function dependencies(value: unknown): Record<string,string> | undefined {if(value===undefined)return;if(!record(value)||Object.values(value).some(item=>typeof item!=='string'))throw Error('Invalid package dependencies');return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,String(item)]));}
function readManifest(file: string): PackageManifest {const value: unknown=JSON.parse(fs.readFileSync(file,'utf8'));if(!record(value))throw Error('Invalid package manifest');return {...value,dependencies:dependencies(value.dependencies)};}
function readLock(file: string): PackageLock {const value: unknown=JSON.parse(fs.readFileSync(file,'utf8'));if(!record(value)||!record(value.packages))throw Error('Invalid package lock');const packages: Record<string,LockPackage>={};for(const [key,item]of Object.entries(value.packages)){if(!record(item)||item.resolved!==undefined&&typeof item.resolved!=='string'||item.link!==undefined&&typeof item.link!=='boolean')throw Error('Invalid package lock entry');packages[key]={...item,dependencies:dependencies(item.dependencies),resolved:item.resolved,link:item.link};}return {...value,packages};}
const excluded=new Set(['.git','node_modules','.astro','.reify','dist','.openai']);
export function mirrorPackageConfig<P extends PackageManifest,L extends PackageLock | null>(pkg: P,lock: L){
 pkg=structuredClone(pkg);lock=structuredClone(lock);
 if(pkg.dependencies?.reify?.startsWith('file:')){
  pkg.dependencies.reify='file:../reify';
  if(lock?.packages){const packages=lock.packages,link=packages['node_modules/reify'];if(link?.link&&link.resolved&&link.resolved!=='../reify'){packages['../reify']=packages[link.resolved];delete packages[link.resolved];link.resolved='../reify';}const entry=packages[''];if(entry){entry.dependencies??={};entry.dependencies.reify=pkg.dependencies.reify;}}
 }
 return {pkg,lock};
}
const copy=(source: string,target: string)=>fs.cpSync(source,target,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>excluded.has(part))});
function command(args: string[],cwd: string){return new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd,stdio:'inherit',env:process.env});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('命令退出：'+code)));});}
async function install(directory: string){
 const npm=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js'),lock=path.join(directory,'package-lock.json');
 if(!fs.existsSync(lock))await command([npm,'install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'],directory);
 const digest=createHash('sha256').update(fs.readFileSync(lock)).update(fs.readFileSync(path.join(directory,'package.json'))).digest('hex'),marker=path.join(directory,'node_modules/.reify-lock');
 if(!fs.existsSync(marker)||fs.readFileSync(marker,'utf8')!==digest){await command([npm,'ci','--ignore-scripts','--prefer-offline','--no-audit','--no-fund'],directory);fs.writeFileSync(marker,digest);}
}
function watchInputs(source: string,target: string){
 const scan=()=>{const files=new Map<string,string>();const walk=(directory: string)=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(excluded.has(entry.name))continue;const file=path.join(directory,entry.name),relative=path.relative(source,file);if(/^public[\\/]data[\\/](file-cache|highlight|trees)([\\/]|$)/.test(relative))continue;if(entry.isDirectory())walk(file);else{const stat=fs.statSync(file);files.set(relative,stat.mtimeMs+':'+stat.size);}}};walk(source);return files;};
 let previous=scan();return setInterval(()=>{const next=scan();for(const [file,stamp]of next)if(previous.get(file)!==stamp){const destination=path.join(target,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(source,file),destination);}for(const file of previous.keys())if(!next.has(file))fs.rmSync(path.join(target,file),{force:true});previous=next;},2000);
}
export async function runReify(action='dev',{root=process.cwd(),args=[]}: RunOptions={}){
 root=path.resolve(root);const mirrored=process.platform==='win32'&&root.startsWith('\\\\');
 let project=root,packageRoot=framework;
 if(mirrored){
  let cache=path.join(process.env.LOCALAPPDATA||os.tmpdir(),'Reify',createHash('sha256').update(root).digest('hex').slice(0,12));fs.mkdirSync(cache,{recursive:true});cache=fs.realpathSync.native(cache);
  project=path.join(cache,'site');packageRoot=path.join(cache,'reify');fs.mkdirSync(project,{recursive:true});fs.mkdirSync(packageRoot,{recursive:true});copy(framework,packageRoot);copy(root,project);
  const packageFile=path.join(project,'package.json'),lockFile=path.join(project,'package-lock.json'),result=mirrorPackageConfig(readManifest(packageFile),fs.existsSync(lockFile)?readLock(lockFile):null);
  fs.writeFileSync(packageFile,JSON.stringify(result.pkg,null,2)+'\n');if(result.lock)fs.writeFileSync(lockFile,JSON.stringify(result.lock,null,2)+'\n');
 }
 const canResolve=(directory: string,id: string)=>{try{return createRequire(path.join(directory,'package.json')).resolve(id);}catch{return null;}};
 if(mirrored||!canResolve(packageRoot,'astro/package.json'))await install(packageRoot);
 if(mirrored||!canResolve(project,'reify/config'))await install(project);
 if(mirrored){const link=path.join(project,'node_modules/reify');if(fs.lstatSync(link,{throwIfNoEntry:false})?.isSymbolicLink()&&!fs.existsSync(link)){try{fs.unlinkSync(link);}catch{fs.rmdirSync(link);}fs.symlinkSync(packageRoot,link,'junction');}}
 const runtimeBuild=path.join(packageRoot,'scripts/build-runtime.mjs');
 if(action!=='preview'&&fs.existsSync(runtimeBuild))await command([runtimeBuild],packageRoot);
 if(action==='test'){const files=fs.readdirSync(path.join(packageRoot,'tests')).filter(file=>file.endsWith('.test.mjs')).map(file=>'tests/'+file);await command(['--test',...files],packageRoot);return;}
 if(action==='check'){await command(['check.mjs'],project);return;}
 if(!['dev','build','preview'].includes(action))throw Error('未知命令：'+action);
 const astroPackage=canResolve(packageRoot,'astro/package.json');if(!astroPackage)throw Error('Astro is not installed');
 const cli=path.join(path.dirname(astroPackage),'bin/astro.mjs');
 const timers=mirrored&&action==='dev'?[watchInputs(framework,packageRoot),watchInputs(root,project)]:[];
 const compiler=action==='dev'&&fs.existsSync(runtimeBuild)?spawn(process.execPath,[runtimeBuild,'--watch'],{cwd:packageRoot,stdio:'inherit',env:process.env}):null;
 const cleanup=()=>{timers.forEach(clearInterval);compiler?.kill();};process.once('SIGINT',cleanup);process.once('SIGTERM',cleanup);
 try{await command([cli,action,...(action==='build'?[]:['--host','127.0.0.1',...(args.includes('--port')?[]:['--port',process.env.ASTRO_PORT||'4179'])]),...args],project);}finally{cleanup();}
 if(mirrored&&action==='build')fs.cpSync(path.join(project,'dist'),path.join(root,'dist'),{recursive:true});
}
export async function main(){
 const values=process.argv.slice(2),action=values.shift()||'dev',at=values.indexOf('--root'),root=at>=0?values.splice(at,2)[1]:fs.existsSync(path.join(process.cwd(),'reify.config.json'))?process.cwd():path.join(framework,'examples/minimal');
 await runReify(action,{root,args:values});
}
