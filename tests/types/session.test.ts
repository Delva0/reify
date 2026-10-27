import {transientSession} from '../../src/lib/transient-session.js';
import {isRecord} from '../../src/lib/data-types.js';

interface Draft {text: string}
const isDraft=(value: unknown): value is Draft=>isRecord(value)&&typeof value.text==='string';
const checked=transientSession('draft',isDraft);
checked.read()?.text.toUpperCase();
checked.write({text:'saved'});
// @ts-expect-error Typed session payloads require a runtime validator.
transientSession<Draft>('unchecked');
// @ts-expect-error Stored data must match the validated schema.
checked.write({text:42});
