import {webDocumentKey} from '../lib/web-navigation.js';
import {isRecord} from '../lib/data-types.js';
interface WebDocumentIndex {pages: Record<string,string>; external: string[]}
let pending: Promise<WebDocumentIndex | null> | undefined;const external=new Set<string>();
export function loadWebDocumentIndex(){
 pending??=fetch('/data/web-pages/index.json').then(response=>response.ok?response.json() as Promise<unknown>:null).then(value=>{
  if(!isRecord(value))return null;
  const pages: Record<string,string>={};if(isRecord(value.pages))for(const [key,asset]of Object.entries(value.pages))if(typeof asset==='string')pages[key]=asset;
  const links=Array.isArray(value.external)?value.external.filter((href): href is string=>typeof href==='string'):[];
  for(const href of links)try{external.add(webDocumentKey(href));}catch{}
  return {pages,external:links};
 }).catch(()=>null);return pending;
}
export const externalWebLinks=()=>[...external];
export const opensExternalWebPage=(href: string)=>{try{return external.has(webDocumentKey(href));}catch{return false;}};
