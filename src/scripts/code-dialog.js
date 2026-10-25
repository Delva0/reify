import {$,notice} from '../lib/dom.js';
import {registerFloatingPanel,unregisterFloatingPanel,raiseFloatingPanel,setFloatingModal} from './floating-panels.js';
import {normalizeLineRanges,formatLineRanges} from '../lib/code-props.js';
import {markLink} from '../lib/links.js';
import {setCodeText,codeIcon} from './code-controls.js';
import {bindPanelDrag} from './panel-drag.js';
import {bindPanelWheel} from './panel-wheel.js';
import {panelPosition,panelResizeCorner} from '../lib/panel-position.js';
import {mountDocumentView,unmountDocumentView,documentRangeTarget,setDocumentMode,documentViewState,restoreDocumentViewState} from './document-view.js';
let nextId=0;
const validBox=box=>box&&['left','top','width','height'].every(key=>Number.isFinite(box[key]))&&box.width>0&&box.height>0;

export function createCodeDialog({onClose,onDetach,onAttach,onStateChange,parentPanel,sessionId,restore:initialState}={}){
 const dialog=$('#code-viewer-template').content.firstElementChild.cloneNode(true),code=$('[data-source-code]',dialog),preview=$('[data-source-preview]',dialog),documentHost=$('[data-source-document]',dialog);
 dialog.id='code-viewer-'+(++nextId);if(sessionId)dialog.dataset.fpSessionId=sessionId;dialog.setAttribute('aria-labelledby',dialog.id+'-title');$('[data-source-title]',dialog).id=dialog.id+'-title';
 let revision=0,imageUrl,closed=false,navigationRanges=[],lastJump,lastNonModalBox,lastExpandedHeight,pendingRestore=initialState,restoring=false,contentReady=false;
 const notify=()=>{if(!closed&&!restoring)onStateChange?.();};
 const edited=()=>{if(!restoring)pendingRestore=null;notify();};
 document.body.append(dialog);
 const scrollPositions=()=>[code,preview,...documentHost.querySelectorAll('[data-document-content],.document-outline')].map(node=>[node,node.scrollTop,node.scrollLeft]);
 const restoreScroll=positions=>{for(const [node,top,left]of positions){node.scrollTop=top;node.scrollLeft=left;}};
 const raise=()=>raiseFloatingPanel(dialog);
 const resizeBox=event=>{if(dialog.dataset.modal!=='false')return;const box=dialog.getBoundingClientRect();if(panelResizeCorner(event.clientX,event.clientY,box))return box;};
 const minHeight=()=>parseFloat(getComputedStyle(dialog).minHeight);
 dialog.addEventListener('pointerdown',event=>{const box=resizeBox(event);if(box&&box.height>minHeight()+1)lastExpandedHeight=box.height;raise();},true);
 dialog.addEventListener('dblclick',event=>{
  const box=resizeBox(event);if(!box)return;event.preventDefault();event.stopPropagation();
  const minimum=minHeight();dialog.style.height=(box.height<=minimum+1?lastExpandedHeight||minimum:minimum)+'px';
  edited();
 });
 const detach=(box=dialog.getBoundingClientRect())=>{
  if(dialog.dataset.modal==='false')return;
  lastExpandedHeight??=box.height;
  const positions=scrollPositions(),position=panelPosition(box.left,box.top);
  dialog.style.width=box.width+'px';dialog.style.height=box.height+'px';dialog.style.left=position.left+'px';dialog.style.top=position.top+'px';
  setFloatingModal(dialog,false);onDetach?.();raise();edited();
  restoreScroll(positions);
 };
 const unbindDrag=bindPanelDrag(dialog,$('.dialog-head',dialog),detach);
 const unbindWheel=bindPanelWheel(dialog,$('.dialog-head',dialog),box=>{detach(box);raise();});
 const attach=()=>{
  if(dialog.dataset.modal==='true')return;
  const box=dialog.getBoundingClientRect(),positions=scrollPositions();onAttach?.();
  lastNonModalBox={left:box.left,top:box.top,width:box.width,height:box.height};
  for(const name of ['left','top','width','height','inset','margin'])dialog.style.removeProperty(name);
  setFloatingModal(dialog,true);raise();restoreScroll(positions);edited();
 };
 $('.dialog-head',dialog).addEventListener('dblclick',event=>{
  if(resizeBox(event))return;
  if(event.target.closest('button,a,input,textarea,select'))return;
  if(dialog.dataset.modal==='true'){detach(lastNonModalBox);return;}
  try{attach();}catch(error){notice(error.message);}
 });
 const releaseImage=()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=undefined;};
 const close=()=>{
  if(closed)return;closed=true;++revision;unbindDrag();unbindWheel();geometryObserver.disconnect();rangeObserver.disconnect();documentObserver.disconnect();cancelAnimationFrame(navigationFrame);releaseImage();for(const view of documentHost.querySelectorAll(':scope > [data-file-document]'))unmountDocumentView(view);dialog.dispatchEvent(new Event('sourcechange'));dialog.close();unregisterFloatingPanel(dialog);dialog.remove();
  onClose?.();
 };
 registerFloatingPanel(dialog,close,{parent:parentPanel,onBackdrop:()=>detach(lastNonModalBox),onChange:notify});$('[data-close-source]',dialog).addEventListener('click',close);
 const geometryObserver=new ResizeObserver(notify);geometryObserver.observe(dialog);
 for(const type of ['panelmove','panelresize','codewrapchange'])dialog.addEventListener(type,edited);
 dialog.addEventListener('scroll',()=>{if(contentReady&&!restoring)pendingRestore=null;notify();},true);dialog.addEventListener('documentmodechange',notify);dialog.addEventListener('pointerup',notify);
 dialog.addEventListener('click',event=>{if(event.target.closest?.('[data-code-document]'))edited();});
 const snapshot=()=>{
  const box=dialog.getBoundingClientRect();
  const state={modal:dialog.dataset.modal!=='false',box:{left:box.left,top:box.top,width:box.width,height:box.height},lastNonModalBox,lastExpandedHeight,wrap:dialog.dataset.wrap==='true',documentWrap:dialog.dataset.documentWrap!=='false',documentMode:dialog.dataset.documentMode,documents:[...documentHost.querySelectorAll(':scope > [data-file-document]')].map(documentViewState),scroll:scrollPositions().map(([,top,left])=>({top,left}))};
  return !contentReady&&pendingRestore?{...pendingRestore,modal:state.modal,box:validBox(state.box)?state.box:pendingRestore.box}:state;
 };
 const applyRestore=()=>{
  if(!pendingRestore)return;restoring=true;
  try{
   const state=pendingRestore;
   if(typeof state.modal==='boolean'){if(state.modal)attach();else detach(validBox(state.box)?state.box:undefined);}
   if(validBox(state.lastNonModalBox))lastNonModalBox=state.lastNonModalBox;
   if(Number.isFinite(state.lastExpandedHeight))lastExpandedHeight=state.lastExpandedHeight;
   if(validBox(state.box)){dialog.style.inset='auto';dialog.style.margin='0';for(const name of ['left','top','width','height'])dialog.style[name]=state.box[name]+'px';}
   if(typeof state.documentWrap==='boolean')dialog.dataset.documentWrap=String(state.documentWrap);
   dialog.dataset.wrap=String(Boolean(state.wrap));const wrap=$('[data-code-wrap]',dialog);wrap?.setAttribute('aria-pressed',dialog.dataset.wrap);if(wrap){wrap.dataset.tip=state.wrap?'取消换行':'自动换行';wrap.replaceChildren(codeIcon(state.wrap?'wrap':'nowrap'));}
   [...documentHost.querySelectorAll(':scope > [data-file-document]')].forEach((view,index)=>restoreDocumentViewState(view,state.documents?.[index]));
   if(state.documentMode&&documentHost.querySelector('[data-file-document]'))setDocumentMode(dialog,state.documentMode==='rendered');
   if(Array.isArray(state.scroll))scrollPositions().forEach(([node],index)=>{const saved=state.scroll[index];if(saved&&Number.isFinite(saved.top)&&Number.isFinite(saved.left)){node.scrollTop=saved.top;node.scrollLeft=saved.left;}});
  }finally{restoring=false;}
 };
 const restore=state=>{pendingRestore={...snapshot(),...state};applyRestore();notify();};
 const rangeControl=$('[data-code-ranges]',dialog),rangeBadge=$('[data-symmetric-badge]',rangeControl);
 let sourceRangeTargets=[],rangeOffsets=[],rangeArea,rangePageStart,navigationFrame,navigationDirty=false,pendingJump,pendingDirection=0;
 const initializedModes=new Set();
 const rendered=()=>dialog.dataset.documentMode==='rendered';
 const mode=()=>rendered()?'rendered':'source';
 const activeView=()=>documentHost.querySelector(':scope > [data-file-document]');
 const scroller=()=>rendered()?documentHost.querySelector('[data-document-content]'):code;
 const rangeTarget=(index,navigate=false)=>rendered()?documentRangeTarget(activeView(),navigationRanges[index],navigate):sourceRangeTargets[index];
 const rangeTip=index=>{
  if(!navigationRanges.length)return;
  const current=String(index+1),label='段落导航，当前第'+current+'段，共'+navigationRanges.length+'段';
  if(rangeBadge.textContent!==current)rangeBadge.textContent=current;
  if(rangeControl.getAttribute('aria-label')!==label)rangeControl.setAttribute('aria-label',label);
  const tip='上/下一段；当前位于'+current+'/'+navigationRanges.length;
  if(rangeControl.dataset.tip!==tip){rangeControl.dataset.tip=tip;rangeControl.dispatchEvent(new Event('tipchange',{bubbles:true}));}
  rangeBadge.hidden=false;
 };
 const refreshRangeTip=()=>{
  if(!rangeArea)return;
  if(lastJump?.area===rangeArea&&Math.abs(lastJump.top-rangeArea.scrollTop)<1){rangeTip(lastJump.index);return;}
  const edge=rangeArea.scrollTop+1;let low=0,high=rangeOffsets.length;
  while(low<high){const middle=(low+high)>>1;if(rangeOffsets[middle].top<=edge)low=middle+1;else high=middle;}
  rangeTip(rangeOffsets[Math.max(0,low-1)]?.index??Math.max(0,navigationRanges.findLastIndex(range=>range.from<=rangePageStart)));
 };
 const measureRanges=()=>{
  rangeArea=scroller();rangeOffsets=[];rangePageStart=undefined;if(!rangeArea)return;
  const origin=rangeArea.getBoundingClientRect().top-rangeArea.scrollTop+24;
  navigationRanges.forEach((_range,index)=>{const target=rangeTarget(index);if(target)rangeOffsets.push({index,top:target.getBoundingClientRect().top-origin});});
  if(rendered())rangePageStart=Number(rangeArea.querySelector('[data-mdx-line]')?.dataset.mdxLine);
  navigationDirty=false;
 };
 const jumpToRange=index=>{
  const target=rangeTarget(index,true),area=scroller();if(!target||!area)return;
  area.scrollTop=Math.max(0,area.scrollTop+target.getBoundingClientRect().top-area.getBoundingClientRect().top-24);
  lastJump={index,top:area.scrollTop,area};initializedModes.add(mode());navigationDirty=true;
 };
 const rangeInDirection=direction=>{
  const length=navigationRanges.length;
  if(lastJump?.area===rangeArea&&Math.abs(lastJump.top-rangeArea.scrollTop)<1)return (lastJump.index+direction+length)%length;
  const edge=rangeArea.scrollTop;let low=0,high=rangeOffsets.length;
  while(low<high){const middle=(low+high)>>1,top=rangeOffsets[middle].top;if(direction>0?top<=edge+1:top<edge-1)low=middle+1;else high=middle;}
  if(rangeOffsets.length)return direction>0?(rangeOffsets[low]?.index??rangeOffsets.at(-1).index+1)%length:(rangeOffsets[low-1]?.index??rangeOffsets[0].index-1+length)%length;
  const following=navigationRanges.findIndex(range=>range.from>=rangePageStart),next=following<0?0:following;
  return direction>0?next:(next-1+length)%length;
 };
 const scheduleNavigation=(measure=false)=>{
  if(closed||!navigationRanges.length)return;navigationDirty||=measure;
  if(navigationFrame!==undefined)return;
  navigationFrame=requestAnimationFrame(()=>{
   if(navigationDirty||!rangeArea)measureRanges();
   if(pendingJump!==undefined){jumpToRange(pendingJump);pendingJump=undefined;}
   if(pendingDirection&&rangeArea){const direction=Math.sign(pendingDirection),steps=Math.abs(pendingDirection),length=navigationRanges.length,index=rangeInDirection(direction);jumpToRange(((index+direction*(steps-1))%length+length)%length);}
   pendingDirection=0;if(navigationDirty)measureRanges();refreshRangeTip();navigationFrame=undefined;
  });
 };
 const initializeNavigation=event=>{if(pendingRestore?.scroll?.length||event?.detail?.synchronized){initializedModes.add(mode());lastJump=undefined;pendingJump=undefined;}else if(navigationRanges.length&&!initializedModes.has(mode()))pendingJump=lastJump?.index||0;scheduleNavigation(true);};
 const rangeObserver=new ResizeObserver(()=>scheduleNavigation(true)),documentObserver=new MutationObserver(()=>scheduleNavigation(true));
 dialog.addEventListener('documentmodechange',initializeNavigation);
 dialog.addEventListener('documentpagechange',event=>{if(event.target.parentElement===documentHost){lastJump=undefined;scheduleNavigation(true);}});
 dialog.addEventListener('load',()=>scheduleNavigation(true),true);
 dialog.addEventListener('scroll',event=>{if(navigationRanges.length&&event.target===scroller())scheduleNavigation();},true);
 rangeControl.addEventListener('pointerover',()=>scheduleNavigation());rangeControl.addEventListener('focusin',()=>scheduleNavigation());
 const jump=direction=>{pendingDirection+=direction;scheduleNavigation();};
 $('[data-code-previous]',dialog).addEventListener('click',()=>jump(-1));$('[data-code-next]',dialog).addEventListener('click',()=>jump(1));
 dialog.addEventListener('close',close);
 const update=({title,text,pre,sourceFile='',origin,ranges=[],documentView,message,href,image,retry})=>{
 if(closed)return;
 contentReady=!message;
 const highlighted=pre?[...pre.querySelectorAll(':scope > code > .line')]:[];
 const lines=message||image?[]:highlighted.length?highlighted:(text??pre?.textContent??'').split('\n');
 setCodeText(dialog,message||image?null:lines.map(line=>typeof line==='string'?line.replace(/\r$/,''):line.textContent).join('\n'));
 const selectedRanges=normalizeLineRanges(ranges);
 lastJump=undefined;sourceRangeTargets=[];rangeOffsets=[];rangeArea=undefined;navigationDirty=false;pendingJump=undefined;pendingDirection=0;initializedModes.clear();rangeObserver.disconnect();documentObserver.disconnect();cancelAnimationFrame(navigationFrame);navigationFrame=undefined;
 navigationRanges=message||image?[]:selectedRanges;
 dialog.dataset.hasRanges=String(navigationRanges.length>0);
 rangeControl.hidden=navigationRanges.length===0;rangeTip(0);
 if(!message&&!image&&selectedRanges.some(range=>range.to>lines.length))throw Error('行范围超出文件');
 ++revision;
 dialog.dispatchEvent(new Event('sourcechange'));releaseImage();
 for(const view of documentHost.querySelectorAll(':scope > [data-file-document]'))unmountDocumentView(view);documentHost.replaceChildren();documentHost.hidden=true;delete dialog.dataset.documentMode;$('[data-code-document]',dialog).hidden=true;$('[data-code-wrap]',dialog).hidden=false;
 preview.replaceChildren();preview.hidden=!message&&!image;code.hidden=!preview.hidden;
 if(message){const status=document.createElement('p');status.setAttribute('role','status');status.textContent=message;preview.append(status);}
 if(image){const img=document.createElement('img');imageUrl=URL.createObjectURL(image);img.src=imageUrl;img.alt=sourceFile;preview.append(img);}
 if(href){const link=document.createElement('a');link.href=href;link.target='_blank';link.rel='noreferrer';link.textContent='在网页打开';markLink(link);preview.append(link);}
 if(retry){const button=document.createElement('button');button.textContent='重试';button.addEventListener('click',retry);preview.append(button);}
 const content=document.createDocumentFragment();
 let rangeIndex=0;
 lines.forEach((line,index)=>{
  const lineNumber=index+1;while(selectedRanges[rangeIndex]?.to<lineNumber)++rangeIndex;
  const marked=selectedRanges[rangeIndex]?.from<=lineNumber;
  const row=document.createElement('div'),number=document.createElement('span'),value=document.createElement('code');
  row.className='source-line'+(marked?' mark':'');row.dataset.line=String(lineNumber);number.dataset.line=String(lineNumber);number.setAttribute('aria-hidden','true');
  if(marked&&selectedRanges[rangeIndex].from===lineNumber)sourceRangeTargets[rangeIndex]=row;
  if(marked&&selectedRanges[rangeIndex].color)row.dataset.rangeColor=selectedRanges[rangeIndex].color;
  if(typeof line==='string')value.textContent=line.replace(/\r$/,'')||' ';else for(const child of line.childNodes)value.append(child.cloneNode(true));
  row.append(number,value);content.append(row);
 });
 const canvas=document.createElement('div');canvas.className='source-lines';canvas.append(content);
 $('[data-source-title]',dialog).textContent=title;code.className=pre?.className||'';code.replaceChildren(canvas);code.scrollTop=0;code.scrollLeft=0;
 if(documentView){const view=documentView.cloneNode(true);documentHost.append(view);mountDocumentView(view,dialog,selectedRanges);}
 dialog.dataset.sourceFile=sourceFile;
 dialog.dataset.sourceRanges=formatLineRanges(selectedRanges);
 for(const name of ['mdxLine','mdxColumn','mdxEndLine','mdxEndColumn']){if(origin?.dataset[name])dialog.dataset[name]=origin.dataset[name];else delete dialog.dataset[name];}
 if(!dialog.open)dialog.show();setFloatingModal(dialog,dialog.dataset.modal!=='false');applyRestore();
 if(navigationRanges.length){rangeObserver.observe(canvas);rangeObserver.observe(dialog);documentObserver.observe(documentHost,{childList:true,subtree:true});initializeNavigation();}
 else if(code.querySelector('[data-code-annotation-group]')){const opened=revision;requestAnimationFrame(()=>{if(revision!==opened||!dialog.open)return;const target=$('[data-code-annotation-group]',code);if(target&&!rendered())code.scrollTop=Math.max(0,target.getBoundingClientRect().top-code.getBoundingClientRect().top+code.scrollTop-24);});}
 notify();return revision;
 };
 return {panel:dialog,update,close,snapshot,restore,current:()=>revision,alive:version=>!closed&&revision===version};
}
