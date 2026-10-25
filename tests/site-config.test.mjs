import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readSiteConfig,readFacts} from '../src/site-config.mjs';
import {createMathMacros,mathMacros} from '../src/math-style.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'reify-config-'));
try{
 fs.writeFileSync(path.join(root,'reify.config.json'),JSON.stringify({title:'Independent notebook',pages:[{id:'start',source:'start.mdx',page:'index.html'}]}));
 const config=readSiteConfig(root);assert.equal(config.title,'Independent notebook');assert.deepEqual(config.repositories,[]);assert.equal(config.contentDir,path.join(root,'content'));assert.deepEqual(readFacts(undefined,config),{repositories:{},facts:[]});
 fs.writeFileSync(path.join(root,'maps.json'),'{"example":[]}');fs.writeFileSync(path.join(root,'reify.config.json'),JSON.stringify({fileMaps:'maps.json',components:{Experiment:'./src/Experiment.astro'},scripts:['./src/client.js']}));
 const custom=readSiteConfig(root);assert.equal(custom.components.Experiment,path.join(root,'src/Experiment.astro'));assert.deepEqual(custom.fileMaps,{example:[]});assert.equal(custom.scripts[0],path.join(root,'src/client.js'));
 assert(!Object.hasOwn(mathMacros,'\\request'));assert.equal(createMathMacros({primary:['input']})['\\input'],'\\textcolor{steelblue}{#1}');assert.throws(()=>createMathMacros({unknown:['input']}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log('Site config supports independent articles, custom components and data without a repository or topic-specific defaults');
