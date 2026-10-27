import {fpHref,fpTypes} from '../../src/lib/fp-links.js';
import {registerFpType} from '../../src/scripts/fp-navigation.js';
import {createCodeDialog} from '../../src/scripts/code-dialog.js';
import type {HighlightRequest,HighlightResponse,RenderRequest,PanelSnapshot} from '../../src/lib/data-types.js';
import type {PanelHandle} from '../../src/lib/panel-types.js';
declare const panel: HTMLElement;
declare module '../../src/lib/data-types.js' {
 interface FpPropsMap {example: {name: string}}
}
fpTypes.example={fields:['name'],parse(fields){if(typeof fields.name!=='string')throw Error('name required');return {name:fields.name};},validate(props){if(typeof props.name!=='string')throw Error('name required');},format(props){return {name:props.name};}};
registerFpType('example',props=>{props.name.toUpperCase();return {panel,close(){}};});
fpHref([{type:'example',props:{name:'extension'}}]);
// @ts-expect-error Extension props follow the declared map.
fpHref([{type:'example',props:{url:'wrong'}}]);
const handle: PanelHandle={panel,close(){}};
fpHref([{type:'code',props:{file:'src/a.cpp',ranges:[{from:1,to:3,color:'blue'}]}},{type:'page',props:{url:'https://example.test'}}]);
// @ts-expect-error A code FP has one source identity.
fpHref([{type:'code',props:{file:'a.cpp',block:'a'}}]);
// @ts-expect-error Page and code props cannot be interchanged.
fpHref([{type:'page',props:{file:'a.cpp'}}]);
// @ts-expect-error Range colors use the shared palette.
fpHref([{type:'code',props:{file:'a.cpp',ranges:[{from:1,color:'red'}]}}]);
registerFpType('page',(props)=>{props.url.toUpperCase();return handle;});
// @ts-expect-error A registered factory must return the full panel handle.
registerFpType('code',()=>({panel}));
const dialog=createCodeDialog({onClose(snapshot){snapshot?.scroll?.[0]?.top.toFixed();}});
dialog.update({title:'Source',text:'hello'});
// @ts-expect-error Source content is text.
dialog.update({text:123});
const highlight={id:1,text:'hello',language:'typescript'} satisfies HighlightRequest;
const reply={id:highlight.id,html:'<pre>hello</pre>'} satisfies HighlightResponse;
// @ts-expect-error The highlight protocol uses id, not job.
const badRequest: HighlightRequest={job:1,text:'hello',language:'typescript'};
// @ts-expect-error A worker reply cannot be both success and failure.
const badReply: HighlightResponse={id:1,html:'hello',error:'failure'};
// @ts-expect-error Rendering needs source content.
const badRender: RenderRequest={job:1,options:{}};
// @ts-expect-error Window snapshots use top/left scroll records.
const badSnapshot: PanelSnapshot={scroll:[[1,2]]};
void [reply,badRequest,badReply,badRender,badSnapshot];
