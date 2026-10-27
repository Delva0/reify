import type {DocumentOptions, RenderRequest, RenderResponse, WorkerPort} from '../lib/data-types.js';
import {errorMessage} from '../lib/data-types.js';
const scope = (typeof self==='undefined'?globalThis:self) as unknown as WorkerPort<RenderRequest, RenderResponse>;
import {h} from 'preact';
import * as runtime from 'preact/jsx-runtime';
import {renderToString} from 'preact-render-to-string';
import {compileDocument} from '../build/document-compiler.js';
import {documentComponents} from '../lib/document-components.js';
import {documentMarkup} from '../build/document-markup.js';

// This adapter supplies only the JSX runtime and component implementations.
// Compilation, ID scoping, H1 pages and document markup are shared with SSR.
export async function renderDocument(source: string,options: DocumentOptions){
 const components=documentComponents();
 const Content=await compileDocument(source,{...options,components,runtime,runtimeName:'preact'});
 return documentMarkup(renderToString(h(Content,{components})),options);
}

if(typeof self!=='undefined')scope.onmessage=async({data:{job,source,options}})=>{
 try{
  scope.postMessage({job,html:await renderDocument(source,options)});
 }catch(error){
  scope.postMessage({job,error:errorMessage(error)});
 }
};
