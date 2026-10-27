import {createHash} from 'node:crypto';
export const codeBlockId=(content: string,props: Record<string,unknown>={})=>'code-'+createHash('sha256').update(String(props['data-mdx-line']||'')+'\0'+content).digest('hex').slice(0,12);
