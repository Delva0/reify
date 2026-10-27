import '../../src/scripts/client-events.js';
import {defineReifyConfig} from '../../src/config.js';
import type {indexTree} from '../../src/lib/github-files.js';

// Event listeners retain their event-specific payload after module migration.
document.addEventListener('fpchange',event=>{
 for(const state of event.detail.state){
  if(state.type==='page')state.props.url.toUpperCase();
 }
 // @ts-expect-error FP changes contain structured instances, not a navigation URL.
 event.detail.href.toUpperCase();
});
document.addEventListener('reify:navigate',event=>{
 const href: string=event.detail.href;
 const replace: boolean | undefined=event.detail.replace;
 // @ts-expect-error Navigation replacement is a boolean flag.
 const invalid: string=event.detail.replace;
 void [href,replace,invalid];
});

// JSON is validated at runtime by indexTree; the resulting tree has concrete entries.
declare const directories: ReturnType<typeof indexTree>;
for(const entry of directories.get('')||[]){
 const kind: 'tree' | 'blob' | 'commit'=entry.type;
 const name: string=entry.path;
 // @ts-expect-error An indexed entry cannot silently change into an unknown Git kind.
 entry.type='folder';
 void [kind,name];
}

// Public configuration follows Astro's actual option types and accepts a URL root.
defineReifyConfig({root:new URL('../../examples/minimal/',import.meta.url),build:{format:'file'}});
// @ts-expect-error Filesystem roots must be a path or a URL.
defineReifyConfig({root:42});
// @ts-expect-error Invalid output formats must fail before the build starts.
defineReifyConfig({build:{format:'json'}});
