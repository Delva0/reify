import type {FpState, PanelSnapshot} from './data-types.js';
export interface PanelHandle {panel: HTMLElement; close(): void; snapshot?(): PanelSnapshot; readingSnapshot?(): PanelSnapshot | null; ready?: PromiseLike<unknown>}
export interface PanelContext {
  origin?: Element | null; parentPanel?: HTMLElement | null; parentId?: string | null;
  sessionId?: string; parentsReady?: PromiseLike<unknown>[]; restore?: PanelSnapshot;
  onClose?(snapshot?: PanelSnapshot): void; onDetach?(): void; onAttach?(): void; onStateChange?(): void;
}
export type FpFactory<T extends FpState['type']> = (props: Extract<FpState, {type: T}>['props'], context: PanelContext) => PanelHandle;
