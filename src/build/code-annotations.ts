import {resolveCodeAnnotations} from '../lib/code-annotations.js';
import {decorateCodeLine,hastCodeTree as tree} from '../lib/code-note-ranges.js';
import type {ShikiTransformer} from 'shiki';
import type {AnnotationRange} from '../lib/code-annotations.js';
export function codeAnnotations(spec: unknown={}): ShikiTransformer{
 let ranges: AnnotationRange[]=[];
 return {name:'code-annotations',preprocess(code){ranges=resolveCodeAnnotations(code,spec);},code(code){
  let offset=0;for(const line of code.children){if(line.type==='text'){offset+=line.value.length;continue;}if(!('children' in line))continue;const result=decorateCodeLine(line.children,offset,ranges,tree);offset+=result.length;if(result.children)line.children=result.children;}
 }};
}
