import {hydrateAnnotations} from './annotations.js';
import {enhanceCodeBlocks} from './code-tools.js';
import {initFiles} from './files.js';
import {markLink} from '../lib/links.js';
import {readingContext} from '../lib/reading-context.js';
import {enhanceFloatingLinks} from './fp-navigation.js';

export function hydrateReadingContent(root=document){
 hydrateAnnotations(root);
 enhanceCodeBlocks(root);
 initFiles(root);
 enhanceFloatingLinks(root);
 for(const link of root.querySelectorAll('a[href]'))markLink(link,readingContext(link).url);
}
