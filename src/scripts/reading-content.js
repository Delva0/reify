import {hydrateAnnotations} from './annotations.js';
import {enhanceCodeBlocks} from './code-tools.js';
import {initFiles} from './files.js';
import {markLink} from '../lib/links.js';

export function hydrateReadingContent(root=document){
 hydrateAnnotations(root);
 enhanceCodeBlocks(root);
 initFiles(root);
 for(const link of root.querySelectorAll('a[href]'))markLink(link);
}
