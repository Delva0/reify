import {readRepositoryTree} from '../lib/github-files.js';
import {codeHref} from '../lib/code-links.js';
import {codeDistribution,share,distributionTip,compactLines} from '../lib/code-distribution.js';
import {fileBrowserStateKey,readFileBrowserState,saveFileBrowserState} from '../lib/file-browser-state.js';
import {formatLineRanges,isWebFile} from '../lib/code-props.js';
import {markLink} from '../lib/links.js';
import {initSidebar,disposeSidebar} from './sidebars.js';
import {articleCodeBlock} from './article-pages.js';
import {codeBlockDefinition} from '../lib/code-block.js';
import {registerTreeBranch,toggleTreeBranch,commitTreeChange,registerTreeRoot} from './tree-branches.js';

const instances=new WeakMap();
export function disposeGitHubFiles(panel=document.querySelector('.github-files')){instances.get(panel)?.dispose();}
export function initGitHubFiles(){
 const panel=document.querySelector('.github-files'),toggle=document.querySelector('.github-files-toggle');if(!panel||!toggle)return;
 if(instances.has(panel))return instances.get(panel);
 const lifetime=new AbortController(),signal=lifetime.signal;
 const repository=document.body.dataset.repositoryName,commit=document.body.dataset.commit;
 const [owner,repo]=repository.split('/').map(encodeURIComponent);
 const stateKey=fileBrowserStateKey(repository,commit),saved=readFileBrowserState(stateKey),expandedPaths=new Set(saved.expanded);
 let activeFile=null,activeRanges=[];
 let navigation=0,selectionRevision=0,repositoryLoading;
 let started=false,selected,directories,distribution,selectedLanguage=saved.suffix;
 const languageTrigger=panel.querySelector('#language-trigger'),languageMenu=panel.querySelector('#language-menu');
 const clearSelected=()=>{selected?.removeAttribute('aria-current');selected=undefined;};
 const selectRow=row=>{clearSelected();selected=row;selected?.setAttribute('aria-current','true');};
 const persist=()=>saveFileBrowserState(stateKey,{expanded:expandedPaths,suffix:selectedLanguage,file:activeFile,lines:formatLineRanges(activeRanges)||null});
 document.addEventListener('fpchange',async event=>{
  const current=++selectionRevision,target=event.detail.state.findLast(item=>item.type==='code')?.props;
  let file=target?.file,ranges=target?.ranges||[];
  if(target?.block){try{const block=codeBlockDefinition(await articleCodeBlock(target.block));file=block?.src;ranges=block?.ranges||[];}catch{}}
  if(current!==selectionRevision)return;
  activeFile=file||null;activeRanges=ranges;persist();
  if(activeFile&&!isWebFile(activeFile))revealFile(activeFile).catch(()=>{});else ++navigation;
 },{signal});
 addEventListener('pagehide',persist,{signal});
 document.addEventListener('pointerdown',event=>{if(!selected?.contains(event.target)&&!event.target.closest?.('[data-code-viewer],.floating-backdrop'))clearSelected();},{capture:true,signal});
 const refreshTip=event=>{const row=event.target.closest?.('.github-file-row');if(row)updateRowTip(row,true);};
 panel.addEventListener('pointerover',refreshTip,true);panel.addEventListener('focusin',refreshTip,true);
 languageMenu.addEventListener('click',event=>{
  const option=event.target.closest('[data-language]');if(!option)return;
  const language=option.dataset.language;selectedLanguage=language&&language!==selectedLanguage?language:null;
  updateDistribution();persist();languageMenu.hidden=true;languageTrigger.setAttribute('aria-expanded','false');languageTrigger.focus({preventScroll:true});
 });
 languageMenu.addEventListener('keydown',event=>{
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();const options=[...languageMenu.querySelectorAll('[role=option]')],index=options.indexOf(document.activeElement);
  const next=event.key==='Home'?0:event.key==='End'?options.length-1:(index+(event.key==='ArrowUp'?-1:1)+options.length)%options.length;options[next]?.focus();
 });

 function renderLanguages(){
  const fragment=document.createDocumentFragment();
  for(const {language}of distribution.languages){
   const option=document.createElement('button');option.type='button';option.setAttribute('role','option');option.dataset.language=language;option.setAttribute('aria-selected',String(selectedLanguage===language));option.setAttribute('data-tip-overflow','');option.textContent=language;fragment.append(option);
  }
  languageMenu.replaceChildren(fragment);
 }
 function updateRow(row){
  row.toggleAttribute('data-distribution',!!selectedLanguage);
  if(!selectedLanguage){row.style.removeProperty('--loc-share');updateRowTip(row);return;}
  const path=row.dataset.path,slash=path.lastIndexOf('/'),parent=slash<0?'':path.slice(0,slash),lines=distribution.lines(path,selectedLanguage),total=distribution.lines(parent,selectedLanguage),percentage=share(lines,total);
  row.style.setProperty('--loc-share',percentage+'%');updateRowTip(row);
 }
 function updateRowTip(row,measure=false){
  const path=row.dataset.path,name=row.querySelector('.github-file-name'),slash=path.lastIndexOf('/'),parent=slash<0?'':path.slice(0,slash);
  const lines=selectedLanguage?distribution.lines(path,selectedLanguage):0,total=selectedLanguage?distribution.lines(parent,selectedLanguage):0;
  const tip=distributionTip(path,{truncated:measure&&name.scrollWidth>name.clientWidth,active:!!selectedLanguage,lines,percentage:share(lines,total)});
  if(tip)row.dataset.tip=tip;else delete row.dataset.tip;
 }
 function updateDistribution(){
  languageTrigger.setAttribute('aria-pressed',String(!!selectedLanguage));languageTrigger.setAttribute('aria-label',selectedLanguage?'代码分布，当前 '+selectedLanguage:'代码分布');
  languageTrigger.dataset.tip=selectedLanguage?'代码分布\n'+selectedLanguage+' '+compactLines(distribution.lines('',selectedLanguage)):'代码分布';
  for(const row of panel.querySelectorAll('.github-file-row'))updateRow(row);
  for(const option of languageMenu.querySelectorAll('[role=option]'))option.setAttribute('aria-selected',String(option.dataset.language===(selectedLanguage||'')));
 }

 async function revealFile(path){
  const current=++navigation;
   await loadRepository();if(current!==navigation)return;
   const parts=path.split('/'),name=parts.pop(),parent=parts.join('/'),entry=directories.get(parent)?.find(item=>item.path===name);
   if(!entry||entry.type==='tree')throw Error('文件不在当前提交中：'+path);
   let directory='';for(const part of parts){directory=directory?directory+'/'+part:part;expandedPaths.add(directory);}
   renderDirectory(panel.querySelector('.github-tree'),'');
   selectRow(panel.querySelector('[data-path="'+CSS.escape(path)+'"]'));
   const row=panel.querySelector('[data-path="'+CSS.escape(path)+'"]'),viewport=panel.querySelector('.github-files-content');
   if(row){const bounds=row.getBoundingClientRect(),view=viewport.getBoundingClientRect();if(bounds.top<view.top)viewport.scrollTop-=view.top-bounds.top;else if(bounds.bottom>view.bottom)viewport.scrollTop+=bounds.bottom-view.bottom;}
 }
 function loadRepository(){
  if(!repositoryLoading)repositoryLoading=loadRepositoryData().catch(error=>{repositoryLoading=undefined;throw error;});return repositoryLoading;
 }
 async function loadRepositoryData(){
  const container=panel.querySelector('.github-tree');
  container.setAttribute('aria-busy','true');const status=document.createElement('div');status.className='github-file-status';status.setAttribute('role','status');status.textContent='读取目录…';container.replaceChildren(status);
  try{
   directories=await readRepositoryTree(panel.dataset.treeUrl,repository,commit);distribution=codeDistribution(directories);selectedLanguage=distribution.languages.some(item=>item.language===saved.suffix)?saved.suffix:null;renderLanguages();renderDirectory(container,'');updateDistribution();languageTrigger.disabled=!distribution.languages.length;
  }catch(error){status.textContent=error.message||'目录暂时无法读取';const retry=document.createElement('button'),link=document.createElement('a');retry.className='github-retry';retry.textContent='重试';retry.addEventListener('click',()=>loadRepository().catch(()=>{}));link.className='github-fallback';link.href=`https://github.com/${owner}/${repo}/tree/${commit}`;link.target='_blank';link.rel='noreferrer';link.textContent='在 GitHub 查看';markLink(link);container.append(retry,link);throw error;}
  finally{container.removeAttribute('aria-busy');}
 }
 function renderDirectory(container,parent){
   const entries=directories.get(parent)||[],list=document.createElement('ul');
   for(const entry of entries){
    const path=parent?parent+'/'+entry.path:entry.path,li=document.createElement('li'),row=document.createElement(entry.type==='tree'?'button':'a'),name=document.createElement('span');
    row.className='github-file-row';row.dataset.path=path;name.className='github-file-name';name.textContent=entry.path;
    if(entry.type==='tree'){
     row.type='button';
     const open=expandedPaths.has(path);row.setAttribute('aria-expanded',String(open));const branch=document.createElement('span');branch.className='github-branch';branch.setAttribute('aria-hidden','true');branch.textContent=open?'−':'+';row.append(branch);
     const children=document.createElement('div');children.hidden=!open;let loaded=open;if(open)renderDirectory(children,path);
     const prepareChildren=()=>{if(!loaded){loaded=true;renderDirectory(children,path);}};
     registerTreeBranch(row,{prepareChildren,setExpanded(expanded){row.setAttribute('aria-expanded',String(expanded));branch.textContent=expanded?'−':'+';children.hidden=!expanded;if(expanded)expandedPaths.add(path);else expandedPaths.delete(path);if(expanded)prepareChildren();commitTreeChange(persist);}});
     row.addEventListener('click',event=>{selectRow(row);toggleTreeBranch(row,event);});
     li.append(row,children);
    }else{row.href=codeHref(path);markLink(row);row.addEventListener('click',()=>selectRow(row));li.append(row);}
    row.append(name);updateRow(row);list.append(li);
   }
   container.replaceChildren(list);
 }
 const disposeRoot=registerTreeRoot(panel.querySelector('[data-tree-root-toggle]'),panel.querySelector('#file-tree-root'),{key:'tree-root:files:'+repository+'@'+commit,prepareChildren:loadRepository});
 initSidebar('files',visible=>{if((visible||activeFile)&&!started){started=true;loadRepository().catch(()=>{});}});
 const controller={dispose(){persist();disposeRoot();lifetime.abort();++navigation;++selectionRevision;disposeSidebar('files');instances.delete(panel);}};instances.set(panel,controller);return controller;
}
