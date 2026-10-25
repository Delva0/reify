# ghloc-web

Source: https://github.com/pajecawav/ghloc-web

Revision: efb19a82421543b34775940837d73d90b231ce95. MIT license retained in LICENSE and /licenses/ghloc-web.txt.

- github-utils.ts copies src/lib/github/utils.ts (with a provenance header).
- tree-order.js adapts the folder-first comparator from src/pages/[owner]/[repo]/components/LocsSection/hooks/useLocs.tsx to Git Trees entries.
- ../../lib/github-files.js adapts raw-file loading and promise caching from src/lib/github/api.ts and src/lib/cache.ts. Like upstream, it indexes the complete repository tree before browsing. Static per-commit manifests are generated from local Git trees rather than the upstream LOC service, so files omitted by code statistics remain browsable.

The Astro tree and the shared code dialog retain this site's controls and rendering. No Hono, SWR, LOC service, or Arborium dependency is introduced.

The selector follows selectedLanguage (extension/filename keys) and parent-relative file/folder contributions in LocsSection.island.tsx and FileTree.tsx. This site renders contributions as 1px lines, with numeric values in tips only, and uses per-commit source statistics prepared locally.
