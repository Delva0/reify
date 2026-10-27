import {isRecord} from './data-types.js';
export interface SessionStore<T> {key:string;read():T|null;write(value:T|null):void}
export function transientSession(name:string):SessionStore<Record<string,unknown>>;
export function transientSession<T extends object>(name:string,validate:(value:unknown)=>value is T):SessionStore<T>;
export function transientSession(name:string,validate?:(value:unknown)=>value is object):SessionStore<object>{
 const body=typeof document==='undefined'?null:document.body;
 const key=`transient-fp-v1:${typeof location==='undefined'?'':location.pathname}:${body?.dataset?.repositoryName||''}@${body?.dataset?.commit||''}:${name}`;
 return {
  key,
  read(){try{const value:unknown=JSON.parse(localStorage.getItem(key)||'null');if(validate)return validate(value)?value:null;return isRecord(value)?value:null;}catch{return null;}},
  write(value:object|null){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value));}catch{}},
 };
}
export interface NodeReference {path:number[];panel?:string;id?:string;page?:true}
export interface RangeReference {start:NodeReference|null;startOffset:number;end:NodeReference|null;endOffset:number;text:string}
export interface PanelGeometry {left?:string;top?:string;width?:string;height?:string;scrollTop?:number;scrollLeft?:number}
export function nodeReference(node:Node|null|undefined):NodeReference|null{
 if(!node)return null;
 const element=node.nodeType===1?node as Element:node.parentElement;
 const panel=element?.closest<HTMLElement>('[data-floating-panel]');
 let root:Node,owner:Omit<NodeReference,'path'>;
 if(panel?.dataset?.fpSessionId){root=panel;owner={panel:panel.dataset.fpSessionId};}
 else if(panel?.id){root=panel;owner={id:panel.id};}
 else{root=document.body;owner={page:true};}
 const path:number[]=[];
 for(let current:Node|null=node;current&&current!==root;current=current.parentNode){
  const parent=current.parentNode;if(!parent)return null;
  const index=[...parent.childNodes].indexOf(current as ChildNode);if(index<0)return null;path.unshift(index);
 }
 return {...owner,path};
}
export function resolveNode(reference:unknown):Node|null{
 if(!isRecord(reference)||!Array.isArray(reference.path)||!reference.path.every(index=>Number.isSafeInteger(index)&&index>=0))return null;
 let node:Node|null|undefined=typeof reference.panel==='string'?[...document.querySelectorAll<HTMLElement>('[data-fp-session-id]')].find(panel=>panel.dataset.fpSessionId===reference.panel):typeof reference.id==='string'?document.getElementById(reference.id):document.body;
 for(const index of reference.path){node=node?.childNodes?.[index as number];if(!node)return null;}
 return node||null;
}
export function rangeReference(range:Range|null|undefined):RangeReference|null{
 return range?{start:nodeReference(range.startContainer),startOffset:range.startOffset,end:nodeReference(range.endContainer),endOffset:range.endOffset,text:range.toString()}:null;
}
export function resolveRange(reference:unknown):Range|null{
 if(!isRecord(reference)||typeof reference.startOffset!=='number'||typeof reference.endOffset!=='number'||typeof reference.text!=='string')return null;
 const start=resolveNode(reference.start),end=resolveNode(reference.end);if(!start||!end)return null;
 try{const range=document.createRange();range.setStart(start,reference.startOffset);range.setEnd(end,reference.endOffset);return range.toString()===reference.text?range:null;}catch{return null;}
}
export function panelGeometry(panel:HTMLElement):PanelGeometry{
 const style=panel.style;
 return {left:style.left,top:style.top,width:style.width,height:style.height,scrollTop:panel.scrollTop||0,scrollLeft:panel.scrollLeft||0};
}
export function restorePanelGeometry(panel:HTMLElement,geometry:unknown){
 if(!isRecord(geometry))return;
 for(const name of ['left','top','width','height'] as const)if(typeof geometry[name]==='string')panel.style[name]=geometry[name];
 if(typeof geometry.scrollTop==='number'&&Number.isFinite(geometry.scrollTop))panel.scrollTop=geometry.scrollTop;
 if(typeof geometry.scrollLeft==='number'&&Number.isFinite(geometry.scrollLeft))panel.scrollLeft=geometry.scrollLeft;
}
function snapshotStore(action:(store:IDBObjectStore)=>IDBRequest):Promise<unknown>{
 if(typeof indexedDB==='undefined')return Promise.resolve(null);
 return new Promise(resolve=>{
  const request=indexedDB.open('reify-reader-drafts',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');
  request.onerror=()=>resolve(null);
  request.onsuccess=()=>{
   const db=request.result;
   try{const transaction=db.transaction('snapshots','readwrite'),result=action(transaction.objectStore('snapshots'));result.onsuccess=()=>resolve(result.result as unknown??null);result.onerror=()=>resolve(null);transaction.oncomplete=()=>db.close();transaction.onerror=()=>{db.close();resolve(null);};}catch{db.close();resolve(null);}
  };
 });
}
export async function saveReaderSnapshot(key:string,id:string,canvas:HTMLCanvasElement){
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(blob)await snapshotStore(store=>store.put({id,blob},key));
}
export const deleteReaderSnapshot=(key:string)=>snapshotStore(store=>store.delete(key));
export async function loadReaderSnapshot(key:string,id:string){
 const saved=await snapshotStore(store=>store.get(key));if(!isRecord(saved)||saved.id!==id||!(saved.blob instanceof Blob))return null;
 let image:ImageBitmap|HTMLImageElement;
 if(typeof createImageBitmap==='function')image=await createImageBitmap(saved.blob);
 else{const element=document.createElement('img'),url=URL.createObjectURL(saved.blob);image=element;try{element.src=url;await element.decode();}finally{URL.revokeObjectURL(url);}}
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');if(!context)return null;context.drawImage(image,0,0);if('close' in image)image.close();return canvas;
}
