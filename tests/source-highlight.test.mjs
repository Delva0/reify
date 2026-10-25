import assert from 'node:assert/strict';
let reply;
globalThis.self={postMessage:value=>reply(value)};
await import('../src/workers/source-highlight.js');
const cases=[['cpp','int main() { return 42; }'],['python','def run(x):\n  return x + 1'],['cmake','add_library(example SHARED file.cpp)'],['protobuf','message Request { string name = 1; }'],['typescript','const input: string = "value"'],['markdown','# Markdown\n\n**source**'],['mdx','<TextNote desc="input">value</TextNote>\n\n<CodeBlock code={"f(value)"} />'],['text','<img src=x onerror=alert(1)>']];
for(const [language,text]of cases){
 const result=await new Promise(resolve=>{reply=resolve;self.onmessage({data:{id:language,text,language}});});
 assert(!result.error,result.error);assert.match(result.html,/<pre/);assert(!result.html.includes('<img'),'source is escaped rather than inserted as HTML');
 if(language!=='text')assert.match(result.html,/--shiki-dark:/,'both theme token colors are retained');
}
delete globalThis.self;
console.log('Lazy worker highlights C++, Python, CMake, Protobuf and TypeScript with both themes; source HTML is escaped');
