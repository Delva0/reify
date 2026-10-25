import rison from '../vendor/rison/rison.js';
import {validateFileTarget,parseLineRanges,formatLineRanges,normalizeLineRanges,isWebFile} from './code-props.js';

const decode=value=>{try{return decodeURIComponent(value);}catch{throw Error('fp 参数的 URL 编码无效');}};
const encode=value=>encodeURIComponent(value).replace(/%(?:2F|3A|40|24|2C)/g,decodeURIComponent);
const own=(object,key)=>Object.hasOwn(object,key);
export const fpTypes={code:{
 fields:['file','block','lines'],
 parse(fields){
  if(Object.keys(fields).some(key=>!this.fields.includes(key)))throw Error('code 包含不支持的属性');
  if(Object.values(fields).some(value=>typeof value!=='string'))throw Error('code 属性必须是字符串');
  if(own(fields,'file')===own(fields,'block'))throw Error('code 必须且只能指定 file 或 block');
  const props={...(own(fields,'file')?{file:validateFileTarget(fields.file)}:{block:fields.block}),ranges:parseLineRanges(fields.lines||'')};
  this.validate(props);return props;
 },
 validate(props){
  if(Object.keys(props).some(key=>!['file','block','ranges'].includes(key)))throw Error('code 包含不支持的属性');
  if(own(props,'file')===own(props,'block'))throw Error('code 必须且只能指定 file 或 block');
  if(own(props,'file'))validateFileTarget(props.file);
  if(own(props,'block')&&(typeof props.block!=='string'||!props.block.trim()||props.block.length>256))throw Error('block 无效');
  normalizeLineRanges(props.ranges);
  if(own(props,'block')&&props.ranges?.length)throw Error('block 的行范围定义于 CodeBlock');
 },
 format(props){return {...(props.file?{file:props.file}:{block:props.block}),...(props.ranges?.length?{lines:formatLineRanges(props.ranges)}:{})};}
}};

export function validateFpState(state=[]){
 if(!Array.isArray(state)||state.length>16)throw Error('fp 数量不能超过 16');
 for(const item of state){if(!item||!own(fpTypes,item.type))throw Error('不支持的 fp 类型：'+item?.type);fpTypes[item.type].validate(item.props||{});}
 return state;
}

const retiredKeys=['code','edit','edits','notes'];
const parameterKeys=()=>['fp',...new Set(Object.values(fpTypes).flatMap(type=>type.fields))];
export function parseFpUrl(href,base,{samePage=true}={}){
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
 const value=decode(fields.get('fp'));
 if(value.startsWith('!(')){
  if(fields.size!==1)throw Error('Rison fp 数组不能混用平铺属性');
  if(value.length>262144)throw Error('fp 参数过长');
  let records;try{records=rison.decode(value);}catch{throw Error('fp Rison 数组无效');}
  if(!Array.isArray(records))throw Error('fp 应为 Rison 数组');
  return validateFpState(records.map(record=>{
   if(!record||typeof record!=='object'||Array.isArray(record)||Object.getPrototypeOf(record)!==Object.prototype||!own(record,'type')||!own(fpTypes,record.type))throw Error('不支持的 fp 类型：'+record?.type);
   const {type,...props}=record;return {type,props:fpTypes[type].parse(props)};
  }));
 }
 if(!own(fpTypes,value))throw Error('不支持的 fp 类型：'+value);
 const props={};for(const [key,raw]of fields)if(key!=='fp')props[key]=decode(raw);
 return validateFpState([{type:value,props:fpTypes[value].parse(props)}]);
}

export function fpHref(state=[]){
 validateFpState(state);if(!state.length)return '';
 if(state.length===1){const {type,props}=state[0];return '?fp='+type+Object.entries(fpTypes[type].format(props)).map(([key,value])=>'&'+key+'='+(key==='file'&&isWebFile(value)?encodeURIComponent(value):encode(value))).join('');}
 const value=rison.encode(state.map(({type,props})=>({type,...fpTypes[type].format(props)})));if(value.length>262144)throw Error('fp 参数过长');
 return '?fp='+encode(value);
}

export function withFpState(href,state,base=href){
 const url=new URL(href,base),remaining=url.search.slice(1).split('&').filter(entry=>{const key=decode(entry.split('=')[0]||'');return key&&!parameterKeys().includes(key)&&!key.startsWith('fp.')&&!retiredKeys.includes(key);});
 url.search=[...remaining,fpHref(state).slice(1)].filter(Boolean).join('&');return url;
}
