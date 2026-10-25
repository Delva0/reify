import {normalizeCodeAnnotations} from './code-annotations.js';
import {parseLineRanges,normalizeLineRanges,validateFileTarget} from './code-props.js';
import {resourceLanguage} from './code-language.js';
export function normalizeCodeBlock(props){
 if(Object.hasOwn(props,'edits'))throw Error('CodeBlock 使用 notes、links、marks 定义标注');
 const {id,code,src,language,lines=[],render=true,scroll=false,expandable=true}=props;
 if(typeof id!=='string'||!id.trim()||id.length>256)throw Error('CodeBlock id 无效');
 if((src!==undefined)===(code!==undefined))throw Error('CodeBlock 必须且只能提供 code 或 src');
 if(code!==undefined&&typeof code!=='string')throw Error('CodeBlock code 必须为字符串');
 const target=src===undefined?undefined:validateFileTarget(src);
 if(language!==undefined&&(typeof language!=='string'||!language.trim()))throw Error('language 必须为非空字符串');
 for(const [key,value]of Object.entries({render,scroll,expandable}))if(typeof value!=='boolean')throw Error(key+' 必须为布尔值');
 if(typeof lines!=='string'&&!Array.isArray(lines))throw Error('lines 必须为字符串或数组');
 const ranges=typeof lines==='string'?parseLineRanges(lines):normalizeLineRanges(lines),filePath=target&&/^https?:/.test(target)?new URL(target).pathname:target;
 return {id,...(target===undefined?{code:code.replace(/\r\n?/g,'\n')}:{src:target}),language:language||resourceLanguage(filePath||''),ranges,...normalizeCodeAnnotations(props),render,scroll,expandable};
}
export const serializeCodeBlock=block=>JSON.stringify(block).replace(/</g,'\\u003c');
export function codeBlockDefinition(element){
 const template=element?.matches('template[data-code-definition]')?element:element?.querySelector('template[data-code-definition]');
 return template?JSON.parse(template.getAttribute('data-code-definition')):null;
}
