import {resolveCodeAnnotations} from '../lib/code-annotations.js';
import {errorMessage} from '../lib/data-types.js';
import type {AnnotationRequest,AnnotationResponse,WorkerPort} from '../lib/data-types.js';
const scope=(typeof self==='undefined'?globalThis:self) as unknown as WorkerPort<AnnotationRequest,AnnotationResponse>;
scope.onmessage=({data})=>{try{scope.postMessage({ranges:resolveCodeAnnotations(data.code,data.annotations)});}catch(error){scope.postMessage({error:errorMessage(error)});}};
