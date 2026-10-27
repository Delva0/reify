import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {NonemptyLines} from '../vendor/ghloc-counter/nonempty-lines.js';

export async function gitBlobLines(checkout: string,objects: string[]){
 if(!objects.length)return new Map<string,number>();
 const child=spawn('git',['-C',checkout,'cat-file','--batch'],{stdio:['pipe','pipe','pipe']});
 const completed=once(child,'close');let errors='';child.stderr.on('data',chunk=>{errors+=chunk;});child.stdin.on('error',()=>{});
 child.stdin.end(objects.join('\n')+'\n');
 const results=new Map<string,number>();let stage='header',header=Buffer.alloc(0),remaining=0,current=0,counter: NonemptyLines | undefined;
 for await(const chunk of child.stdout){
  let offset=0;
  while(offset<chunk.length){
   if(stage==='header'){
    const end=chunk.indexOf(10,offset);
    if(end<0){header=Buffer.concat([header,chunk.subarray(offset)]);break;}
    header=Buffer.concat([header,chunk.subarray(offset,end)]);
    const [object,type,size]=header.toString('ascii').split(' ');header=Buffer.alloc(0);remaining=Number(size);
    if(object!==objects[current]||type!=='blob'||!Number.isSafeInteger(remaining)||remaining<0){child.kill();throw Error('Invalid Git blob response');}
    counter=new NonemptyLines();stage=remaining?'body':'separator';offset=end+1;
   }else if(stage==='body'){
    if(!counter)throw Error('Missing Git blob counter');const length=Math.min(remaining,chunk.length-offset);counter.write(chunk.subarray(offset,offset+length));remaining-=length;offset+=length;if(!remaining)stage='separator';
   }else{
    if(chunk[offset++]!==10){child.kill();throw Error('Invalid Git blob separator');}
    if(!counter)throw Error('Missing Git blob counter');results.set(objects[current++],counter.result());stage='header';
   }
  }
 }
 const [status]=await completed;if(status!==0||current!==objects.length||stage!=='header')throw Error(errors||'Incomplete Git blob stream');
 return results;
}
