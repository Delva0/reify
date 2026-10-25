# Reify

This directory contains the reusable blog framework. Keep articles, topic-specific data, demonstrations, and personal writing rules in the consuming blog.

- Read `.agents/skills/website-ui/SKILL.md` for UI work.
- Public integration entry: `config.mjs`; content collection entry: `content.mjs`.
- General MDX components live in `src/components/`. Consumers register their own components and scripts in `reify.config.json`.
- `examples/minimal` must build without a repository, source snapshot, or sibling blog.
- Run framework tests with `node cli.mjs test --root examples/minimal` and the example with `node cli.mjs build --root examples/minimal`.
- `../reify-learn-ai` is a separate application using a local file dependency. Fix shared behavior here rather than copying framework files there.
