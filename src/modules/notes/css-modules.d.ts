/**
 * Ambient module declaration for stylesheet imports.
 *
 * Since the v2 hotfix the notes module ships ONE stylesheet
 * (notes.css, loaded from src/index.css) — there are no side-effect
 * stylesheet imports left in components. Plain `tsc` runs
 * (scripts/notes-typecheck) still need this wildcard so the stylesheet
 * @import line in src/index.css and any editor-internal stylesheet
 * import type-check. It merges cleanly with bundler-provided
 * declarations (e.g. vite/client).
 */
declare module '*.css'
