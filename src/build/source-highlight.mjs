import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {codeToHtml} from 'shiki';
import {sourceLanguage} from '../lib/code-language.js';
import {readSiteConfig} from '../site-config.mjs';

export async function sourceHighlightAssets(root){
 const site=readSiteConfig(root),directory=site.publicDir;
 const snapshots=[...new Set(site.repositories.flatMap(repository=>repository.versions.map(version=>version.snapshot).filter(Boolean)))];
 for(const snapshot of snapshots){
 const json=await fs.readFile(path.join(directory,snapshot),'utf8'),data=JSON.parse(json);
 const files=data.files.filter(file=>typeof file.text==='string');
 const target=path.join(directory,'data/highlight',data.sha),manifest=path.join(target,'manifest.json');
 const digest=createHash('sha256').update(json+'github-light/github-dark/shiki-4.5.0').digest('hex');
 try{const old=JSON.parse(await fs.readFile(manifest,'utf8'));if(old.digest===digest&&(await Promise.all(files.map(file=>fs.access(path.join(target,file.path+'.html')).then(()=>true,()=>false)))).every(Boolean))continue;}catch{}
 for(const file of files){
  const html=await codeToHtml(file.text,{lang:sourceLanguage(file.path),themes:{light:'github-light',dark:'github-dark'}});
  const output=path.join(target,file.path+'.html');await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,html);
 }
 await fs.writeFile(manifest,JSON.stringify({digest,commit:data.sha,files:files.map(file=>file.path)}));
}}
