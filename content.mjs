import {defineCollection} from 'astro:content';
import {glob} from 'astro/loaders';
import {readSiteConfig} from './src/site-config.mjs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {articleSourceId} from './src/lib/article-pages.js';
export const collections={articles:defineCollection({loader:glob({pattern:'**/*.mdx',base:pathToFileURL(readSiteConfig().contentDir+path.sep),generateId:({entry})=>articleSourceId(entry)})})};
