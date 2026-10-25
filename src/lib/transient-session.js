export function transientSession(name){
 const body=typeof document==='undefined'?null:document.body;
 const key=`transient-fp-v1:${typeof location==='undefined'?'':location.pathname}:${body?.dataset?.repositoryName||''}@${body?.dataset?.commit||''}:${name}`;
 return {
  key,
  read(){try{const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'?value:null;}catch{return null;}},
  write(value){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value));}catch{}},
 };
}

export function nodeReference(node){
 if(!node)return null;
 const element=node.nodeType===1?node:node.parentElement;
 const panel=element?.closest?.('[data-floating-panel]');
 let root,owner;
 if(panel?.dataset?.fpSessionId){root=panel;owner={panel:panel.dataset.fpSessionId};}
 else if(panel?.id){root=panel;owner={id:panel.id};}
 else{root=document.body;owner={page:true};}
 const path=[];
 for(let current=node;current&&current!==root;current=current.parentNode){
  const parent=current.parentNode;if(!parent)return null;
  const index=[...parent.childNodes].indexOf(current);if(index<0)return null;path.unshift(index);
 }
 return {...owner,path};
}

export function resolveNode(reference){
 if(!reference||!Array.isArray(reference.path))return null;
 let node=reference.panel?[...document.querySelectorAll('[data-fp-session-id]')].find(panel=>panel.dataset.fpSessionId===reference.panel):reference.id?document.getElementById(reference.id):document.body;
 for(const index of reference.path){node=node?.childNodes?.[index];if(!node)return null;}
 return node||null;
}

export function rangeReference(range){
 return range?{start:nodeReference(range.startContainer),startOffset:range.startOffset,end:nodeReference(range.endContainer),endOffset:range.endOffset,text:range.toString()}:null;
}

export function resolveRange(reference){
 if(!reference)return null;
 const start=resolveNode(reference.start),end=resolveNode(reference.end);if(!start||!end)return null;
 try{const range=document.createRange();range.setStart(start,reference.startOffset);range.setEnd(end,reference.endOffset);return range.toString()===reference.text?range:null;}catch{return null;}
}

export function panelGeometry(panel){
 const style=panel.style;
 return {left:style.left,top:style.top,width:style.width,height:style.height,scrollTop:panel.scrollTop||0,scrollLeft:panel.scrollLeft||0};
}

export function restorePanelGeometry(panel,geometry){
 if(!geometry)return;
 for(const name of ['left','top','width','height'])if(typeof geometry[name]==='string')panel.style[name]=geometry[name];
 if(Number.isFinite(geometry.scrollTop))panel.scrollTop=geometry.scrollTop;
 if(Number.isFinite(geometry.scrollLeft))panel.scrollLeft=geometry.scrollLeft;
}

function snapshotStore(action){
 if(typeof indexedDB==='undefined')return Promise.resolve(null);
 return new Promise(resolve=>{
  const request=indexedDB.open('reify-reader-drafts',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');
  request.onerror=()=>resolve(null);
  request.onsuccess=()=>{
   const db=request.result;
   try{const transaction=db.transaction('snapshots','readwrite'),result=action(transaction.objectStore('snapshots'));result.onsuccess=()=>resolve(result.result??null);result.onerror=()=>resolve(null);transaction.oncomplete=()=>db.close();transaction.onerror=()=>{db.close();resolve(null);};}catch{db.close();resolve(null);}
  };
 });
}

export async function saveReaderSnapshot(key,id,canvas){
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(blob)await snapshotStore(store=>store.put({id,blob},key));
}
export const deleteReaderSnapshot=key=>snapshotStore(store=>store.delete(key));
export async function loadReaderSnapshot(key,id){
 const saved=await snapshotStore(store=>store.get(key));if(!saved||saved.id!==id)return null;
 let image;
 if(typeof createImageBitmap==='function')image=await createImageBitmap(saved.blob);
 else{image=document.createElement('img');const url=URL.createObjectURL(saved.blob);try{image.src=url;await image.decode();}finally{URL.revokeObjectURL(url);}}
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);image.close?.();return canvas;
}
