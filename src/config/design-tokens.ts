/**
 * UOOZER DESIGN SYSTEM — TS-side single source of truth.
 *
 * The COLORS below are the exact values from the "Foundations" sheet and are
 * mirrored by the CSS custom properties at the top of `src/index.css` (which
 * carry the EXACT HSL triplets — verified to round-trip 1:1 to these hex).
 * CSS is the runtime source for styling: components must consume theme
 * utilities (`bg-active-surface`, `text-ghost`, `bg-sealed-tint`, ...) and
 * never inline a hex. This file exists for the values CSS cannot hand to
 * TypeScript — layout metrics, motion durations, row heights — so no
 * component ever hardcodes a pixel or a duration again.
 */

export const TOKENS = {
  /** Layout (Foundations · Layout and behaviour). */
  layout: {
    sidebarWidth: 240,
    sidebarCollapsedWidth: 64,
    topBarHeight: 48,
    sidebarRowHeight: 30,
    fileRowHeight: 44,
    noteColumnWidth: 700,
    filesTableMaxWidth: 1040,
    menuWidth: 232,
    menuMinWidth: 200,
  },

  /** File preview drawer (Files-Preview sheet · .pn artboard metrics). */
  preview: {
    drawerWidth: 420,
    viewerOpenHeight: 250,
    menuWidth: 230,
    menuPadding: 6,
    headerIcon: 18,
    headerIconSmall: 16,
    ghostButton: 28,
    actionHeight: 32,
    actionLargeHeight: 36,
    zoomPillHeight: 34,
    zoomButton: 26,
    versionRowHeight: 48,
    versionLabelWidth: 28,
    detailRowHeight: 36,
    contentsRowHeight: 36,
    emptyIconTile: 56,
    menuRowHeight: 32,
  },

  /** Radius scale (Components sheet markup: 6 rows · 8 buttons/segmented ·
   *  10 fields/menus/cards/code · 12 icon tile · 14 dialog · 999 pills). */
  radius: {
    row: 6,
    button: 8,
    segmented: 8,
    field: 10,
    menu: 10,
    card: 10,
    tile: 12,
    dialog: 14,
    pill: 999,
  },

  /** Spacing (4-pt base). */
  space: { '1': 4, '2': 8, '3': 12, '4': 16, '6': 24, '8': 32, '12': 48 },

  /** Motion (120ms hover · 180ms panels · off under reduced motion). */
  motion: { hover: 120, panel: 180, slow: 240 },

  /** Focus ring (2px blue, 2px offset, always on). */
  focus: { ringWidth: 2, ringOffset: 2 },

  /** Icons (24 grid · 1.6 stroke · round caps · 16 in rows, 17 in top bar). */
  icon: { row: 16, topBar: 17, empty: 20, strokeWidth: 1.6 },

  /** Typography (Inter · 400/500/600 only — exact from Foundations). */
  type: {
    pageTitle: { size: 40, lineHeight: 48, weight: 600, tracking: '-.02em' },
    h1: { size: 30, lineHeight: 38, weight: 600, tracking: '-.015em' },
    h2: { size: 24, lineHeight: 32, weight: 600, tracking: '-.01em' },
    h3: { size: 19, lineHeight: 28, weight: 600, tracking: '0' },
    body: { size: 17, lineHeight: 30, weight: 400, tracking: '0' },
    meta: { size: 13, lineHeight: 20, weight: 400, tracking: '0' },
    sidebarRow: { size: 13.5, lineHeight: 30, weight: 500, tracking: '0' },
    sectionLabel: { size: 12, lineHeight: 16, weight: 500, tracking: '0' },
    buttonField: { size: 13.5, lineHeight: 20, weight: 500, tracking: '0' },
    codeInline: { size: 14, weight: 400 },
    codeBlock: { size: 13, lineHeight: 22, weight: 400 },
  },
} as const

/**
 * Exact palette as printed on the Foundations sheet. Reference only —
 * styling must go through the CSS variables/theme utilities.
 */
export const PALETTE = {
  page: '#FFFFFF',
  hover: '#F7F8FA',
  active: '#F3F5F9',
  tint: '#EEF3FE',
  selection: '#D8E5FD',
  line: '#E6E9EF',
  icon: '#8A93A3',
  muted: '#6B7280',
  body: '#1F2937',
  ink: '#111827',
  blue: '#2563EB',
  blueInk: '#1D4ED8',
  blueActive: '#1E40AF',
  /** Busy control: Blue at opacity .7 (Components sheet) — kept for
   *  backwards compatibility; prefer opacity over a lighter blue. */
  blueDisabled: '#6691F1',
  sealed: { text: '#047857', tint: '#E7F7EF' },
  working: { text: '#1D4ED8', tint: '#EEF3FE' },
  headsUp: { text: '#B45309', tint: '#FEF3C7' },
  failed: { text: '#B91C1C', tint: '#FEE2E2' },
  danger: '#DC2626',
  dangerTint: '#FEF2F2',
  surfaces: {
    paper: '#FFFFFF',
    writer: '#FBFCFE',
    night: '#0D1220',
    raised: '#1A2236',
    play: '#F4F1FF',
    sand: '#FBF6EC',
    rose: '#FDF1F4',
    mint: '#EEF8F2',
    sky: '#EEF4FD',
  },
} as const

/** Storage quota shown in the sidebar (Free plan). */
export const FREE_PLAN_QUOTA_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB
