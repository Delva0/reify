import type {FpState} from '../lib/data-types.js';
export interface NavigationDetail {from: string; to: string; reason: string; cancelled?: boolean; error?: unknown}
declare global {
 interface DocumentEventMap {
  'fpchange': CustomEvent<{state: FpState[]}>;
  'fpready': CustomEvent<{panel: HTMLElement}>;
  'reify:navigate': CustomEvent<{href: string; replace?: boolean}>;
  'reify:before-navigate': CustomEvent<NavigationDetail & {waitUntil(promise: PromiseLike<unknown>): void}>;
  'reify:after-navigate': CustomEvent<NavigationDetail>;
 }
}
