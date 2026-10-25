import {defineCollection} from 'astro:content';
import {glob} from 'astro/loaders';
import {readSiteConfig} from './src/site-config.mjs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
export const collections={articles:defineCollection({loader:glob({pattern:'**/*.mdx',base:pathToFileURL(readSiteConfig().contentDir+path.sep)})})};
