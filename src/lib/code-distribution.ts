import type {RepositoryDirectories} from './github-files.js';
export function codeDistribution(directories: RepositoryDirectories){
 const counts=new Map<string,Map<string,number>>([['',new Map()]]);
 const add=(path: string,language: string,lines: number)=>{if(!counts.has(path))counts.set(path,new Map());const value=counts.get(path)!;value.set(language,(value.get(language)||0)+lines);};
 for(const [parent,children]of directories)for(const entry of children){
  if(entry.type!=='blob'||typeof entry.lines!=='number'||!Number.isSafeInteger(entry.lines)||entry.lines<0)continue;
  const path=parent?parent+'/'+entry.path:entry.path;
  const dot=entry.path.lastIndexOf('.'),extension=dot<0?entry.path:entry.path.slice(dot);
  add(path,extension,entry.lines);
  let directory=parent;
  while(true){add(directory,extension,entry.lines);if(!directory)break;const slash=directory.lastIndexOf('/');directory=slash<0?'':directory.slice(0,slash);}
 }
 const root=counts.get('')!;
 const languages=[...root].map(([language,lines])=>({language,lines})).sort((a,b)=>b.lines-a.lines||(a.language<b.language?-1:a.language>b.language?1:0));
 const total=languages.reduce((sum,item)=>sum+item.lines,0);
 return {languages,total,lines:(path: string,language: string)=>counts.get(path)?.get(language)||0};
}
export const share=(lines: number,total: number)=>total>0?Math.min(100,Math.max(0,100*lines/total)):0;
const compact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2});
export const compactLines=(lines: number)=>compact.format(lines);
export function distributionTip(path: string,{truncated=false,active=false,lines=0,percentage=0}: {truncated?: boolean;active?: boolean;lines?: number;percentage?: number}={}){
 const statistics=active&&lines>0;
 if(!truncated&&!statistics)return '';
 return [truncated?path:'',statistics?compactLines(lines)+' '+Math.round(percentage)+'%':''].filter(Boolean).join('\n');
}
