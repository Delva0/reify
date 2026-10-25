const fields=['repository','repositoryName','version','commit','mdxFile','sourceUrl','articlePage','url','title','scopeId'];
export function readingContext(element){
 const owner=element?.closest?.('[data-reading-context]');
 if(owner)try{const context=JSON.parse(owner.dataset.readingContext);if(context&&typeof context==='object')return {...Object.fromEntries(fields.filter(key=>typeof context[key]==='string').map(key=>[key,context[key]])),...(owner.dataset.readingScope?{scopeId:owner.dataset.readingScope}:{})};}catch{}
 return {...globalThis.document?.body?.dataset,url:globalThis.location?.href||'https://local.invalid/',title:globalThis.document?.title||''};
}
export function setReadingContext(element,context){element.dataset.readingContext=JSON.stringify(context);}
