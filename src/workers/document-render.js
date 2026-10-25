import {h} from 'preact';
import * as runtime from 'preact/jsx-runtime';
import {renderToString} from 'preact-render-to-string';
import {compileDocument} from '../build/document-compiler.mjs';
import {documentComponents} from '../lib/document-components.js';
import {documentMarkup} from '../build/document-markup.mjs';
export async function renderDocument(source,options){
 const components=documentComponents(),Content=await compileDocument(source,{...options,components,runtime,runtimeName:'preact'});
 return documentMarkup(renderToString(h(Content,{components})),options);
}
if(typeof self!=='undefined')self.onmessage=async({data:{job,source,options}})=>{
 try{self.postMessage({job,html:await renderDocument(source,options)});}catch(error){self.postMessage({job,error:error.message||String(error)});}
};
