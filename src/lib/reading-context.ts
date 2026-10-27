import {isRecord} from './data-types.js';
import type {ReadingContext} from './data-types.js';
const fields=['repository','repositoryName','version','commit','mdxFile','sourceUrl','articlePage','url','title','scopeId'];
export function readingContext(element?: Element|null): ReadingContext & {url: string; title: string}{
 const owner=element?.closest<HTMLElement>('[data-reading-context]');
 if(owner)try{const value: unknown=JSON.parse(owner.dataset.readingContext||'null');if(isRecord(value)){const context: ReadingContext={};for(const key of fields)if(typeof value[key]==='string')context[key]=value[key];if(owner.dataset.readingScope)context.scopeId=owner.dataset.readingScope;return {...context,url:context.url||globalThis.location?.href||'https://local.invalid/',title:context.title||globalThis.document?.title||''};}}catch{}
 return {...globalThis.document?.body?.dataset,url:globalThis.location?.href||'https://local.invalid/',title:globalThis.document?.title||''};
}
export function setReadingContext(element: HTMLElement,context: ReadingContext){element.dataset.readingContext=JSON.stringify(context);}
