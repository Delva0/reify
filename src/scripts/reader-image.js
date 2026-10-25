import {sourceLabel} from '../lib/reader-location.js';

export async function captureRegion(rect){
 const {default:html2canvas}=await import('html2canvas');
 await document.fonts.ready;
 const dialogs=[...document.querySelectorAll('dialog[open]')].map(node=>({id:node.id,rect:node.getBoundingClientRect(),zIndex:getComputedStyle(node).zIndex}));
 return html2canvas(document.body,{
  x:rect.left+rect.scrollX,y:rect.top+rect.scrollY,width:Math.ceil(rect.width),height:Math.ceil(rect.height),
  scrollX:rect.scrollX,scrollY:rect.scrollY,windowWidth:rect.windowWidth,windowHeight:rect.windowHeight,
  scale:Math.min(devicePixelRatio||1,2),useCORS:true,logging:false,imageTimeout:10000,
  backgroundColor:getComputedStyle(document.body).backgroundColor,
  ignoreElements:node=>Boolean(node.closest?.('[data-reader-annotation-ui]')),
  onclone:doc=>{
   doc.documentElement.classList.remove('reader-annotation-enabled','reader-annotation-capturing');
   for(const {id,rect:box,zIndex}of dialogs){const dialog=doc.getElementById(id);if(dialog)Object.assign(dialog.style,{position:'fixed',left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px',margin:'0',zIndex});}
  }
 });
}

export function wrapText(text,measure,width){
 const lines=[];
 for(const paragraph of String(text).split('\n')){
  let line='';for(const character of Array.from(paragraph)){if(line&&measure(line+character)>width){lines.push(line);line='';}line+=character;}lines.push(line);
 }return lines;
}

export async function annotationImage(snapshot,context,comment){
 const scale=snapshot.width/context.rectangle.width,width=Math.max(context.rectangle.width,400),padding=18;
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*scale);
 const ctx=canvas.getContext('2d'),style=getComputedStyle(document.documentElement),family=getComputedStyle(document.body).fontFamily;
 const font=Math.max(16,Math.min(24,Math.round(width/45))),lineHeight=Math.round(font*1.65),metaFont=12,metaHeight=19;
 ctx.font=`${metaFont*scale}px ${family}`;
 const metadata=[context.repository+(context.commit||context.version?' @ '+(context.commit||context.version):''),context.headings.join(' / '),sourceLabel(context),context.url].filter(Boolean);
 const metaLines=metadata.flatMap(text=>wrapText(text,value=>ctx.measureText(value).width/scale,width-padding*2));
 ctx.font=`${font*scale}px ${family}`;
 const commentLines=wrapText(comment,value=>ctx.measureText(value).width/scale,width-padding*2);
 const imageHeight=snapshot.height/scale,footerHeight=padding*2+metaLines.length*metaHeight+14+commentLines.length*lineHeight;
 canvas.height=Math.ceil((imageHeight+footerHeight)*scale);if(canvas.height>30000)throw Error('批注过长，无法生成图片');
 ctx.scale(scale,scale);ctx.fillStyle=style.getPropertyValue('--paper').trim()||'#fff';ctx.fillRect(0,0,width,imageHeight+footerHeight);
 ctx.drawImage(snapshot,(width-snapshot.width/scale)/2,0,snapshot.width/scale,imageHeight);
 ctx.strokeStyle=style.getPropertyValue('--line').trim()||'#ccc';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,imageHeight+.5);ctx.lineTo(width,imageHeight+.5);ctx.stroke();
 ctx.textBaseline='top';ctx.font=`${metaFont}px ${family}`;ctx.fillStyle=style.getPropertyValue('--muted').trim()||'#777';
 let y=imageHeight+padding;for(const line of metaLines){ctx.fillText(line,padding,y);y+=metaHeight;}
 y+=14;ctx.font=`${font}px ${family}`;ctx.fillStyle=style.getPropertyValue('--ink').trim()||'#111';for(const line of commentLines){ctx.fillText(line,padding,y);y+=lineHeight;}
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('图片生成失败')),'image/png'));
}
