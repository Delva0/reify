# Reify

An extensible learning blog framework using Astro and MDX. Articles and resources belong to independent applications; Reify supplies rendering, navigation, notes, code viewers, reader annotations, and shared interaction rules.

```sh
git clone https://github.com/Delva0/reify.git
cd reify
```

```sh
npm ci
npm test
npm run build
```

The minimal example contains ordinary articles without a repository dependency. H1 creates logical pages; formulas, inline notes, and named CodeBlocks use the same components as a larger blog.

An application depends on Reify and owns its configuration:

```js
import {defineReifyConfig} from 'reify/config';
export default defineReifyConfig({root:new URL('.',import.meta.url)});
```

Its `src/content.config.mjs` exports `collections` from `reify/content`. `reify.config.json` selects `content`, `public`, standalone `pages`, and optional `repositories`. `components` registers application-owned MDX components by name and file path; `scripts` registers application client entrypoints. Topic-specific formula aliases and file maps are also supplied by the application.

```json
{
  "title":"My notebook",
  "pages":[{"id":"start","source":"start.mdx","page":"index.html"}],
  "components":{"Experiment":"./src/Experiment.astro"},
  "scripts":["./src/client.js"]
}
```

CodeBlocks accept either `code` or `src`; `render={false}` keeps a definition available without showing it in the article. `notes / links / marks` share structured `at` selectors. A link such as `?fp=code&block=example` opens the definition in the unified viewer; definitions can be reused across H1 pages and FP instances.

Markdown and MDX files default to a document view, with the same heading tree, H1 pages, KaTeX, and syntax highlighting as articles. The source icon in the shared toolbar switches back to the original text. Inline documents select `language="markdown"` or `language="mdx"`. Predefined documents use the registered Astro components at build time; ad hoc files use the same MDX compiler in a lazy worker with the framework's portable components. Module imports and executable expressions in fetched MDX remain available in source view.

```mdx
<CodeBlock id="example" language="python" code={"result = f(value)"}
  notes={[{at:{text:"value"},desc:"The input value."}]} />

[Open code](?fp=code&block=example)
```

The CLI provides `dev`, `build`, `preview`, `test`, and an application-owned `check` command. For Windows accessing a WSL UNC directory, it mirrors execution to a native cache and synchronizes source changes. Project files remain in the original directory.

UI instructions live in `.agents/skills/website-ui/`. Third-party code and fonts retain the license notices included beside their assets. No blog articles or deployment identity are part of this framework.
