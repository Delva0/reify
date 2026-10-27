/// <reference types="astro/client" />

declare module '*.astro' {
  const component: import('astro/runtime/server/index.js').AstroComponentFactory;
  export default component;
}

declare module 'reify:components' {
  const components: Record<string, import('astro/runtime/server/index.js').AstroComponentFactory>;
  export default components;
}
