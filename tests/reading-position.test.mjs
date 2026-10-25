import assert from 'node:assert/strict';
import test from 'node:test';
import {readingPosition,restoreReadingPosition,rangeBackground} from '../src/lib/reading-position.js';

const area={scrollTop:0,getBoundingClientRect:()=>({top:100})};
const entry=(from,to,top,height)=>({from,to,node:{getBoundingClientRect:()=>({top:100+top-area.scrollTop,bottom:100+top-area.scrollTop+height,height})}});
const rows=Array.from({length:100},(_,index)=>entry(index+1,index+1,24+index*20,20));
const paragraphs=[entry(1,20,24,600),entry(21,50,648,900),entry(51,100,1572,1500)];

test('rendered and source views share a fractional source-line position',()=>{
 area.scrollTop=948;
 const position=readingPosition(area,paragraphs);
 assert(Math.abs(position.line-31.8)<1e-8);
 area.scrollTop=0;restoreReadingPosition(area,rows,position);
 assert(Math.abs(area.scrollTop-616)<1e-8);
 const sourcePosition=readingPosition(area,rows);
 assert(Math.abs(sourcePosition.line-position.line)<1e-8);
 area.scrollTop=0;restoreReadingPosition(area,paragraphs,sourcePosition);
 assert(Math.abs(area.scrollTop-948)<1e-8);
});

test('the most specific rendered source span wins over enclosing list items',()=>{
 area.scrollTop=0;
 assert.equal(readingPosition(area,[entry(1,80,0,800),entry(10,12,24,90)]).line,10);
});

test('each range paints one continuous band across paragraph and list spacing',()=>{
 area.scrollTop=0;
 const blocks=[entry(1,1,0,40),entry(3,3,60,30),entry(5,6,110,60),entry(10,12,240,60)];
 const background=rangeBackground(area,blocks,[{from:1,to:6},{from:10,to:12,color:'blue'}]);
 assert.equal((background.match(/linear-gradient/g)||[]).length,2);
 assert(background.includes('transparent 0px,var(--source-mark) 0px,var(--source-mark) 170px,transparent 170px'));
 assert(background.includes('transparent 240px,color-mix('));
 assert.equal(rangeBackground(area,blocks,[{from:90,to:100}]),'none');
});
