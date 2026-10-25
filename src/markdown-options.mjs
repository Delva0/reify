import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {exactHeadings,sourceLocations} from './markdown.mjs';
import {mathMacros,mathThemeColors,mathStrict,mathTrust,createMathMacros} from './math-style.mjs';
export function markdownOptions(options={}){
 return {smartypants:false,remarkPlugins:[remarkGfm,remarkMath],rehypePlugins:[sourceLocations,exactHeadings,[rehypeKatex,{strict:mathStrict,trust:mathTrust,throwOnError:true,macros:{...mathMacros,...createMathMacros(options.mathAliases)}}],mathThemeColors],shikiConfig:{themes:{light:'github-light',dark:'github-dark'}}};
}
