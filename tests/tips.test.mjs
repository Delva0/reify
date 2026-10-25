import assert from 'node:assert/strict';
import {initTips} from '../src/scripts/tips.js';
const saved=new Map(),events=new Map();
const install=(name,value)=>{saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});};
class Control{
 constructor(label,tip){this.dataset=tip?{tip}:{};this.attrs=new Map([['aria-label',label]]);this.style={};this.isConnected=true;this.classList={contains:()=>false};}
 closest(){return this;}contains(node){return node===this;}
 getAttribute(name){return this.attrs.get(name);}setAttribute(name,value){this.attrs.set(name,value);}removeAttribute(name){this.attrs.delete(name);}
 getBoundingClientRect(){return {left:100,right:128,top:100,bottom:128,width:28,height:28};}
}
const tip={id:'control-tip',style:{},hidden:true,offsetWidth:200,offsetHeight:40},expand=new Control('展开代码浮窗','展开'),close=new Control('关闭'),copy=new Control('复制代码','复制'),version=new Control('选择仓库版本，当前 cef0cc5','切换版本');
const fire=(type,extra={})=>events.get(type)?.({type,buttons:0,...extra});
try{
 install('innerWidth',1000);install('innerHeight',800);install('document',{querySelector:()=>tip,addEventListener:(type,fn)=>events.set(type,fn)});install('addEventListener',()=>{});
 initTips();expand.setAttribute('aria-describedby','existing');fire('pointerover',{target:expand});assert.equal(tip.textContent,'展开');assert(!tip.hidden);assert.equal(expand.getAttribute('aria-describedby'),'existing control-tip');
 fire('pointerdown',{target:expand});fire('focusin',{target:close});assert(tip.hidden,'opening a panel and automatically focusing Close must not show a tip');assert.equal(expand.getAttribute('aria-describedby'),'existing','existing accessibility descriptions remain');
 fire('keydown',{key:'Tab'});fire('focusin',{target:close});assert(!tip.hidden);assert.equal(tip.textContent,'关闭','explicit keyboard navigation shows the same tip');
 fire('keyup',{key:'Tab'});fire('focusout',{target:close});fire('focusin',{target:copy});assert(tip.hidden,'later automatic focus does not inherit a previous Tab gesture');
 fire('keydown',{key:'Enter'});fire('focusout',{target:close});fire('focusin',{target:copy});assert(tip.hidden,'programmatic focus after activation is not treated as Tab navigation');
 fire('pointerover',{target:copy});assert.equal(tip.textContent,'复制');fire('pointerout',{target:copy});assert(tip.hidden);
 fire('pointerover',{target:version});assert.equal(tip.textContent,'切换版本');assert(!tip.textContent.includes('cef0cc5'),'tips do not repeat the visible current value');
 version.dataset.tip='上/下一段；当前位于1/3';fire('tipchange',{target:version});assert.equal(tip.textContent,'上/下一段；当前位于1/3');
 version.dataset.tip='上/下一段；当前位于2/3';fire('tipchange',{target:version});assert.equal(tip.textContent,'上/下一段；当前位于2/3','visible tips refresh when keyboard activation changes the range');
 console.log('Shared tips use concise actions, preserve accessibility descriptions, and ignore activation autofocus');
}finally{for(const [name,descriptor]of saved)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
