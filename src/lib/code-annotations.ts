import {isRecord,errorMessage} from './data-types.js';
import type {RangeColor} from './data-types.js';
export interface SelectorPoint {line?: number; text?: string; pattern?: string; flags?: string; occurrence?: number}
export type CodeSelector = SelectorPoint & {from?: never; to?: never} | {from: SelectorPoint; to: SelectorPoint};
export interface CodeAnnotations {
 notes: {at: CodeSelector; desc: string}[];
 links: {at: CodeSelector; href: string}[];
 marks: {at: CodeSelector; color: RangeColor}[];
}
export interface CodeDecoration {note?: {desc: string}; link?: {href: string}; mark?: {color: RangeColor}}
export interface AnnotationRange {start: number; end: number; decorations: CodeDecoration}
const object=(value: unknown): value is Record<string,unknown>=>isRecord(value)&&Object.getPrototypeOf(value)===Object.prototype;
const own=(value: object,key: string)=>Object.hasOwn(value,key);
function keys(value: unknown,allowed: string[],label: string): asserts value is Record<string,unknown>{if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw Error(label+' 属性无效');}
function text(value: unknown,label: string,max=8192){if(typeof value!=='string'||!value.length||value.length>max)throw Error(label+' 无效');return value;}
function integer(value: unknown,label: string){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1)throw Error(label+' 必须为正整数');return value;}
function point(value: unknown,requireLine=false): SelectorPoint{
 keys(value,['line','text','pattern','flags','occurrence'],'at');
 if(requireLine||own(value,'line'))integer(value.line,'行号');
 if(own(value,'text')&&own(value,'pattern'))throw Error('at 的 text 与 pattern 互斥');
 if(own(value,'text'))text(value.text,'匹配文本');
 if(own(value,'pattern')){const pattern=text(value.pattern,'正则',4096);if(own(value,'flags')&&typeof value.flags!=='string')throw Error('flags 必须为字符串');try{new RegExp(pattern,typeof value.flags==='string'?value.flags:'');}catch(error){throw Error('正则无效：'+errorMessage(error));}}
 else if(own(value,'flags'))throw Error('flags 只能与 pattern 一起使用');
 if(own(value,'occurrence')){integer(value.occurrence,'出现次数');if(!own(value,'text')&&!own(value,'pattern'))throw Error('occurrence 需要 text 或 pattern');}
 if(!own(value,'line')&&!own(value,'text')&&!own(value,'pattern'))throw Error('at 需要行号、文本或正则');
 return {...value} as SelectorPoint;
}
export function normalizeCodeSelector(at: unknown): CodeSelector{
 if(object(at)&&(own(at,'from')||own(at,'to'))){keys(at,['from','to'],'跨行 at');const from=point(at.from,true),to=point(at.to,true);if(to.line!<from.line!)throw Error('终点行号小于起点');return {from,to};}
 return point(at);
}
export function normalizeCodeAnnotations(spec: unknown={}): CodeAnnotations{
 const {notes:rawNotes=[],links=[],marks=[]}=isRecord(spec)?spec:{};
 const notes=object(rawNotes)?Object.entries(rawNotes).map(([value,desc])=>({at:{text:value},desc})):rawNotes;
 if(!Array.isArray(notes)||!Array.isArray(links)||!Array.isArray(marks)||notes.length+links.length+marks.length>256)throw Error('代码标注应为数组，合计不能超过 256 条');
 const items=(values: unknown[],field: string,kind: string)=>values.map(item=>{keys(item,['at',field],kind);return {at:normalizeCodeSelector(item.at),value:text(item[field],field)};});
 return {
  notes:items(notes,'desc','notes').map(({at,value})=>({at,desc:value})),
  links:items(links,'href','links').map(({at,value})=>{let url;try{url=new URL(value,'https://code.invalid/');}catch{throw Error('link href 无效');}if(!['http:','https:','mailto:','tel:'].includes(url.protocol))throw Error('link href 协议无效');return {at,href:value};}),
  marks:items(marks,'color','marks').map(({at,value})=>{if(value!=='blue'&&value!=='amber'&&value!=='gray')throw Error('mark color 无效');return {at,color:value};})
 };
}
export function resolveCodeAnnotations(source: string,spec: unknown={}): AnnotationRange[]{
 const code=source.replace(/\r\n?/g,'\n'),lines=code.split('\n'),offsets: number[]=[];let cursor=0;
 for(const line of lines){offsets.push(cursor);cursor+=line.length+1;}
 function match(point: SelectorPoint,end=false){
  const base=point.line===undefined?0:offsets[point.line-1];if(base===undefined)throw Error('第 '+point.line+' 行超出代码');
  const value=point.line===undefined?code:lines[point.line-1];
  if(point.text===undefined&&point.pattern===undefined)return base+(end?value.length:0);
  let found: {index: number; 0: string} | null | undefined;
  if(point.text!==undefined){let start=-1;for(let n=0;n<(point.occurrence||1);n++){start=value.indexOf(point.text,start+1);if(start<0)break;}if(start>=0)found={index:start,0:point.text};}
  else{const flags=(point.flags||'').replace(/y/g,''),regex=new RegExp(point.pattern!,flags.includes('g')?flags:flags+'g');for(let n=0;n<(point.occurrence||1);n++){found=regex.exec(value);if(!found)break;if(!found[0].length)regex.lastIndex++;}}
  if(!found)throw Error('代码标注未匹配：'+JSON.stringify(point));return base+found.index+(end?found[0].length:0);
 }
 const groups=new Map<string, AnnotationRange>(),normalized=normalizeCodeAnnotations(spec);
 const items=[...normalized.notes.map(({at,desc})=>({at,kind:'note' as const,decoration:{desc}})),...normalized.links.map(({at,href})=>({at,kind:'link' as const,decoration:{href}})),...normalized.marks.map(({at,color})=>({at,kind:'mark' as const,decoration:{color}}))];
 for(const {at,kind,decoration}of items){
  const start=match(at.from||at),end=match(at.to||at,true);if(end<=start||!code.slice(start,end).replace(/\n/g,''))throw Error('代码标注范围为空或终点位于起点之前');
  const key=start+':'+end,range=groups.get(key)||{start,end,decorations:{}};if(range.decorations[kind])throw Error('同一范围不能重复定义 '+({note:'notes',link:'links',mark:'marks'}[kind]));
  Object.assign(range.decorations,{[kind]:decoration});groups.set(key,range);
 }
 const ranges=[...groups.values()].sort((a,b)=>a.start-b.start||a.end-b.end);
 for(let i=1;i<ranges.length;i++)if(ranges[i].start<ranges[i-1].end)throw Error('代码标注范围部分重叠，请在内容中显式拆分');return ranges;
}
export const hasCodeAnnotations=(spec: unknown)=>isRecord(spec)&&['notes','links','marks'].some(key=>Array.isArray(spec[key])?spec[key].length:object(spec[key])&&Object.keys(spec[key]).length);
