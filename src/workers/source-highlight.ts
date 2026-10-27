import type {HighlightRequest, HighlightResponse, WorkerPort} from '../lib/data-types.js';
import {errorMessage} from '../lib/data-types.js';
const scope = (typeof self==='undefined'?globalThis:self) as unknown as WorkerPort<HighlightRequest, HighlightResponse>;
import {createHighlighterCore} from 'shiki/core';
import {createJavaScriptRegexEngine} from 'shiki/engine/javascript';

const languages: Record<string, () => Promise<{default: import("shiki").LanguageRegistration | import("shiki").LanguageRegistration[]}>>={
 cpp:()=>import('@shikijs/langs/cpp'),c:()=>import('@shikijs/langs/c'),python:()=>import('@shikijs/langs/python'),
 bash:()=>import('@shikijs/langs/bash'),json:()=>import('@shikijs/langs/json'),yaml:()=>import('@shikijs/langs/yaml'),
 cmake:()=>import('@shikijs/langs/cmake'),protobuf:()=>import('@shikijs/langs/proto'),markdown:()=>import('@shikijs/langs/markdown'),
 mdx:()=>Promise.all([import('@shikijs/langs/mdx'),import('@shikijs/langs/tsx')]).then(modules=>({default:modules.flatMap(module=>module.default)})),
 dockerfile:()=>import('@shikijs/langs/dockerfile'),javascript:()=>import('@shikijs/langs/javascript'),typescript:()=>import('@shikijs/langs/typescript'),
 rust:()=>import('@shikijs/langs/rust'),go:()=>import('@shikijs/langs/go'),html:()=>import('@shikijs/langs/html'),
 css:()=>import('@shikijs/langs/css'),toml:()=>import('@shikijs/langs/toml'),xml:()=>import('@shikijs/langs/xml'),
 ini:()=>import('@shikijs/langs/ini'),diff:()=>import('@shikijs/langs/diff')
};
const highlighter=createHighlighterCore({engine:createJavaScriptRegexEngine(),themes:[import('@shikijs/themes/github-light'),import('@shikijs/themes/github-dark')]});
const loaded=new Map();
scope.onmessage=async({data:{id,text,language}})=>{
 try{
  const engine=await highlighter;
  if(languages[language]&&!loaded.has(language))loaded.set(language,languages[language]().then(module=>engine.loadLanguage(module.default)));
  if(loaded.has(language))await loaded.get(language);
  const html=engine.codeToHtml(text,{lang:language==='protobuf'?'proto':languages[language]?language:'text',themes:{light:'github-light',dark:'github-dark'},defaultColor:'light'});
  scope.postMessage({id,html});
 }catch(error){scope.postMessage({id,error:String(errorMessage(error)||error)});}
};
