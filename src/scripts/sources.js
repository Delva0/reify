const snapshots=new Map(),highlights=new Map();
const sourceUrl=()=>document.body.dataset.sourceUrl||'/data/source-data.json';
export function loadSourceData(){
 const url=sourceUrl();if(!snapshots.has(url))snapshots.set(url,fetch(url).then(response=>{if(!response.ok)throw Error('Source data HTTP '+response.status);return response.json();}).then(data=>{if(!Array.isArray(data.files))throw Error('Invalid source data');return {...data,index:new Map(data.files.map(file=>[file.path,file]))};}).catch(error=>{snapshots.delete(url);throw error;}));
 return snapshots.get(url);
}
export async function bundledSource(file){
 if(!document.body.dataset.sourceUrl)return null;
 const data=await loadSourceData();if(data.sha!==document.body.dataset.commit)return null;
 const source=data.index.get(file);if(typeof source?.text!=='string')return null;
 const key=data.sha+':'+file;
 if(!highlights.has(key))highlights.set(key,fetch('/data/highlight/'+encodeURIComponent(data.sha)+'/'+file.split('/').map(encodeURIComponent).join('/')+'.html').then(response=>{if(!response.ok)throw Error('Source highlight HTTP '+response.status);return response.text();}).catch(error=>{highlights.delete(key);throw error;}));
 const html=await highlights.get(key);
 const pre=new DOMParser().parseFromString(html,'text/html').querySelector('pre');if(!pre)throw Error('Invalid source highlight');pre.classList.add('astro-code');
 return pre;
}
export async function sourceText(file){return (await loadSourceData()).index.get(file)?.text;}
