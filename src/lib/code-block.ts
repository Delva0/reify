import {normalizeCodeAnnotations} from './code-annotations.js';
import {parseLineRanges,normalizeLineRanges,validateFileTarget} from './code-props.js';
import {resourceLanguage} from './code-language.js';
import {isRecord} from './data-types.js';
import type {CodeDefinition} from './data-types.js';
export function normalizeCodeBlock(props: unknown): CodeDefinition{
 if(!isRecord(props))throw Error('CodeBlock 属性无效');
 if(Object.hasOwn(props,'edits'))throw Error('CodeBlock 使用 notes、links、marks 定义标注');
 const {id,code,src,language,lines=[],render=true,scroll=false,expandable=true}=props;
 if(typeof id!=='string'||!id.trim()||id.length>256)throw Error('CodeBlock id 无效');
 if((src!==undefined)===(code!==undefined))throw Error('CodeBlock 必须且只能提供 code 或 src');
 if(code!==undefined&&typeof code!=='string')throw Error('CodeBlock code 必须为字符串');
 if(src!==undefined&&typeof src!=='string')throw Error('CodeBlock src 必须为字符串');
 const target=src===undefined?undefined:validateFileTarget(src);
 if(language!==undefined&&(typeof language!=='string'||!language.trim()))throw Error('language 必须为非空字符串');
 if(typeof render!=='boolean'||typeof scroll!=='boolean'||typeof expandable!=='boolean')throw Error('render、scroll、expandable 必须为布尔值');
 if(typeof lines!=='string'&&!Array.isArray(lines))throw Error('lines 必须为字符串或数组');
 const ranges=typeof lines==='string'?parseLineRanges(lines):normalizeLineRanges(lines),filePath=target&&/^https?:/.test(target)?new URL(target).pathname:target;
 let source:{code:string}|{src:string};if(target===undefined){if(typeof code!=='string')throw Error('CodeBlock code 必须为字符串');source={code:code.replace(/\r\n?/g,'\n')};}else source={src:target};
 return {id,...source,language:language||resourceLanguage(filePath||''),ranges,...normalizeCodeAnnotations(props),render,scroll,expandable};
}
export const serializeCodeBlock=(block: CodeDefinition)=>JSON.stringify(block).replace(/</g,'\\u003c');
export function codeBlockDefinition(element: Element|null|undefined): CodeDefinition|null{
 const template=element?.matches('template[data-code-definition]')?element:element?.querySelector('template[data-code-definition]');
 if(!template)return null;
 const value: unknown=JSON.parse(template.getAttribute('data-code-definition')||'null');
 if(!isRecord(value))throw Error('CodeBlock 定义无效');
 return normalizeCodeBlock({...value,lines:value.ranges});
}
