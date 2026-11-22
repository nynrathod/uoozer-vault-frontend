export type CoverShape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number; fill: string; o?: number }
  | { t: 'circle'; cx: number; cy: number; r: number; fill: string; o?: number }
  | { t: 'path'; d: string; fill: string; o?: number }

export interface CoverPreset {
  id: string
  label: string
  /** Design height at full note-column width. */
  height: number
  bg: string
  shapes: CoverShape[]
}

export const COVER_PRESETS: readonly CoverPreset[] = [
  {
    // Note-F Playful — flat colourful shapes, a yellow sun and layered waves.
    id: 'waves',
    label: 'Waves',
    height: 176,
    bg: '#CFE0FD',
    shapes: [
      { t: 'circle', cx: 690, cy: 62, r: 52, fill: '#FFD166' },
      { t: 'circle', cx: 120, cy: 40, r: 26, fill: '#FFB4C6' },
      {
        t: 'path',
        d: 'M0 176V120C90 84 170 130 270 112S450 80 540 108 760 138 900 96V176Z',
        fill: '#7BDCB5',
      },
      {
        t: 'path',
        d: 'M0 176V148C110 122 220 160 340 144S580 118 700 142 840 150 900 136V176Z',
        fill: '#2563EB',
      },
    ],
  },
  {
    // Note-G Journal — a flat sunrise over peach hills.
    id: 'sunrise',
    label: 'Sunrise',
    height: 160,
    bg: '#FFD9B0',
    shapes: [
      { t: 'circle', cx: 640, cy: 88, r: 46, fill: '#FF9F5A' },
      { t: 'rect', x: 120, y: 36, w: 90, h: 16, rx: 8, fill: '#FFFFFF', o: 0.8 },
      { t: 'rect', x: 150, y: 54, w: 60, h: 14, rx: 7, fill: '#FFFFFF', o: 0.8 },
      {
        t: 'path',
        d: 'M0 160V110C100 80 190 120 300 104S500 76 610 106 760 120 820 98V160Z',
        fill: '#FFC59B',
      },
      {
        t: 'path',
        d: 'M0 160V138C120 116 230 150 360 134S600 112 720 136 800 140 820 134V160Z',
        fill: '#FFA574',
      },
    ],
  },
  {
    // Note-I Time capsule — a crescent moon and stars over dark hills.
    id: 'moon',
    label: 'Moon',
    height: 160,
    bg: '#2B3566',
    shapes: [
      { t: 'circle', cx: 690, cy: 62, r: 30, fill: '#FBBF24' },
      { t: 'circle', cx: 704, cy: 54, r: 26, fill: '#2B3566' },
      { t: 'circle', cx: 120, cy: 34, r: 2.2, fill: '#FDE68A' },
      { t: 'circle', cx: 210, cy: 64, r: 1.8, fill: '#FDE68A' },
      { t: 'circle', cx: 330, cy: 28, r: 2.4, fill: '#FDE68A' },
      { t: 'circle', cx: 470, cy: 56, r: 1.8, fill: '#FDE68A' },
      { t: 'circle', cx: 560, cy: 26, r: 2.2, fill: '#FDE68A' },
      { t: 'circle', cx: 60, cy: 80, r: 1.6, fill: '#FDE68A' },
      {
        t: 'path',
        d: 'M0 160V112C110 84 200 122 320 108S520 82 640 110 780 118 820 104V160Z',
        fill: '#1E2650',
      },
      {
        t: 'path',
        d: 'M0 160V138C130 118 250 150 390 136S640 116 820 140V160Z',
        fill: '#141A3A',
      },
    ],
  },
  {
    // Note-H Sticky board — overlapping flat circles (full-bleed banner).
    id: 'circles',
    label: 'Circles',
    height: 150,
    bg: '#CFE0FD',
    shapes: [
      { t: 'circle', cx: 180, cy: 40, r: 70, fill: '#FFB4C6' },
      { t: 'circle', cx: 420, cy: 120, r: 80, fill: '#7BDCB5' },
      { t: 'circle', cx: 760, cy: 30, r: 60, fill: '#FFD166' },
      { t: 'circle', cx: 1000, cy: 110, r: 90, fill: '#2563EB' },
      { t: 'circle', cx: 1130, cy: 20, r: 40, fill: '#E6DEFF' },
    ],
  },
  {
    // Lite-Workspace example — layered blue hills under a pale sky.
    id: 'hills',
    label: 'Hills',
    height: 180,
    bg: '#DCE8FB',
    shapes: [
      { t: 'circle', cx: 560, cy: 52, r: 24, fill: '#FFFFFF', o: 0.9 },
      {
        t: 'path',
        d: 'M0 180V118C110 86 210 104 330 120S560 92 700 112V180Z',
        fill: '#A9C3F5',
      },
      {
        t: 'path',
        d: 'M0 180V146C130 124 260 156 400 142S620 128 700 138V180Z',
        fill: '#5B8DEF',
      },
    ],
  },
]

export function coverPresetById(id: string): CoverPreset | null {
  return COVER_PRESETS.find((preset) => preset.id === id) ?? null
}
