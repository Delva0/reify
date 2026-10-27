import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import type {ChildProcess} from 'node:child_process';
const root=fileURLToPath(new URL('..',import.meta.url)),source=path.join(root,'src'),output=path.join(root,'dist');
function compile(watching: true,project?: string): ChildProcess;
function compile(watching?: false,project?: string): Promise<void>;
function compile(watching=false,project='tsconfig.build.json'): ChildProcess | Promise<void>{
 const child=spawn(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'-p',project,...(watching?['--watch','--preserveWatchOutput']:[])],{cwd:root,stdio:'inherit'});
 if(watching)return child;
 return new Promise<void>((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Runtime compilation failed: '+code)));});
}
async function assets(){
 await fs.cp(source,output,{recursive:true,filter:file=>{
  const relative=path.relative(source,file);
  return relative.startsWith('vendor'+path.sep)?!file.endsWith('.ts')||file.endsWith('.d.ts'):!/[.](?:[cm]?js|ts|map)$/.test(file);
 }});
}
const isAsset=(file: string)=>file.startsWith('vendor'+path.sep)?!file.endsWith('.ts')||file.endsWith('.d.ts'):!/[.](?:[cm]?js|ts|map)$/.test(file);
async function copyAsset(relative: string){
 const file=path.resolve(source,relative),target=path.resolve(output,relative);
 if(!file.startsWith(source+path.sep)||!target.startsWith(output+path.sep))throw Error('Invalid asset path');
 const stat=await fs.stat(file).catch(()=>null);
 if(!stat){await fs.rm(target,{recursive:true,force:true});return;}
 if(stat.isDirectory())return;
 await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(file,target);
}
async function assetSnapshot(){
 const result=new Map<string,string>();
 for(const entry of await fs.readdir(source,{recursive:true,withFileTypes:true})){
  if(!entry.isFile())continue;
  const relative=path.relative(source,path.join(entry.parentPath,entry.name));if(!isAsset(relative))continue;
  const stat=await fs.stat(path.join(source,relative));result.set(relative,stat.mtimeMs+':'+stat.size);
 }
 return result;
}
if(!process.argv.includes('--watch')){
 await compile(false,'tsconfig.workers.json');
 if(path.dirname(output)!==path.resolve(root))throw Error('Invalid runtime output directory');
 await fs.rm(output,{recursive:true,force:true});
 await compile();
}
await assets();
if(process.argv.includes('--watch')){
 const compiler=compile(true),workerChecker=compile(true,'tsconfig.workers.json');let previous=await assetSnapshot(),copying=Promise.resolve();
 // WSL/UNC file events may be missing. Poll only asset metadata and copy changes.
 const timer=setInterval(()=>{copying=copying.then(async()=>{
  const next=await assetSnapshot();
  for(const [file,stamp]of next)if(previous.get(file)!==stamp)await copyAsset(file);
  for(const file of previous.keys())if(!next.has(file))await copyAsset(file);
  previous=next;
 }).catch(error=>console.error(error));},500);
 const stop=()=>{clearInterval(timer);compiler.kill();workerChecker.kill();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
