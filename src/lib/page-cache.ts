export function createPageCache({fetcher=(...args: Parameters<typeof fetch>)=>fetch(...args),limit=20}: {fetcher?: typeof fetch;limit?: number}={}){
 const pages=new Map<string,string>();
 const key=(href: string)=>{const url=new URL(href);url.hash='';return url.href;};
 const remember=(href: string,html: string)=>{const id=key(href);pages.delete(id);pages.set(id,html);while(pages.size>limit)pages.delete(pages.keys().next().value!);return html;};
 return {
  remember,
  async read(href: string,{signal}: {signal?: AbortSignal}={}){
   const id=key(href);if(signal?.aborted)throw signal.reason;
   const cached=pages.get(id);if(cached!==undefined){pages.delete(id);pages.set(id,cached);return cached;}
   const response=await fetcher(id,{signal,credentials:'same-origin',headers:{Accept:'text/html'}});
   if(!response.ok)throw Error('页面读取失败（'+response.status+'）');
   const type=response.headers?.get('content-type');if(type&&!type.includes('text/html'))throw Error('目标不是 HTML 页面');
   const html=await response.text();if(signal?.aborted)throw signal.reason;return remember(id,html);
  }
 };
}
export const articlePageCache=createPageCache();
