export function documentFormat({src,language}: {src?: string; language?: string}={}): 'md'|'mdx'|null{
 const path=src?new URL(src,'https://file.invalid/').pathname:'';
 if(/\.mdx$/i.test(path)||language==='mdx')return 'mdx';
 return /\.md$/i.test(path)||['md','markdown'].includes(language||'')?'md':null;
}
