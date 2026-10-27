import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type {PluggableList} from 'unified';
import type {RehypeShikiOptions} from '@shikijs/rehype';
import {exactHeadings,sourceLocations} from './markdown.js';
import {mathMacros,mathThemeColors,mathStrict,mathTrust,createMathMacros} from './math-style.js';
import type {MathAliases} from './math-style.js';
// The article build and file previews consume this same Markdown policy.
export function markdownOptions(options: {mathAliases?: MathAliases}={}){
 return {
  smartypants:false,
  remarkPlugins:[remarkGfm,remarkMath] satisfies PluggableList,
  rehypePlugins:[sourceLocations,exactHeadings,[rehypeKatex,{strict:mathStrict,trust:mathTrust,throwOnError:true,macros:{...mathMacros,...createMathMacros(options.mathAliases)}}],mathThemeColors] satisfies PluggableList,
  shikiConfig:{themes:{light:'github-light',dark:'github-dark'}} satisfies RehypeShikiOptions
 };
}
