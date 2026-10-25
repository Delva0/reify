const clamp=value=>Math.max(0,Math.min(1,value));
const span=entry=>entry.to-entry.from+1;

// Source lines are the common coordinate system for rendered and source views.
export function readingPosition(area,entries,inset=24){
 if(!area||!entries.length)return null;
 const edge=area.getBoundingClientRect().top+inset;
 const measured=entries.map(entry=>({...entry,box:entry.node.getBoundingClientRect()})).filter(entry=>entry.box.height>0);
 const containing=measured.filter(entry=>entry.box.top<=edge&&entry.box.bottom>edge).sort((a,b)=>span(a)-span(b));
 const entry=containing[0]||measured.find(entry=>entry.box.top>edge)||measured.at(-1);
 if(!entry)return null;
 return {line:entry.from+clamp((edge-entry.box.top)/entry.box.height)*span(entry)};
}

export function restoreReadingPosition(area,entries,position,inset=24){
 if(!area||!entries.length||!position)return;
 const distance=entry=>position.line<entry.from?entry.from-position.line:Math.max(0,position.line-entry.to-1);
 const entry=[...entries].sort((a,b)=>distance(a)-distance(b)||span(a)-span(b))[0];
 const box=entry.node.getBoundingClientRect();
 area.scrollTop=Math.max(0,area.scrollTop+box.top-area.getBoundingClientRect().top+clamp((position.line-entry.from)/span(entry))*box.height-inset);
}

export function sourceLineEntries(pre){
 if(!pre)return [];
 const rows=[...pre.querySelectorAll('.source-line')];
 return (rows.length?rows:[...pre.querySelectorAll(':scope > code > .line')]).map((node,index)=>({node,from:index+1,to:index+1}));
}

// Paint each source range as one band without wrapping or moving article nodes.
export function rangeBackground(area,entries,ranges){
 if(!area||!ranges.length)return 'none';
 const origin=area.getBoundingClientRect().top;
 const colors={gray:'var(--source-mark)',blue:'color-mix(in srgb,var(--math-primary) 12%,transparent)',amber:'color-mix(in srgb,var(--math-secondary) 12%,transparent)'};
 return ranges.map(range=>{
  const boxes=entries.filter(entry=>entry.from<=range.to&&entry.to>=range.from).map(entry=>entry.node.getBoundingClientRect()).filter(box=>box.height>0);
  if(!boxes.length)return null;
  const top=Math.max(0,Math.min(...boxes.map(box=>box.top))-origin),bottom=Math.max(...boxes.map(box=>box.bottom))-origin;
  return `linear-gradient(to bottom,transparent ${top}px,${colors[range.color]||colors.gray} ${top}px,${colors[range.color]||colors.gray} ${bottom}px,transparent ${bottom}px)`;
 }).filter(Boolean).join(',')||'none';
}
