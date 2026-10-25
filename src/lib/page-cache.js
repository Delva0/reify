export function createPageCache({fetcher=(...args)=>fetch(...args),limit=20}={}){
 const pages=new Map();
 const key=href=>{const url=new URL(href);url.hash='';return url.href;};
 const remember=(href,html)=>{const id=key(href);pages.delete(id);pages.set(id,html);while(pages.size>limit)pages.delete(pages.keys().next().value);return html;};
 return {
  remember,
  async read(href,{signal}={}){
   const id=key(href);if(signal?.aborted)throw signal.reason;
   if(pages.has(id)){const html=pages.get(id);pages.delete(id);pages.set(id,html);return html;}
   const response=await fetcher(id,{signal,credentials:'same-origin',headers:{Accept:'text/html'}});
   if(!response.ok)throw Error('页面读取失败（'+response.status+'）');
   const type=response.headers?.get('content-type');if(type&&!type.includes('text/html'))throw Error('目标不是 HTML 页面');
   const html=await response.text();if(signal?.aborted)throw signal.reason;return remember(id,html);
  }
 };
}
export const articlePageCache=createPageCache();
