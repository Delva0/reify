import assert from 'node:assert/strict';
import test from 'node:test';
import {linkPanelState} from '../src/lib/link-panels.js';
import {parseFpUrl,fpHref} from '../src/lib/fp-links.js';
import {readingContext,setReadingContext} from '../src/lib/reading-context.js';

const base='https://wiki.test/runtime.html',click={button:0};
const link=(href,{body=true,tree=false,download=false,target=''}={})=>({target,getAttribute:()=>href,hasAttribute:name=>name==='download'&&download,closest:selector=>selector.startsWith('.document,')?body:tree});
test('plain reading links open page or existing code viewers without rewriting their href',()=>{
 assert.deepEqual(linkPanelState(link('ge.html#execute'),click,base,base),{type:'page',props:{url:'/ge.html#execute'}});
 const external=link('https://docs.test/api.html',{target:'_blank'});
 assert.deepEqual(linkPanelState(external,click,base,base),{type:'page',props:{url:'https://docs.test/api.html'}});
 assert.equal(external.getAttribute('href'),'https://docs.test/api.html');
 assert.deepEqual(linkPanelState(link('https://github.com/o/r/blob/main/a.cpp#L10-L20'),click,base,base),{type:'code',props:{file:'https://github.com/o/r/blob/main/a.cpp#L10-L20',ranges:[{from:10,to:20}]}});
 for(const event of [{button:1},{...click,ctrlKey:true},{...click,metaKey:true},{...click,shiftKey:true},{...click,altKey:true}])assert.equal(linkPanelState(external,event,base,base),null);
 for(const target of [link('#same'),link('runtime.html#same'),link('mailto:a@b.test'),link('ge.html',{tree:true}),link('ge.html',{body:false}),link('ge.html',{download:true})])assert.equal(linkPanelState(target,click,base,base),null);
});
test('page FP protocol composes with code instances and rejects non-web destinations',()=>{
 const page={type:'page',props:{url:'/ge.html?view=a&value=1#execute'}},code={type:'code',props:{file:'a.cpp',ranges:[]}};
 for(const state of [[page],[page,code,page]])assert.deepEqual(parseFpUrl(fpHref(state),base),state);
 for(const url of ['javascript:alert(1)','data:text/html,hello','file:///etc/passwd','https://user:pass@web.test'])assert.throws(()=>fpHref([{type:'page',props:{url}}]));
});
test('embedded reading context stays bound to the target article and its namespace',()=>{
 const view={dataset:{readingScope:'scope'},closest(){return this;}};
 setReadingContext(view,{url:'https://wiki.test/ge.html',title:'GE',repositoryName:'hicann/ge',commit:'target'});
 assert.equal(readingContext(view).repositoryName,'hicann/ge');assert.equal(readingContext(view).scopeId,'scope');
 setReadingContext(view,{url:'https://wiki.test/notes.html',title:'Notes'});
 assert.equal(readingContext(view).repositoryName,undefined,'independent target articles do not inherit the host repository');
});
