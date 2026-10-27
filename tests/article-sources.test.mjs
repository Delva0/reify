import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {prepareArticleSource,articleSourceAsset} from '../dist/build/article-sources.js';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'reify-article-source-'));
try{
 const site={root,contentDir:path.join(root,'content')},output=path.join(root,'dist');
 await fs.mkdir(site.contentDir);await fs.mkdir(path.join(output,'nested'),{recursive:true});
 const text='---\r\ntitle: Original\r\n---\r\n# First\r\n\r\n<TextNote desc="input">value</TextNote>\r\n\r\n# Second\r\n';
 await fs.writeFile(path.join(site.contentDir,'article.mdx'),text);
 const original=await prepareArticleSource('article.mdx',site);
 assert.match(original.href,/^\/data\/article-sources\/[\da-f]{64}\.mdx$/);
 assert.equal(original.language,'mdx');assert.equal(original.file,'content/article.mdx');
 assert.deepEqual(await prepareArticleSource('article.mdx',site),original);
 const asset=articleSourceAsset(original.href,site);assert.equal(await fs.readFile(asset.file,'utf8'),text,'published source preserves frontmatter, components, H1 pages and original newlines');
 await fs.writeFile(path.join(site.contentDir,'article.mdx'),text+'new text');
 const changed=await prepareArticleSource('article.mdx',site);assert.notEqual(changed.href,original.href,'changed source gets a new immutable asset URL');
 await fs.writeFile(path.join(site.contentDir,'readme.md'),'# Markdown\n');
 const markdown=await prepareArticleSource('readme.md',site);assert.equal(markdown.language,'markdown');
 assert.equal(articleSourceAsset('/data/article-sources/../private.mdx',site),undefined);
 await assert.rejects(prepareArticleSource('../private.mdx',site),/源文件无效/);
 await fs.writeFile(path.join(output,'first.html'),'<script id="article-pages" type="application/json">'+JSON.stringify({source:original})+'</script>');
 await fs.writeFile(path.join(output,'nested','second.html'),'<script type="application/json" id="article-pages">'+JSON.stringify({source:markdown})+'</script>');
 const isolated=await import('../dist/build/article-sources.js?config-instance');
 await isolated.copyArticleSources(pathToFileURL(output+path.sep),site);
 const published=await fs.readdir(path.join(output,'data/article-sources'));
 assert.deepEqual(published.sort(),[path.basename(original.href),path.basename(markdown.href)].sort(),'only current rendered manifests publish sources; stale cached versions are omitted');
 assert.equal(await fs.readFile(path.join(output,original.href.slice(1)),'utf8'),text,'copying works across separate SSR/config module instances');
 console.log('Original MD/MDX source assets preserve bytes, use content hashes, serve in dev and publish only current page manifests across module instances.');
}finally{
 assert.equal(path.dirname(root),os.tmpdir());assert(path.basename(root).startsWith('reify-article-source-'));
 await fs.rm(root,{recursive:true,force:true});
}
