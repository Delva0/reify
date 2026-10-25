let sourcePromise;
let sourceFiles;
let sourceCommit;
const highlights=new Map();
export function loadSourceData(){
 if(!sourcePromise)sourcePromise=fetch(document.body.dataset.sourceUrl||'/data/source-data.json').then(response=>{if(!response.ok)throw Error('Source data HTTP '+response.status);return response.json();}).then(data=>{if(!Array.isArray(data.files))throw Error('Invalid source data');sourceCommit=data.sha;sourceFiles=new Map(data.files.map(file=>[file.path,file]));return data;}).catch(error=>{sourcePromise=undefined;sourceFiles=undefined;throw error;});
 return sourcePromise;
}
export async function bundledSource(file){
 if(!document.body.dataset.sourceUrl)return null;
 await loadSourceData();if(sourceCommit!==document.body.dataset.commit)return null;
 const source=sourceFiles.get(file);if(typeof source?.text!=='string')return null;
 if(!highlights.has(file))highlights.set(file,fetch('/data/highlight/'+encodeURIComponent(sourceCommit)+'/'+file.split('/').map(encodeURIComponent).join('/')+'.html').then(response=>{if(!response.ok)throw Error('Source highlight HTTP '+response.status);return response.text();}).catch(error=>{highlights.delete(file);throw error;}));
 const html=await highlights.get(file);
 const pre=new DOMParser().parseFromString(html,'text/html').querySelector('pre');if(!pre)throw Error('Invalid source highlight');pre.classList.add('astro-code');
 return pre;
}
export async function sourceText(file){await loadSourceData();return sourceFiles.get(file)?.text;}
