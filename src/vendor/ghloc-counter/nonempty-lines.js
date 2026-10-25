// Translated from subtle-byte/ghloc internal/service/loc_count/file_counter.go,
// 4d52e65853353de0709214e818e6d7bcbf525f36.
// Copyright (c) 2021 Maksim Meshkov. MIT; see LICENSE.
export class NonemptyLines{
 lines=0;nonSpace=false;binary=false;
 write(bytes){
  if(this.binary)return;
  for(const byte of bytes){
   if(byte>32)this.nonSpace=true;
   else if(byte===10){if(this.nonSpace)++this.lines;this.nonSpace=false;}
   else if(byte!==32&&byte!==9&&byte!==13){this.binary=true;return;}
  }
 }
 result(){return this.binary?1:this.lines+(this.nonSpace?1:0);}
}
