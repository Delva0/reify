import {isRecord} from '../lib/data-types.js';
export {isRecord};
export function jsonRecord(source: string,label='JSON'): Record<string,unknown>{
 const value: unknown=JSON.parse(source);if(!isRecord(value))throw Error(label+' 必须是对象');return value;
}
export function string(value: unknown,label: string): string{if(typeof value!=='string')throw Error(label+' 必须是字符串');return value;}
export function optionalString(value: unknown,label: string): string | undefined{return value===undefined?undefined:string(value,label);}
export function stringMap(value: unknown,label: string): Record<string,string>{
 if(!isRecord(value))throw Error(label+' 必须是对象');return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,string(item,label+'.'+key)]));
}
export interface SourceSnapshot {sha: string; files: {path: string; text?: string}[]}
export function sourceSnapshot(value: unknown): SourceSnapshot{
 if(!isRecord(value)||!Array.isArray(value.files))throw Error('源码快照无效');
 return {sha:string(value.sha,'sha'),files:value.files.map((item: unknown)=>{if(!isRecord(item))throw Error('源码文件无效');return {path:string(item.path,'path'),text:item.text===null?undefined:optionalString(item.text,'text')};})};
}
