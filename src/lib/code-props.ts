import type {LineRange, LineRangeInput, RangeColor} from './data-types.js';
export function normalizeLineRanges(ranges: LineRangeInput[]=[]): LineRange[]{
 const sorted=ranges.map(range=>{if(range.color&&!['blue','amber','gray'].includes(range.color))throw Error('行范围颜色无效');return {from:range.from,to:range.to??range.from,...(range.color&&range.color!=='gray'?{color:range.color}:{})};});
 for(const range of sorted)if(!Number.isSafeInteger(range.from)||!Number.isSafeInteger(range.to)||range.from<1||range.to<range.from)throw Error('行范围无效');
 sorted.sort((a,b)=>a.from-b.from||a.to-b.to);const result: LineRange[]=[];
 for(const range of sorted){const last=result.at(-1);if(last&&range.from<=last.to&&last.color!==range.color)throw Error('不同颜色的行范围不能重叠');if(last&&range.from<=last.to+1&&last.color===range.color)last.to=Math.max(last.to,range.to);else result.push({...range});}
 return result;
}
export function parseLineRanges(value=''){
 if(!value)return [];
 if(value.length>8192)throw Error('行范围过长');
 return normalizeLineRanges(value.split(',').map(part=>{const match=part.trim().match(/^(\d+)(?:-(\d+))?(?:@(blue|amber|gray))?$/);if(!match)throw Error('行范围无效');return {from:Number(match[1]),to:Number(match[2]||match[1]),...(match[3]?{color:match[3] as RangeColor}:{})};}));
}
export const formatLineRanges=(ranges: LineRangeInput[])=>normalizeLineRanges(ranges).map(({from,to,color})=>(from===to?String(from):from+'-'+to)+(color?'@'+color:'')).join(',');
export function validateFilePath(file: unknown){
 if(typeof file!=='string'||!file||file.includes('\0')||file.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('文件路径无效');
 return file;
}
export const isWebFile=(file: string)=>/^https?:\/\//i.test(file);
export function validateFileTarget(file: string){
 if(isWebFile(file)){const url=new URL(file);if(url.username||url.password)throw Error('文件 URL 不支持登录信息');return url.href;}
 if(/^[a-z][\w+.-]*:/i.test(file))throw Error('文件 URL 仅支持 HTTP/HTTPS');
 return validateFilePath(file);
}
