import {textContext,imageLocation,formatTextAnnotation} from '../lib/reader-location.js';
import {notice} from '../lib/dom.js';
import {retainSelection,releaseSelection,sameRange} from '../lib/selection.js';
import {registerFloatingPanel,setFloatingParent,raiseFloatingPanel,setFloatingModal} from './floating-panels.js';
import {altHeld,hasAlt} from '../lib/alt.js';
import {transientSession,nodeReference,resolveNode,rangeReference,resolveRange,panelGeometry,restorePanelGeometry,saveReaderSnapshot,loadReaderSnapshot,deleteReaderSnapshot} from '../lib/transient-session.js';

let controller,pageHooks=false;
export function toggleReaderAnnotation(range){controller??=createController();controller.toggle(range);}
export function initReaderAnnotation(){if(!pageHooks){pageHooks=true;document.addEventListener('reify:after-navigate',()=>{if(!controller&&transientSession('reader').read())controller=createController();});}if(transientSession('reader').read())controller??=createController();}

function createController(){
 const button=document.querySelector('.reader-annotation-mode'),editor=document.querySelector('.reader-annotation-editor');
 const input=editor.querySelector('textarea'),kind=editor.querySelector('.reader-annotation-kind'),status=editor.querySelector('[role=status]'),confirm=editor.querySelector('[data-reader-annotation-confirm]');
 let session=transientSession('reader'),pending=session.read();
 let enabled=Boolean(pending?.enabled),current=null,drag=null,outline=null,busy=false,selecting=false,suppressSelection=false,keyboardSelecting=false,scopeRevision=0,pageSuspended=false;
 const mode=()=>{button.setAttribute('aria-pressed',String(enabled));document.documentElement.classList.toggle('reader-annotation-enabled',enabled);};
 const save=()=>{
  if(pending&&!current)return;
  const entry=current?{type:current.type,context:current.context,anchor:current.anchor,capture:current.capture,snapshotId:current.snapshotId,origin:nodeReference(current.origin),range:rangeReference(current.range),draft:input.value,geometry:panelGeometry(editor),modal:editor.dataset.modal==='true'}:null;
  session.write(enabled||entry?{enabled,entry}:null);
 };
 mode();
 const selectionKey=key=>/^(Arrow|Home$|End$|PageUp$|PageDown$)/.test(key);
 const own=node=>node instanceof Element&&Boolean(node.closest('[data-reader-annotation-ui]'));
 const resetEditor=clear=>{editor.hidden=true;current=null;outline?.remove();outline=null;status.textContent='';if(clear)input.value='';};
 const close=clear=>{resetEditor(clear);pending=null;releaseSelection();deleteReaderSnapshot(session.key);save();};
 registerFloatingPanel(editor,()=>{if(!busy)close(true);},{priority:'editor'});
 const position=()=>{if(!current||editor.hidden)return;const box=current.anchor,width=Math.min(400,innerWidth-32),height=editor.offsetHeight;editor.style.width=width+'px';editor.style.left=Math.max(16,Math.min(box.left,innerWidth-width-16))+'px';editor.style.top=Math.max(16,box.bottom+height+10<innerHeight?box.bottom+8:box.top-height-8)+'px';save();};
 const fit=()=>{input.style.height='auto';input.style.height=Math.min(220,Math.max(52,input.scrollHeight))+'px';position();};
 const open=(entry,{focus=true,geometry,modal=false}={})=>{resetEditor(false);document.body.append(editor);current=entry;if(entry.type==='text')retainSelection(entry.range);else releaseSelection();kind.textContent=entry.type==='text'?'文本':'截图';confirm.disabled=entry.type==='image';editor.hidden=false;setFloatingParent(editor,entry.origin);setFloatingModal(editor,modal);raiseFloatingPanel(editor);fit();restorePanelGeometry(editor,geometry);save();if(focus)requestAnimationFrame(()=>{input.focus({preventScroll:true});position();});};
 function toggle(range){enabled=!enabled;pending=null;mode();if(!enabled){cancelDrag();close(true);}else{selectText(range);save();import('./reader-image.js').catch(()=>{});}}
 function selectText(savedRange,automatic=false){
  if(!enabled||drag||busy||altHeld()||automatic&&suppressSelection)return;const selection=getSelection();
  if(!savedRange&&(!selection?.rangeCount||selection.isCollapsed))return;
  const range=(savedRange||selection.getRangeAt(0)).cloneRange();if(!range.toString().trim()||own(range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement)||current?.type==='text'&&sameRange(current.range,range))return;
  const rects=[...range.getClientRects()].filter(box=>box.width&&box.height&&box.bottom>0&&box.top<innerHeight),anchor=rects.at(-1)||range.getBoundingClientRect();
  open({type:'text',context:textContext(range),anchor,range,origin:range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement});
 }
 function cancelDrag(){drag?.layer.remove();drag=null;document.documentElement.classList.remove('reader-annotation-capturing');}
 function updateDrag(event){if(!drag)return;const x=Math.max(0,Math.min(innerWidth,event.clientX)),y=Math.max(0,Math.min(innerHeight,event.clientY));drag.rect={left:Math.min(x,drag.x),top:Math.min(y,drag.y),right:Math.max(x,drag.x),bottom:Math.max(y,drag.y),width:Math.abs(x-drag.x),height:Math.abs(y-drag.y)};Object.assign(drag.box.style,{left:drag.rect.left+'px',top:drag.rect.top+'px',width:drag.rect.width+'px',height:drag.rect.height+'px'});}
 function beginDrag(event){
  if(!enabled||!event.ctrlKey||event.altKey||event.button!==0||own(event.target)||event.target.closest?.('header.repo-header,.tree-branch,.tree-repository,.github-file-row[aria-expanded]')||busy)return;
  event.preventDefault();event.stopPropagation();close(false);getSelection()?.removeAllRanges();
  const layer=document.createElement('div'),box=document.createElement('div');layer.className='reader-annotation-capture';box.className='reader-annotation-region';layer.dataset.readerAnnotationUi='';layer.setAttribute('data-html2canvas-ignore','');layer.append(box);document.body.append(layer);
  drag={x:event.clientX,y:event.clientY,layer,box,rect:null};document.documentElement.classList.add('reader-annotation-capturing');layer.setPointerCapture(event.pointerId);updateDrag(event);
  layer.addEventListener('pointermove',updateDrag);
  layer.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
  layer.addEventListener('pointercancel',cancelDrag);
  layer.addEventListener('pointerup',event=>{
   updateDrag(event);const rect=drag?.rect;cancelDrag();if(!rect||rect.width<8||rect.height<8)return;
   const context=imageLocation(rect),capture={...rect,scrollX,scrollY,windowWidth:innerWidth,windowHeight:innerHeight};
   const entry={type:'image',context,anchor:rect,capture,origin:document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2),snapshotId:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)};open(entry);
   outline=document.createElement('div');outline.className='reader-annotation-region';outline.dataset.readerAnnotationUi='';outline.setAttribute('data-html2canvas-ignore','');Object.assign(outline.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});document.body.append(outline);
   entry.snapshot=import('./reader-image.js').then(({captureRegion})=>captureRegion(capture));
   finishSnapshot(entry);
  },{once:true});
 }
 function finishSnapshot(entry){entry.snapshot.then(snapshot=>{if(current!==entry)return;confirm.disabled=false;saveReaderSnapshot(session.key,entry.snapshotId,snapshot).catch(()=>{});save();}).catch(error=>{if(current!==entry)return;status.textContent='截取失败，请重新框选';confirm.disabled=true;console.error('Capture failed',error);});}
 function restore(){
  if(!pending||current)return;
  const saved=pending.entry;if(!saved){pending=null;return;}
  if(!['text','image'].includes(saved.type)||!saved.context||!saved.anchor||!Number.isFinite(saved.anchor.left)||!Number.isFinite(saved.anchor.top)||!Number.isFinite(saved.anchor.bottom)){pending=null;save();return;}
  const origin=resolveNode(saved.origin);if(saved.origin&&!origin)return;
  const range=saved.type==='text'?resolveRange(saved.range):null;if(saved.type==='text'&&!range)return;
  const entry={...saved,origin,range};pending=null;input.value=saved.draft||'';
  open(entry,{focus:false,geometry:saved.geometry,modal:Boolean(saved.modal)});
  if(entry.type==='image'){
   entry.snapshot=loadReaderSnapshot(session.key,entry.snapshotId).then(snapshot=>snapshot||import('./reader-image.js').then(({captureRegion})=>captureRegion(entry.capture)));
   outline=document.createElement('div');outline.className='reader-annotation-region';outline.dataset.readerAnnotationUi='';outline.setAttribute('data-html2canvas-ignore','');Object.assign(outline.style,{left:entry.anchor.left+'px',top:entry.anchor.top+'px',width:entry.anchor.width+'px',height:entry.anchor.height+'px'});document.body.append(outline);finishSnapshot(entry);
  }
 }
 async function copy(){
  if(!current||busy||confirm.disabled)return;const entry=current,comment=input.value,revision=scopeRevision;busy=true;input.disabled=true;confirm.disabled=true;status.textContent='复制中…';
  try{
   if(entry.type==='text')await navigator.clipboard.writeText(formatTextAnnotation(entry.context,comment));
   else{if(typeof ClipboardItem!=='function')throw Error('当前浏览器不支持图片复制');const blob=entry.snapshot.then(async snapshot=>(await import('./reader-image.js')).annotationImage(snapshot,entry.context,comment));await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);}
   if(revision===scopeRevision){close(true);notice('已复制批注');}
  }catch(error){if(revision===scopeRevision)status.textContent=error.message==='当前浏览器不支持图片复制'?error.message:'复制失败，请点击重试';}
  finally{if(revision===scopeRevision){busy=false;input.disabled=false;confirm.disabled=false;}}
 }
 document.addEventListener('pointerdown',event=>{if(event.button===0&&!own(event.target)){selecting=true;suppressSelection=altHeld()||hasAlt(event);}beginDrag(event);},true);
 document.addEventListener('pointermove',event=>{if(selecting&&hasAlt(event))suppressSelection=true;},{capture:true,passive:true});
 document.addEventListener('pointerup',event=>{selecting=false;if(own(event.target)||event.target.closest?.('header.repo-header')||drag||event.ctrlKey||hasAlt(event))return;selectText(undefined,true);});
 document.addEventListener('pointercancel',()=>{selecting=false;});
 document.addEventListener('keyup',event=>{const completed=keyboardSelecting&&(event.key==='Shift'||selectionKey(event.key));if(event.key==='Shift')keyboardSelecting=false;if(completed&&enabled&&!own(event.target)&&!event.target.closest?.('header.repo-header')&&!event.ctrlKey&&!hasAlt(event))selectText(undefined,true);});
 document.addEventListener('keydown',event=>{
  if(!enabled)return;
  if(event.key==='Tab')keyboardSelecting=false;
  if(event.key==='Shift'&&!selecting){suppressSelection=altHeld()||hasAlt(event);keyboardSelecting=false;}
  if(event.shiftKey&&selectionKey(event.key))keyboardSelecting=true;
  if((selecting||event.shiftKey)&&hasAlt(event))suppressSelection=true;
  if(event.key==='Escape'&&drag){event.preventDefault();event.stopPropagation();cancelDrag();}
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!editor.hidden){event.preventDefault();copy();}
 });
 document.addEventListener('click',event=>{if(enabled&&!own(event.target)&&current?.type==='text'&&event.target.closest?.('a')&&current.range.intersectsNode(event.target.closest('a')))event.preventDefault();},true);
 document.addEventListener('sourcechange',event=>{if(event.target.matches?.('[data-code-viewer]')&&current?.range&&event.target.contains(current.range.startContainer)){cancelDrag();close(true);}},true);
 input.addEventListener('input',fit);
 editor.querySelector('[data-reader-annotation-cancel]').addEventListener('click',()=>close(true));confirm.addEventListener('click',copy);
 addEventListener('resize',()=>{if(current?.type==='text')current.anchor=current.range.getBoundingClientRect();position();});
 document.addEventListener('reify:before-navigate',()=>{if(pageSuspended)return;pageSuspended=true;save();scopeRevision++;pending=null;cancelDrag();resetEditor(true);releaseSelection();busy=false;input.disabled=false;confirm.disabled=false;setFloatingModal(editor,false);setFloatingParent(editor,null);});
 document.addEventListener('reify:after-navigate',()=>{pageSuspended=false;session=transientSession('reader');pending=session.read();enabled=Boolean(pending?.enabled);mode();restore();});
 Promise.resolve().then(restore);document.addEventListener('fpready',()=>requestAnimationFrame(restore));document.addEventListener('documentpagechange',restore);addEventListener('pagehide',save);addEventListener('beforeunload',save);return {toggle};
}
