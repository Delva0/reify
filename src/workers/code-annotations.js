import {resolveCodeAnnotations} from '../lib/code-annotations.js';
self.onmessage=({data})=>{try{self.postMessage({ranges:resolveCodeAnnotations(data.code,data.annotations)});}catch(error){self.postMessage({error:error.message});}};
