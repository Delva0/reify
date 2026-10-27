const names: Record<string,string>={cpp:'C++',c:'C',python:'Python',bash:'Shell',sh:'Shell',text:'文本',json:'JSON',javascript:'JavaScript',js:'JavaScript',typescript:'TypeScript',yaml:'YAML',cmake:'CMake',protobuf:'Protobuf',markdown:'Markdown',dockerfile:'Dockerfile',rust:'Rust',go:'Go',html:'HTML',css:'CSS',toml:'TOML',xml:'XML',ini:'INI',diff:'Diff'};
export const languageLabel=(language: string)=>names[language]||language;
export function resourceLanguage(file: string,type=''){
 const language=sourceLanguage(file);return language==='text'?(({ 'text/html':'html','application/json':'json','text/css':'css','text/javascript':'javascript','application/javascript':'javascript','image/svg+xml':'xml'} as Record<string,string>)[type.split(';')[0]]||'text'):language;
}
export function sourceLanguage(file: string){
 if(file.endsWith('CMakeLists.txt'))return 'cmake';
 if(file.endsWith('Dockerfile'))return 'dockerfile';
 const extensions: Record<string,string>={py:'python',cpp:'cpp',cc:'cpp',cxx:'cpp',hpp:'cpp',h:'cpp',c:'c',md:'markdown',mdx:'markdown',json:'json',sh:'bash',bash:'bash',proto:'protobuf',pbtxt:'protobuf',yaml:'yaml',yml:'yaml',cmake:'cmake',js:'javascript',mjs:'javascript',ts:'typescript',tsx:'typescript',jsx:'javascript',rs:'rust',go:'go',html:'html',css:'css',toml:'toml',xml:'xml',ini:'ini',patch:'diff',diff:'diff'};
 return extensions[(file.split('.').pop()||'').toLowerCase()]||'text';
}
