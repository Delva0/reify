# Reify

An extensible learning blog framework using Astro and MDX. Articles and resources belong to independent applications; Reify supplies rendering, navigation, notes, code viewers, reader annotations, and shared interaction rules.

```sh
git clone https://github.com/Delva0/reify.git
cd reify
```

```sh
# Node.js 24 or newer
npm ci
npm run typecheck
npm test
npm run build
```

The minimal example contains ordinary articles without a repository dependency. H1 creates logical pages; formulas, inline notes, and named CodeBlocks use the same components as a larger blog.

All first-party framework modules in `src/`, including navigation, persistence, rendering, workers, build integrations and the CLI, are TypeScript. `npm run typecheck` checks the strict browser, worker and tool projects, compile-time contract tests and Astro diagnostics for the minimal example. URL, storage and annotation inputs retain runtime validation. Custom FP types extend `FpPropsMap` in `reify/lib/data-types.js`, register their URL descriptor in `fpTypes` and their factory through `registerFpType`; the contract tests include an example.

`npm run compile` generates runtime JavaScript, source maps and declarations in `dist/`, then copies Astro components and vendor assets. Public imports keep their `.js` paths; existing `reify/build/*.mjs` imports map to the compiled `.js` modules. The root `.mjs` entrypoints contain only compatibility bootstraps. The CLI compiles a source checkout before tests, builds and content checks, and watches runtime sources during development. Published packages use the generated runtime and do not require a TypeScript loader. `npm ci` prepares a checkout; `npm pack` checks types and rebuilds before packaging. Run `npm test` (or `node cli.mjs test --root examples/minimal`) to test the generated runtime.

An application depends on Reify and owns its configuration:

```js
import {defineReifyConfig} from 'reify/config';
export default defineReifyConfig({root:new URL('.',import.meta.url)});
```

Its `src/content.config.ts` exports `collections` from `reify/content`. `reify.config.json` selects `content`, `public`, standalone `pages`, and optional `repositories`. `components` registers application-owned MDX components by name and file path; `scripts` registers application client entrypoints. Topic-specific formula aliases and file maps are also supplied by the application.

A standalone page can set `group` to a display label to collect its H1 pages under one collapsible navigation branch. Without `group`, its H1 pages remain direct navigation entries.

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

HTML page viewers use Dark Reader inside an isolated reading frame and follow the blog theme without reloading. A first-paint palette prevents a white flash while dark colors are generated; theme changes reuse those styles without replacing the document. Up to eight complete dark HTML snapshots are cached in browser storage, keyed by the original HTML/CSS, palette and engine revision. These snapshots include inline colors and variables, with temporary blob URLs converted to data URLs; storage failures retain the readable fallback. Public HTML and styles referenced by articles are cached during the build; external scripts are removed from these reading snapshots. The build also records conclusive embedding restrictions and script-only documents, and checks a bounded set of outbound links from readable snapshots. Known unavailable reading targets open a native tab at click time; uncertain or failed checks keep the existing FP/iframe behavior. Dark Reader is self-hosted with its MIT license under `assets/darkreader/` in the built site.

```mdx
<CodeBlock id="example" language="python" code={"result = f(value)"}
  notes={[{at:{text:"value"},desc:"The input value."}]} />

[Open code](?fp=code&block=example)
```

The CLI provides `dev`, `build`, `preview`, `test`, and an application-owned `check` command. For Windows accessing a WSL UNC directory, it mirrors execution to a native cache and synchronizes source changes. Project files remain in the original directory.

UI instructions live in `.agents/skills/website-ui/`. Third-party code and fonts retain the license notices included beside their assets. No blog articles or deployment identity are part of this framework.
