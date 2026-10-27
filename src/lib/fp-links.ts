import type {FpState, CodeProps, PageProps, FpPropsMap} from './data-types.js';
import {isRecord} from './data-types.js';
import rison from '../vendor/rison/rison.js';
import {validateFileTarget,parseLineRanges,formatLineRanges,normalizeLineRanges,isWebFile} from './code-props.js';

const decode=(value: string)=>{try{return decodeURIComponent(value);}catch{throw Error('fp 参数的 URL 编码无效');}};
const encode=(value: string)=>encodeURIComponent(value).replace(/%(?:2F|3A|40|24|2C)/g,decodeURIComponent);
const own=(object: object,key: PropertyKey)=>Object.hasOwn(object,key);
export interface FpDescriptor<Props> {
 fields: string[];
 parse(fields: Record<string,unknown>): Props;
 validate(props: Record<string,unknown>): void;
 format(props: Props): Record<string,string | undefined>;
}
export const fpTypes: {[K in keyof FpPropsMap]?: FpDescriptor<FpPropsMap[K]>}={code:{
 fields:['file','block','lines'],
 parse(fields: Record<string, unknown>){
  if(Object.keys(fields).some(key=>!this.fields.includes(key)))throw Error('code 包含不支持的属性');
  if(Object.values(fields).some(value=>typeof value!=='string'))throw Error('code 属性必须是字符串');
  if(own(fields,'file')===own(fields,'block'))throw Error('code 必须且只能指定 file 或 block');
  const props={...(own(fields,'file')?{file:validateFileTarget(fields.file as string)}:{block:fields.block as string}),ranges:parseLineRanges(typeof fields.lines==='string'?fields.lines:'')};
  this.validate(props);return props as CodeProps;
 },
 validate(props: Record<string, unknown>){
  if(Object.keys(props).some(key=>!['file','block','ranges'].includes(key)))throw Error('code 包含不支持的属性');
  if(own(props,'file')===own(props,'block'))throw Error('code 必须且只能指定 file 或 block');
  if(own(props,'file'))validateFileTarget(props.file as string);
  if(own(props,'block')&&(typeof props.block!=='string'||!props.block.trim()||props.block.length>256))throw Error('block 无效');
  normalizeLineRanges(props.ranges as CodeProps['ranges']);
  if(own(props,'block')&&(props.ranges as CodeProps['ranges'])?.length)throw Error('block 的行范围定义于 CodeBlock');
 },
 format(props: CodeProps){return {...(props.file?{file:props.file}:{block:props.block}),...(props.ranges?.length?{lines:formatLineRanges(props.ranges)}:{})};}
},page:{
 fields:['url'],
 parse(fields: Record<string, unknown>){this.validate(fields);return {url:fields.url as string};},
 validate(props: Record<string, unknown>){
  if(Object.keys(props).some(key=>key!=='url')||typeof props.url!=='string'||!props.url||props.url.length>16384)throw Error('page 需要有效的 url');
  let url;try{url=new URL(props.url,'https://page.invalid/');}catch{throw Error('网页 URL 无效');}
  if(!/^https?:$/.test(url.protocol)||url.username||url.password)throw Error('网页 URL 仅支持无登录信息的 HTTP/HTTPS');
 },
 format(props: PageProps){return {url:props.url};}
}};

function descriptor<K extends keyof FpPropsMap>(type: K): FpDescriptor<FpPropsMap[K]> {
 const entry=fpTypes[type];if(!entry)throw Error('不支持的 fp 类型：'+type);return entry;
}
export function validateFpState(state: unknown=[]): FpState[]{
 if(!Array.isArray(state)||state.length>16)throw Error('fp 数量不能超过 16');
 for(const item of state){if(!isRecord(item)||!isFpType(item.type))throw Error('不支持的 fp 类型：'+(isRecord(item)?item.type:undefined));if(!isRecord(item.props))throw Error('fp 属性无效');descriptor(item.type).validate(item.props);}
 return state as FpState[];
}

const isFpType=(value: unknown): value is FpState['type']=>typeof value==='string'&&own(fpTypes,value);
const parseProps=(type: FpState['type'],props: Record<string, unknown>): FpState=>({type,props:descriptor(type).parse(props)}) as FpState;
const formatProps=(state: FpState)=>descriptor(state.type).format(state.props);
const retiredKeys=['code','edit','edits','notes'];
const parameterKeys=()=>['fp',...new Set(Object.values(fpTypes).flatMap(type=>type?.fields||[]))];
export function parseFpUrl(href: string | null | undefined,base: string,{samePage=true}={}): FpState[] | null{
 if(!href||href.startsWith('#'))return null;
 const current=new URL(base),url=new URL(href,current);
 if(url.origin!==current.origin||(samePage&&url.pathname!==current.pathname))return null;
 const fields=new Map();
 for(const entry of url.search.slice(1).split('&')){
  if(!entry)continue;const at=entry.indexOf('='),key=decode(at<0?entry:entry.slice(0,at));
  if(key.startsWith('fp.')||retiredKeys.includes(key))throw Error('请使用 fp=code&block=代码块ID；标注定义于 CodeBlock');
  if(!parameterKeys().includes(key))continue;
  if(fields.has(key))throw Error('fp 参数重复：'+key);fields.set(key,at<0?'':entry.slice(at+1));
 }
 if(!fields.has('fp'))return null;
 const value=decode(fields.get('fp')!);
 if(value.startsWith('!(')){
  if(fields.size!==1)throw Error('Rison fp 数组不能混用平铺属性');
  if(value.length>262144)throw Error('fp 参数过长');
  let records: unknown;try{records=rison.decode(value);}catch{throw Error('fp Rison 数组无效');}
  if(!Array.isArray(records))throw Error('fp 应为 Rison 数组');
  return validateFpState(records.map(record=>{
   if(!isRecord(record)||Object.getPrototypeOf(record)!==Object.prototype||!own(record,'type')||!isFpType(record.type))throw Error('不支持的 fp 类型：'+(isRecord(record)?record.type:undefined));
   const {type,...props}=record;return parseProps(type as FpState['type'],props);
  }));
 }
 if(!isFpType(value))throw Error('不支持的 fp 类型：'+value);
 const props: Record<string, string>={};for(const [key,raw]of fields)if(key!=='fp')props[key]=decode(raw);
 return validateFpState([parseProps(value,props)]);
}

export function fpHref(state: FpState[]=[]){
 validateFpState(state);if(!state.length)return '';
 if(state.length===1){const {type}=state[0];return '?fp='+type+Object.entries(formatProps(state[0])).map(([key,value])=>'&'+key+'='+(key==='file'&&isWebFile(String(value))?encodeURIComponent(String(value)):encode(String(value)))).join('');}
 const value=rison.encode(state.map(item=>({type:item.type,...formatProps(item)})));if(value.length>262144)throw Error('fp 参数过长');
 return '?fp='+encode(value);
}

export function withFpState(href: string,state: FpState[],base=href){
 const url=new URL(href,base),remaining=url.search.slice(1).split('&').filter(entry=>{const key=decode(entry.split('=')[0]||'');return key&&!parameterKeys().includes(key)&&!key.startsWith('fp.')&&!retiredKeys.includes(key);});
 url.search=[...remaining,fpHref(state).slice(1)].filter(Boolean).join('&');return url;
}
