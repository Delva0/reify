const object=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const own=(value,key)=>Object.hasOwn(value,key);
function keys(value,allowed,label){if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw Error(label+' 属性无效');}
function text(value,label,max=8192){if(typeof value!=='string'||!value.length||value.length>max)throw Error(label+' 无效');return value;}
function integer(value,label){if(!Number.isSafeInteger(value)||value<1)throw Error(label+' 必须为正整数');return value;}
function point(value,requireLine=false){
 keys(value,['line','text','pattern','flags','occurrence'],'at');
 if(requireLine||own(value,'line'))integer(value.line,'行号');
 if(own(value,'text')&&own(value,'pattern'))throw Error('at 的 text 与 pattern 互斥');
 if(own(value,'text'))text(value.text,'匹配文本');
 if(own(value,'pattern')){text(value.pattern,'正则',4096);if(own(value,'flags')&&typeof value.flags!=='string')throw Error('flags 必须为字符串');try{new RegExp(value.pattern,value.flags||'');}catch(error){throw Error('正则无效：'+error.message);}}
 else if(own(value,'flags'))throw Error('flags 只能与 pattern 一起使用');
 if(own(value,'occurrence')){integer(value.occurrence,'出现次数');if(!own(value,'text')&&!own(value,'pattern'))throw Error('occurrence 需要 text 或 pattern');}
 if(!own(value,'line')&&!own(value,'text')&&!own(value,'pattern'))throw Error('at 需要行号、文本或正则');
 return {...value};
}
export function normalizeCodeSelector(at){
 if(object(at)&&(own(at,'from')||own(at,'to'))){keys(at,['from','to'],'跨行 at');const from=point(at.from,true),to=point(at.to,true);if(to.line<from.line)throw Error('终点行号小于起点');return {from,to};}
 return point(at);
}
export function normalizeCodeAnnotations({notes=[],links=[],marks=[]}={}){
 if(object(notes))notes=Object.entries(notes).map(([value,desc])=>({at:{text:value},desc}));
 if(![notes,links,marks].every(Array.isArray)||notes.length+links.length+marks.length>256)throw Error('代码标注应为数组，合计不能超过 256 条');
 const result={notes:[],links:[],marks:[]};
 for(const [kind,items,field]of [['notes',notes,'desc'],['links',links,'href'],['marks',marks,'color']])for(const item of items){
  keys(item,['at',field],kind);const at=normalizeCodeSelector(item.at),value=text(item[field],field);
  if(kind==='links'){let url;try{url=new URL(value,'https://code.invalid/');}catch{throw Error('link href 无效');}if(!['http:','https:','mailto:','tel:'].includes(url.protocol))throw Error('link href 协议无效');}
  if(kind==='marks'&&!['blue','amber','gray'].includes(value))throw Error('mark color 无效');
  result[kind].push({at,[field]:value});
 }return result;
}
export function resolveCodeAnnotations(source,spec={}){
 const code=source.replace(/\r\n?/g,'\n'),lines=code.split('\n'),offsets=[];let cursor=0;
 for(const line of lines){offsets.push(cursor);cursor+=line.length+1;}
 function match(point,end=false){
  const base=point.line===undefined?0:offsets[point.line-1];if(base===undefined)throw Error('第 '+point.line+' 行超出代码');
  const value=point.line===undefined?code:lines[point.line-1];
  if(point.text===undefined&&point.pattern===undefined)return base+(end?value.length:0);
  let found;
  if(point.text!==undefined){let start=-1;for(let n=0;n<(point.occurrence||1);n++){start=value.indexOf(point.text,start+1);if(start<0)break;}if(start>=0)found={index:start,0:point.text};}
  else{const flags=(point.flags||'').replace(/y/g,''),regex=new RegExp(point.pattern,flags.includes('g')?flags:flags+'g');for(let n=0;n<(point.occurrence||1);n++){found=regex.exec(value);if(!found)break;if(!found[0].length)regex.lastIndex++;}}
  if(!found)throw Error('代码标注未匹配：'+JSON.stringify(point));return base+found.index+(end?found[0].length:0);
 }
 const groups=new Map(),normalized=normalizeCodeAnnotations(spec);
 for(const [kind,field,name]of [['notes','desc','note'],['links','href','link'],['marks','color','mark']])for(const item of normalized[kind]){
  const start=match(item.at.from||item.at),end=match(item.at.to||item.at,true);if(end<=start||!code.slice(start,end).replace(/\n/g,''))throw Error('代码标注范围为空或终点位于起点之前');
  const key=start+':'+end,range=groups.get(key)||{start,end,decorations:{}};if(range.decorations[name])throw Error('同一范围不能重复定义 '+kind);
  range.decorations[name]={[field]:item[field]};groups.set(key,range);
 }
 const ranges=[...groups.values()].sort((a,b)=>a.start-b.start||a.end-b.end);
 for(let i=1;i<ranges.length;i++)if(ranges[i].start<ranges[i-1].end)throw Error('代码标注范围部分重叠，请在内容中显式拆分');return ranges;
}
export const hasCodeAnnotations=spec=>['notes','links','marks'].some(key=>spec?.[key]?.length);
