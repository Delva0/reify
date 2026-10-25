import {webDocumentKey} from '../lib/web-navigation.js';

let pending;const external=new Set();
export function loadWebDocumentIndex(){
 pending??=fetch('/data/web-pages/index.json').then(response=>response.ok?response.json():null).then(index=>{
  for(const href of index?.external||[])try{external.add(webDocumentKey(href));}catch{}
  return index;
 }).catch(()=>null);
 return pending;
}
export const externalWebLinks=()=>[...external];
export const opensExternalWebPage=href=>{try{return external.has(webDocumentKey(href));}catch{return false;}};
