import type {LineRange} from './data-types.js';
export interface ReadingLineEntry {node: Element; from: number; to: number}
export interface ReadingPosition {line: number}
const clamp=(value: number)=>Math.max(0,Math.min(1,value));
const span=(entry: Pick<ReadingLineEntry,'from'|'to'>)=>entry.to-entry.from+1;
export function readingPosition(area: Element|null|undefined,entries: ReadingLineEntry[],inset=24): ReadingPosition|null{
 if(!area||!entries.length)return null;
 const edge=area.getBoundingClientRect().top+inset;
 const measured=entries.map(entry=>({...entry,box:entry.node.getBoundingClientRect()})).filter(entry=>entry.box.height>0);
 const containing=measured.filter(entry=>entry.box.top<=edge&&entry.box.bottom>edge).sort((a,b)=>span(a)-span(b));
 const entry=containing[0]||measured.find(entry=>entry.box.top>edge)||measured.at(-1);
 if(!entry)return null;
 return {line:entry.from+clamp((edge-entry.box.top)/entry.box.height)*span(entry)};
}
export function restoreReadingPosition(area: Element|null|undefined,entries: ReadingLineEntry[],position: ReadingPosition|null|undefined,inset=24){
 if(!area||!entries.length||!position)return;
 const distance=(entry: ReadingLineEntry)=>position.line<entry.from?entry.from-position.line:Math.max(0,position.line-entry.to-1);
 const entry=[...entries].sort((a,b)=>distance(a)-distance(b)||span(a)-span(b))[0];
 const box=entry.node.getBoundingClientRect();
 area.scrollTop=Math.max(0,area.scrollTop+box.top-area.getBoundingClientRect().top+clamp((position.line-entry.from)/span(entry))*box.height-inset);
}
export function sourceLineEntries(pre: Element|null|undefined): ReadingLineEntry[]{
 if(!pre)return [];
 const rows=[...pre.querySelectorAll('.source-line')];
 return (rows.length?rows:[...pre.querySelectorAll(':scope > code > .line')]).map((node,index)=>({node,from:index+1,to:index+1}));
}
export function rangeBackground(area: Element|null|undefined,entries: ReadingLineEntry[],ranges: LineRange[]){
 if(!area||!ranges.length)return 'none';
 const origin=area.getBoundingClientRect().top;
 const colors={gray:'var(--source-mark)',blue:'color-mix(in srgb,var(--math-primary) 12%,transparent)',amber:'color-mix(in srgb,var(--math-secondary) 12%,transparent)'};
 return ranges.map(range=>{
  const boxes=entries.filter(entry=>entry.from<=range.to&&entry.to>=range.from).map(entry=>entry.node.getBoundingClientRect()).filter(box=>box.height>0);
  if(!boxes.length)return null;
  const top=Math.max(0,Math.min(...boxes.map(box=>box.top))-origin),bottom=Math.max(...boxes.map(box=>box.bottom))-origin,color=colors[range.color||'gray']||colors.gray;
  return `linear-gradient(to bottom,transparent ${top}px,${color} ${top}px,${color} ${bottom}px,transparent ${bottom}px)`;
 }).filter(Boolean).join(',')||'none';
}
