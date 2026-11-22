/**
 * Ambient module declarations for stylesheet side-effect imports.
 *
 * The notes module ships its block-level stylesheets (css/columns.css) and
 * imports them from the node views that need them. Bundlers resolve those
 * imports at build time; plain `tsc` runs (scripts/notes-typecheck) need
 * this wildcard so `import '../css/columns.css'` type-checks. It merges
 * cleanly with bundler-provided declarations (e.g. vite/client).
 */
declare module '*.css'
