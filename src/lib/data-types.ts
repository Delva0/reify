import type {CodeAnnotations} from './code-annotations.js';
export type RangeColor = 'blue' | 'amber' | 'gray';
export interface LineRange {from: number; to: number; color?: RangeColor}
export interface LineRangeInput {from: number; to?: number; color?: RangeColor}
export type CodeProps = ({file: string; block?: never} | {block: string; file?: never}) & {ranges?: LineRangeInput[]};
export interface PageProps {url: string}
export interface FpPropsMap {code: CodeProps; page: PageProps}
export type FpState = {[K in keyof FpPropsMap]: {type: K; props: FpPropsMap[K]}}[keyof FpPropsMap];
export interface PanelBox {left: number; top: number; width: number; height: number}
export interface DocumentState {page: number; scroll: [number, number][]; top: number; left: number}
export interface ReadingContext {url?: string; title?: string; repositoryName?: string; commit?: string; [key: string]: string | undefined}
export interface CodeDefinition extends CodeAnnotations {
 id: string; code?: string; src?: string; language: string; ranges: LineRange[];
 render: boolean; scroll: boolean; expandable: boolean;
}
export interface PanelSnapshot {
  [key: string]: unknown;
  modal?: boolean; box?: PanelBox; lastNonModalBox?: PanelBox; lastExpandedHeight?: number;
  wrap?: boolean; documentWrap?: boolean; documentMode?: string;
  documents?: (DocumentState | undefined)[]; scroll?: {top: number; left: number}[];
  resourceContext?: ReadingContext;
  definition?: CodeDefinition;
}
export interface SessionEntry {id: string; state: FpState; modal: boolean; parentId: string | null; snapshot: PanelSnapshot}
export interface ReadingEntry {state: FpState; snapshot: PanelSnapshot}
export interface FpSession {version: 2; entries: SessionEntry[]; readings: ReadingEntry[]; archive: SessionEntry[]}
export const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
export interface HighlightRequest {id: number; text: string; language: string}
export type HighlightResponse = {id: number; html: string; error?: never} | {id: number; error: string; html?: never};
export interface DocumentOptions {
 id: string; referencePrefix?: string; title?: string; sourceUrl?: string;
 resourceBase?: string; format?: 'md' | 'mdx'; site?: object;
}
export interface RenderRequest {job: number; source: string; options: DocumentOptions}
export type RenderResponse = {job: number; html: string; error?: never} | {job: number; error: string; html?: never};
export interface WorkerPort<Request, Response> {onmessage: ((event: MessageEvent<Request>) => void) | null; postMessage(message: Response): void}
export interface AnnotationRequest {code: string; annotations?: unknown}
export type AnnotationResponse = {ranges: import('./code-annotations.js').AnnotationRange[]} | {error: string};
