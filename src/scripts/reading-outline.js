const headingSelector='h1,h2,h3,h4,h5,h6';

function headingId(link){
 if(link.dataset.heading)return link.dataset.heading;
 const hash=(link.getAttribute('href')||'').split('#')[1];
 try{return hash?decodeURIComponent(hash):'';}catch{return '';}
}

export function bindReadingOutline({article,viewport=globalThis.window,links,outline,offset=0,onScroll}={}){
 const getLinks=()=>Array.from(typeof links==='function'?links():links||[]);
 if(!article||!viewport||!getLinks().length)return {refresh(){},dispose(){}};
 const page=viewport===globalThis.window,events=article.closest?.('.code-block,[data-code-viewer]')||article;
 const position=()=>page?(viewport.scrollY||0):viewport.scrollTop;
 const bindings=[],on=(target,type,handler,options)=>{target?.addEventListener(type,handler,options);bindings.push([target,type,handler,options]);};
 let frame,dirty=true,active=true,entries=[],current,allLinks=[],inset=0,observed=[];
 const reveal=link=>{
  if(!outline||!link)return;
  const box=outline.getBoundingClientRect(),item=link.getBoundingClientRect();
  if(!box.height||!item.height)return;
  if(item.top<box.top+4)outline.scrollTop-=box.top+4-item.top;
  else if(item.bottom>box.bottom-4)outline.scrollTop+=item.bottom-box.bottom+4;
 };
 const observe=()=>{
  const targets=[article,article.querySelector(':scope > .document'),page?null:viewport,outline].filter((node,index,list)=>node&&list.indexOf(node)===index);
  if(targets.length===observed.length&&targets.every((node,index)=>node===observed[index]))return;
  observer?.disconnect();observed=targets;for(const node of targets)observer?.observe(node);
 };
 const measure=()=>{
  allLinks=getLinks();const byId=new Map();
  for(const link of allLinks){link.removeAttribute('aria-current');const id=headingId(link);if(id&&!byId.has(id))byId.set(id,link);}
  const top=position(),origin=page?0:viewport.getBoundingClientRect().top,documentView=article.closest?.('[data-file-document]')||null;
  entries=Array.from(article.querySelectorAll(headingSelector)).filter(heading=>byId.has(heading.id)&&(!heading.closest||heading.closest('[data-file-document]')===documentView)).map(heading=>({link:byId.get(heading.id),top:heading.getBoundingClientRect().top-origin+top})).sort((a,b)=>a.top-b.top);
  inset=Number(typeof offset==='function'?offset():offset)||0;current=undefined;observe();
 };
 const update=()=>{
  frame=undefined;if(!active)return;
  if(dirty){dirty=false;measure();}
  const top=position(),threshold=top+inset;let low=0,high=entries.length;
  while(low<high){const middle=(low+high)>>>1;if(entries[middle].top<=threshold)low=middle+1;else high=middle;}
  const next=entries[Math.max(0,low-1)]?.link;
  if(next!==current){current?.removeAttribute('aria-current');current=next;current?.setAttribute('aria-current','location');reveal(current);}
  onScroll?.(top);
 };
 const schedule=()=>{if(active&&frame===undefined)frame=requestAnimationFrame(update);};
 const refresh=()=>{dirty=true;schedule();};
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(refresh):null;
 on(viewport,'scroll',schedule,{passive:true});on(globalThis.window||globalThis,'resize',refresh,{passive:true});
 on(article,'load',refresh,true);on(article,'readingcontentchange',refresh);
 for(const type of ['codewrapchange','documentmodechange','panelresize'])on(events,type,refresh);
 refresh();
 return {refresh,dispose(){active=false;cancelAnimationFrame(frame);observer?.disconnect();for(const [target,type,handler,options]of bindings)target?.removeEventListener(type,handler,options);}};
}
