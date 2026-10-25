import {textContext,imageLocation,formatTextAnnotation} from '../lib/reader-location.js';
import {notice} from '../lib/dom.js';
import {retainSelection,releaseSelection,sameRange} from '../lib/selection.js';
import {registerFloatingPanel} from './floating-panels.js';
import {altHeld,hasAlt} from '../lib/alt.js';

let controller;
export function toggleReaderAnnotation(range){controller??=createController();controller.toggle(range);}

function createController(){
 const button=document.querySelector('.reader-annotation-mode'),editor=document.querySelector('.reader-annotation-editor');
 const input=editor.querySelector('textarea'),kind=editor.querySelector('.reader-annotation-kind'),status=editor.querySelector('[role=status]'),confirm=editor.querySelector('[data-reader-annotation-confirm]');
 let enabled=false,current=null,drag=null,outline=null,busy=false,selecting=false,suppressSelection=false,keyboardSelecting=false;
 const selectionKey=key=>/^(Arrow|Home$|End$|PageUp$|PageDown$)/.test(key);
 const own=node=>node instanceof Element&&Boolean(node.closest('[data-reader-annotation-ui]'));
 const resetEditor=clear=>{editor.hidden=true;current=null;outline?.remove();outline=null;status.textContent='';if(clear)input.value='';};
 const close=clear=>{resetEditor(clear);releaseSelection();};
 registerFloatingPanel(editor,()=>{if(!busy)close(true);});
 const position=()=>{if(!current||editor.hidden)return;const box=current.anchor,width=Math.min(400,innerWidth-32),height=editor.offsetHeight;editor.style.width=width+'px';editor.style.left=Math.max(16,Math.min(box.left,innerWidth-width-16))+'px';editor.style.top=Math.max(16,box.bottom+height+10<innerHeight?box.bottom+8:box.top-height-8)+'px';};
 const fit=()=>{input.style.height='auto';input.style.height=Math.min(220,Math.max(52,input.scrollHeight))+'px';position();};
 const open=entry=>{resetEditor(false);document.body.append(editor);current=entry;if(entry.type==='text')retainSelection(entry.range);else releaseSelection();kind.textContent=entry.type==='text'?'文本':'截图';confirm.disabled=entry.type==='image';editor.hidden=false;fit();requestAnimationFrame(()=>{input.focus({preventScroll:true});position();});};
 function toggle(range){enabled=!enabled;button.setAttribute('aria-pressed',String(enabled));document.documentElement.classList.toggle('reader-annotation-enabled',enabled);if(!enabled){cancelDrag();close(true);}else{selectText(range);import('./reader-image.js').catch(()=>{});}}
 function selectText(savedRange,automatic=false){
  if(!enabled||drag||busy||altHeld()||automatic&&suppressSelection)return;const selection=getSelection();
  if(!savedRange&&(!selection?.rangeCount||selection.isCollapsed))return;
  const range=(savedRange||selection.getRangeAt(0)).cloneRange();if(!range.toString().trim()||own(range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement)||current?.type==='text'&&sameRange(current.range,range))return;
  const rects=[...range.getClientRects()].filter(box=>box.width&&box.height&&box.bottom>0&&box.top<innerHeight),anchor=rects.at(-1)||range.getBoundingClientRect();
  open({type:'text',context:textContext(range),anchor,range});
 }
 function cancelDrag(){drag?.layer.remove();drag=null;document.documentElement.classList.remove('reader-annotation-capturing');}
 function updateDrag(event){if(!drag)return;const x=Math.max(0,Math.min(innerWidth,event.clientX)),y=Math.max(0,Math.min(innerHeight,event.clientY));drag.rect={left:Math.min(x,drag.x),top:Math.min(y,drag.y),right:Math.max(x,drag.x),bottom:Math.max(y,drag.y),width:Math.abs(x-drag.x),height:Math.abs(y-drag.y)};Object.assign(drag.box.style,{left:drag.rect.left+'px',top:drag.rect.top+'px',width:drag.rect.width+'px',height:drag.rect.height+'px'});}
 function beginDrag(event){
  if(!enabled||!event.ctrlKey||event.altKey||event.button!==0||own(event.target)||event.target.closest?.('header.repo-header')||busy)return;
  event.preventDefault();event.stopPropagation();close(false);getSelection()?.removeAllRanges();
  const layer=document.createElement('div'),box=document.createElement('div');layer.className='reader-annotation-capture';box.className='reader-annotation-region';layer.dataset.readerAnnotationUi='';layer.setAttribute('data-html2canvas-ignore','');layer.append(box);document.body.append(layer);
  drag={x:event.clientX,y:event.clientY,layer,box,rect:null};document.documentElement.classList.add('reader-annotation-capturing');layer.setPointerCapture(event.pointerId);updateDrag(event);
  layer.addEventListener('pointermove',updateDrag);
  layer.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
  layer.addEventListener('pointercancel',cancelDrag);
  layer.addEventListener('pointerup',event=>{
   updateDrag(event);const rect=drag?.rect;cancelDrag();if(!rect||rect.width<8||rect.height<8)return;
   const context=imageLocation(rect),capture={...rect,scrollX,scrollY,windowWidth:innerWidth,windowHeight:innerHeight};
   const entry={type:'image',context,anchor:rect,capture};open(entry);
   outline=document.createElement('div');outline.className='reader-annotation-region';outline.dataset.readerAnnotationUi='';outline.setAttribute('data-html2canvas-ignore','');Object.assign(outline.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});document.body.append(outline);
   entry.snapshot=import('./reader-image.js').then(({captureRegion})=>captureRegion(capture));
   entry.snapshot.then(()=>{if(current===entry)confirm.disabled=false;}).catch(error=>{if(current!==entry)return;status.textContent='截取失败，请重新框选';confirm.disabled=true;console.error('Capture failed',error);});
  },{once:true});
 }
 async function copy(){
  if(!current||busy||confirm.disabled)return;const entry=current,comment=input.value;busy=true;input.disabled=true;confirm.disabled=true;status.textContent='复制中…';
  try{
   if(entry.type==='text')await navigator.clipboard.writeText(formatTextAnnotation(entry.context,comment));
   else{if(typeof ClipboardItem!=='function')throw Error('当前浏览器不支持图片复制');const blob=entry.snapshot.then(async snapshot=>(await import('./reader-image.js')).annotationImage(snapshot,entry.context,comment));await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);}
   close(true);notice('已复制批注');
  }catch(error){status.textContent=error.message==='当前浏览器不支持图片复制'?error.message:'复制失败，请点击重试';}
  finally{busy=false;input.disabled=false;confirm.disabled=false;}
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
 addEventListener('resize',()=>{if(current?.type==='text')current.anchor=current.range.getBoundingClientRect();position();});return {toggle};
}
