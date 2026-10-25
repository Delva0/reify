import {createFileResourceCache} from '../lib/file-resource.js';
const entries=JSON.parse(document.querySelector('#file-resources')?.textContent||'{}');
const cache=createFileResourceCache(entries);let index;
export async function cachedFileResource(url){
 if(!entries[url]){index||=fetch('/data/file-cache/index.json').then(response=>response.ok?response.json():{}).then(data=>Object.assign(entries,data)).catch(()=>{index=undefined;});await index;}
 return cache.read(url);
}
export function warmArticleResources(){
 const warm=()=>cache.warm();if('requestIdleCallback'in window)requestIdleCallback(warm,{timeout:1500});else setTimeout(warm,0);
}
