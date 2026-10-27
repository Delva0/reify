import type {CodeDefinition,ReadingContext} from '../lib/data-types.js';
import type {CodeAnnotations} from '../lib/code-annotations.js';
import type {CodeDialogUpdate} from './code-dialog.js';
import {errorMessage} from '../lib/data-types.js';
import {$} from '../lib/dom.js';
import {createCodeDialog} from './code-dialog.js';
import {registerFpType} from './fp-navigation.js';
import {readFile} from '../lib/github-files.js';
import {fileResource,fileResourceTitle} from '../lib/file-resource.js';
import {isWebFile} from '../lib/code-props.js';
import {languageLabel,resourceLanguage} from '../lib/code-language.js';
import {cachedFileResource} from './file-resources.js';
import {bundledSource} from './sources.js';
import {articleCodeBlock} from './article-pages.js';
import {codeBlockDefinition,normalizeCodeBlock} from '../lib/code-block.js';
import {hasCodeAnnotations} from '../lib/code-annotations.js';
import {documentFormat} from '../lib/document-format.js';
import {readingContext,setReadingContext} from '../lib/reading-context.js';

export function initCodeViewers(){registerFpType('code',(props,context)=>{
 const {origin,parentsReady=[]}=context,viewer=createCodeDialog(context);
 let resourceContext: ReadingContext | null=context.restore?.resourceContext||(origin?readingContext(origin):context.parentPanel?null:readingContext());
 if(resourceContext)setReadingContext(viewer.panel,resourceContext);
 const resolveResource=(file: string)=>{if(!resourceContext)throw Error('文件上下文尚未就绪');return fileResource(!isWebFile(file)&&!resourceContext.repositoryName?new URL(file,resourceContext.url).href:file,{repository:resourceContext.repositoryName,commit:resourceContext.commit});};
 let retainedDefinition=context.restore?.definition;
 const snapshot=viewer.snapshot;viewer.snapshot=()=>({...snapshot(),...(resourceContext?{resourceContext}:{}),...(retainedDefinition?{definition:retainedDefinition}:{})});
 const load=async()=>{
  let current=viewer.update({title:'代码',message:'读取代码…'}),file=props.file,ranges=props.ranges||[],annotations: Partial<CodeAnnotations>={},definition: CodeDefinition | null | undefined,sourceOrigin=origin;
  const alive=()=>viewer.alive(current);
  const documentView=async(pre: HTMLElement,{src=file,language='text',prepared}: {src?: string; language?: string; prepared?: HTMLElement | null}={})=>{
   const format=documentFormat({src,language});if(!format)return;
   const identity=definition?.id||src||props.block,digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity||'')),referencePrefix='doc-'+Array.from(new Uint8Array(digest)).slice(0,8).map(byte=>byte.toString(16).padStart(2,'0')).join(''),id=referencePrefix+'-'+context.sessionId;
   const options={id,referencePrefix,title:src||language,sourceUrl:src?resolveResource(src).url:undefined};
   if(prepared){
    const payload=JSON.parse(prepared.dataset.documentData||'null');
    if(payload){const {documentMarkup}=await import('../build/document-markup.js');return new DOMParser().parseFromString(documentMarkup(payload.pages.map((page: {html: string})=>page.html).join(''),options),'text/html').querySelector<HTMLElement>('[data-file-document]');}
    return prepared;
   }
   try{const {renderFileDocument}=await import('./document-render.js'),site=JSON.parse(document.querySelector<HTMLElement>('#document-options')?.textContent||'{}');return await renderFileDocument(pre.textContent,{...options,format,site});}
   catch(error){const view=document.createElement('div'),message=document.createElement('p');view.className='file-document';view.dataset.fileDocument='';message.className='document-error';message.textContent=errorMessage(error);view.append(message);return view;}
  };
  try{
   if(!resourceContext){await Promise.allSettled(parentsReady);if(!alive())return;resourceContext=readingContext(context.parentPanel);setReadingContext(viewer.panel,resourceContext);}
   if(props.block){
    let element=await articleCodeBlock(props.block);if(!element&&parentsReady.length){await Promise.allSettled(parentsReady);element=await articleCodeBlock(props.block);}if(!alive())return;
    if(!element&&retainedDefinition?.id!==props.block)throw Error('代码块不存在：'+props.block);
    definition=element?codeBlockDefinition(element):normalizeCodeBlock({...retainedDefinition,lines:retainedDefinition?.ranges||[]});retainedDefinition=definition??undefined;sourceOrigin=element?.closest<HTMLElement>('[data-mdx-line]')||sourceOrigin;
    const pre=element?.matches('.code-block')?$('pre',element):null,prepared=(element instanceof HTMLTemplateElement?element.content:element)?.querySelector<HTMLElement>('[data-file-document]');
    if(element&&pre?.querySelector<HTMLElement>(':scope > code > .line')){retainedDefinition||=normalizeCodeBlock({id:props.block,code:pre.textContent,language:element.dataset.language||'text'});const view=await documentView(pre,{src:definition?.src,language:element.dataset.language,prepared});if(alive())viewer.update({title:$('.code-language',element)?.textContent||'文本',pre,sourceFile:definition?.src||'',origin:sourceOrigin,ranges:definition?.ranges||[],documentView:view});return;}
    if(!definition)throw Error('代码块定义无效：'+props.block);
    file=definition.src;ranges=definition.ranges;annotations=definition;
    if(definition.code!==undefined){
     const {highlightSource}=await import('../lib/source-highlight.js'),html=await highlightSource(definition.code,definition.language);if(!alive())return;
     const pre=new DOMParser().parseFromString(html,'text/html').querySelector<HTMLElement>('pre');if(!pre)throw Error('代码高亮加载失败');pre.classList.add('astro-code');
     const {decorateCode}=await import('./code-annotations.js');await decorateCode(pre,annotations);
     const view=await documentView(pre,{src:undefined,language:definition.language,prepared});
     if(alive())viewer.update({title:languageLabel(definition.language),pre,origin:sourceOrigin,ranges,documentView:view});return;
    }
   }
   if(!file)throw Error('代码块缺少文件或源码');
   const resource=resolveResource(file),title=fileResourceTitle(resource),href=resource.href;
   const update=(options: CodeDialogUpdate)=>viewer.update({title,sourceFile:file,origin:sourceOrigin,ranges,...options});
   const requireText=()=>{if(hasCodeAnnotations(annotations)||ranges.length)throw Error('行范围与代码标注只能用于文本文件');};
   const show=async(pre: HTMLElement,codeTitle=title)=>{
    const {decorateCode}=await import('./code-annotations.js');await decorateCode(pre,annotations);
    const definitionElement=definition?await articleCodeBlock(definition.id):null,prepared=definitionElement instanceof HTMLTemplateElement?definitionElement.content.querySelector<HTMLElement>('[data-file-document]'):null,view=await documentView(pre,{language:definition?.language||resource.language,prepared});
    if(alive())update({title:codeTitle,pre,documentView:view});
   };
   const cached=await cachedFileResource(resource.url).catch(()=>null);if(!alive())return;
   if(cached&&(!definition?.language||cached.kind==='code'&&cached.language===definition.language)){
    if(cached.kind==='code'){const pre=new DOMParser().parseFromString(cached.html,'text/html').querySelector<HTMLElement>('pre');if(!pre)throw Error('代码缓存无效');pre.classList.add('astro-code');await show(pre,resource.title+' · '+languageLabel(cached.language));}
    else{requireText();if(cached.kind==='image')update({title:resource.title,image:cached.blob});else update({message:cached.message,href});}
    return;
   }
   const local=isWebFile(file)?null:await bundledSource(file,resourceContext).catch(()=>null);if(!alive())return;if(local&&(!definition||definition.language===resource.language)){await show(local);return;}
   const content=await readFile(resource.url);if(!alive())return;
   if(content.kind==='image'){requireText();update({title:resource.title,image:content.blob});return;}
   if(content.kind!=='text'){requireText();update({message:content.message,href});return;}
   const {highlightSource}=await import('../lib/source-highlight.js'),language=definition?.language||resourceLanguage(resource.path,content.contentType),html=await highlightSource(content.text,language);if(!alive())return;
   const pre=new DOMParser().parseFromString(html,'text/html').querySelector<HTMLElement>('pre');if(!pre)throw Error('代码高亮加载失败');pre.classList.add('astro-code');await show(pre,resource.title+' · '+languageLabel(language));
  }catch(error){if(alive())viewer.update({title:'代码',message:errorMessage(error)||'代码暂时无法读取',retry:load});}
 };
 viewer.ready=load();return viewer;
});}
