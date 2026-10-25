import assert from 'node:assert/strict';
import test from 'node:test';
import {createWebThemeCache,webThemeKey} from '../src/lib/web-theme-cache.js';

test('dark snapshots invalidate with source CSS, address or palette changes',async()=>{
 const resource={url:'https://source.test/a',html:'<style>p{color:red}</style><p>A</p>'},theme={paper:'#161616',ink:'#ddd',scroll:'#555'};
 const key=await webThemeKey(resource,theme);assert.equal(key,await webThemeKey(resource,{...theme}));
 for(const [page,palette]of [[{...resource,html:resource.html.replace('red','blue')},theme],[{...resource,url:'https://source.test/b'},theme],[resource,{...theme,ink:'#eee'}]])assert.notEqual(key,await webThemeKey(page,palette));
});

test('snapshots survive a new runtime and keep bounded persistent storage',async()=>{
 const entries=new Map(),storage={open:async()=>({match:async key=>entries.get(key)?.clone(),delete:async key=>entries.delete(key.url||key),put:async(key,value)=>entries.set(key,value),keys:async()=>[...entries.keys()]})};
 const first=createWebThemeCache(storage);await first.put('first','<html>dark</html>');
 const refreshed=createWebThemeCache(storage);assert.equal(await refreshed.get('first'),'<html>dark</html>');
 for(let index=0;index<10;index++)await refreshed.put(String(index),'<html>'+index+'</html>');
 assert.equal(entries.size,8);assert.equal(await createWebThemeCache(storage).get('first'),null);
 await refreshed.put('large','x'.repeat(2_000_001));assert.equal(await refreshed.get('large'),null);
});

test('unavailable persistent storage never breaks reading or the in-memory cache',async()=>{
 const cache=createWebThemeCache({open:async()=>{throw Error('storage denied');}});
 assert.equal(await cache.get('missing'),null);await cache.put('page','dark');assert.equal(await cache.get('page'),'dark');
});
