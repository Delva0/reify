import assert from 'node:assert/strict';
import {NonemptyLines} from '../dist/vendor/ghloc-counter/nonempty-lines.js';
const fixtures=[['',0],[' \t\r\n\n',0],['a\n\n b\t\nend',3],['a\r\nb\r\n',2],['中文\n// comment\n',2],['line\n\x00binary',1],['\x0c',1]];
for(const [text,expected]of fixtures){
 const bytes=Buffer.from(text);
 for(let width=1;width<=Math.max(1,bytes.length);width++){
  const counter=new NonemptyLines();for(let start=0;start<bytes.length;start+=width)counter.write(bytes.subarray(start,start+width));
  assert.equal(counter.result(),expected,JSON.stringify(text)+' chunk='+width);
 }
}
console.log('ghloc counter: original byte-level rules preserved across chunk boundaries, Unicode, final lines, empty files, and binary files');
