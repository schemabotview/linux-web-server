import type { Code, Edge, Group, SceneModel, SceneNode, Tty } from '@graphlearning/graphl-flow'
import { SCENE_ASPECT } from '@graphlearning/shell'

// The console frame most sections are built from (COURSE-PLAN.md, "Frames"): ONE fixed template, so
// the console sits at the same pixels in every section and a viewer always knows where to look.
//
//   console (CONSOLE_W × CONSOLE_H, a real transcript)  |  picture (PICTURE_W, fixed)
//
// Both columns are FIXED (`w`/`h`): content wider or taller than its column overflows (check-render
// fails it) instead of moving the frame, and graphl-flow's fit is a pure function of the natural box,
// so every console frame lands on the same zoom — check-render asserts it, to the pixel. No edges
// between the columns; `focus` rings a console row (`console.L<n>`) instead.
//
// The sizes are graphl-flow 0.7's console-frame study (dev/fixtures/studies/console-frame.ts), which
// were MEASURED there: 80 columns × 9.0px + 30 padding + 2 borders = 752, so W 760; 43 rows × 24px +
// 51 (bar, padding, borders) ≈ 1083, so H 1090. The height is the frame's; the width follows from
// SCENE_ASPECT (the shell's — a section frame is the scene alone, 16:9), and the picture takes the rest.

const ROW = 24 // a console row
const CHROME = 51 // the window bar, body padding and borders
const GAP = 10 // graphl-flow's GAP between siblings
export const COLS = 80
export const CONSOLE_W = 760
export const CONSOLE_ROWS = 43
export const CONSOLE_H = 1090 // CONSOLE_ROWS × ROW + CHROME = 1083, rounded as the study does
export const FRAME_W = Math.round(CONSOLE_H * SCENE_ASPECT)
export const PICTURE_W = FRAME_W - CONSOLE_W - GAP

/** The height a console of `rows` rows needs — for a small console inside the picture. */
export const consoleH = (rows: number) => rows * ROW + CHROME

// Fixed ids: a section's `focus` can name `console.L12` or any id in the picture.
export const FRAME_IDS = { console: 'console', picture: 'picture' } as const

/**
 * A capture (`sections/<course>/<NN-id>/output.txt`, imported with `?raw`) as the rows a console
 * draws: the 80-column terminal row for row, trailing spaces and the blank rows under the last prompt
 * dropped. Nothing else is touched — the transcript is real and is never edited.
 */
export function transcript(raw: string): string {
  return raw.split('\n').map((r) => r.trimEnd()).join('\n').replace(/\n+$/, '')
}

/**
 * The 1-based row of `text` holding `needle`, searching from row `from`. Highlights and folds are
 * found by TEXT, never typed as numbers: a re-capture shifts rows, and a typed number silently lights
 * the wrong one. A missing needle throws, which check-render reports as a page error naming the scene.
 */
export function rowOf(text: string, needle: string, from = 1): number {
  const rows = text.split('\n')
  for (let i = from - 1; i < rows.length; i++) if (rows[i].includes(needle)) return i + 1
  throw new Error(`console.ts: no row containing ${JSON.stringify(needle)} from row ${from}`)
}

/** Every row from the one holding `first` through the next one holding `last` (default: `first`'s row). */
export function rowsFrom(text: string, first: string, last?: string, from = 1): number[] {
  const a = rowOf(text, first, from), b = last === undefined ? a : rowOf(text, last, a)
  return Array.from({ length: b - a + 1 }, (_, i) => a + i)
}

/**
 * Fold rows out of a transcript: every row is kept except the runs from `first` through `last`, each
 * of which graphl-flow draws as one `··· N lines` row. For a long output (an SSH banner, randomart)
 * and for a row a scene must never quote (a server sees the laptop as 192.0.2.1 — CLAUDE.md).
 */
export function fold(text: string, ...runs: [first: string, last?: string][]): [number, number][] {
  const n = text.split('\n').length
  const out = new Set(runs.flatMap(([first, last]) => rowsFrom(text, first, last)))
  const show: [number, number][] = []
  for (let r = 1; r <= n; r++) {
    if (out.has(r)) continue
    const last = show[show.length - 1]
    if (last && last[1] === r - 1) last[1] = r
    else show.push([r, r])
  }
  return show
}

/** The rows a console draws: each kept row, plus one row per folded run (Code.tsx `codeRows`). */
export function drawnRows(code: string, show?: [number, number][]): number {
  const n = code.split('\n').length
  if (!show?.length) return n
  const keep = new Set(show.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i)))
  let rows = 0
  for (let r = 1; r <= n; r++) if (keep.has(r) || r === 1 || keep.has(r - 1)) rows++ // a kept row, or the first row of a folded run
  return rows
}

export interface Console {
  /** The capture, imported with `?raw`. */
  output: string
  /** The window title: who and where — `ana@web-01: ~`. */
  title: string
  show?: [number, number][]
  highlight?: number[]
}

/** A console node: the real transcript, rows found by text. */
export function consoleNode(id: string, { output, title, show, highlight }: Console, place: Partial<Code> = {}): Code {
  return { type: 'code', id, console: true, cols: COLS, filename: title, code: transcript(output), show, highlight, ...place }
}

export interface ConsoleFrame {
  /** The console: a transcript, or a `tty` (a full-screen program) at the console's size. */
  left: Console | Tty
  /** The picture of what the console just showed: a diagram (check-content fails a list). */
  picture: SceneNode[]
  /** Edges INSIDE the picture. An edge between the columns would widen a gap and move them. */
  edges?: Edge[]
}

export function consoleFrame({ left, picture, edges = [] }: ConsoleFrame): SceneModel {
  const place = { w: CONSOLE_W, h: CONSOLE_H, fill: true }
  const console = 'type' in left ? { ...left, id: FRAME_IDS.console, ...place } : consoleNode(FRAME_IDS.console, left, place)
  // `spread`: the picture's parts share the column's height evenly instead of stacking at its top.
  const pane: Group = { type: 'group', id: FRAME_IDS.picture, bare: true, spread: true, w: PICTURE_W, h: CONSOLE_H, children: picture }
  return { dir: 'row', nodes: [console, pane], edges }
}

const FAMILIES = {
  rocky: { icon: 'rocky', title: 'On the Red Hat family', sub: 'Rocky Linux 10 · web-02 · real output' },
} as const

/**
 * A family card (COURSE-PLAN.md, "Linux families and macOS"): the same step on the other family, from
 * real output, inside the picture. It costs no section. The console is sized to its rows, so a card
 * never takes more of the picture than its transcript needs.
 */
export function familyCard(id: string, family: keyof typeof FAMILIES, c: Console, children: SceneNode[] = []): Group {
  const f = FAMILIES[family]
  const rows = drawnRows(transcript(c.output), c.show)
  return {
    type: 'group', id, title: f.title, sub: f.sub, icon: f.icon, tone: 'consume',
    children: [consoleNode(`${id}-console`, c, { w: CONSOLE_W, h: consoleH(rows) }), ...children],
  }
}

/** A full-screen program's capture (`sections/…/<name>.tty.json`, imported as JSON). */
export interface TtyCapture { screen: string[]; inverse?: number[][]; bold?: number[][] }

/**
 * A full-screen program's screen as a `tty`. A capture is the whole 44-row terminal, one row more
 * than any slot holds, so a scene shows a CONTIGUOUS slice of it, rows [from, to) — never an edited
 * screen — and the title says which rows (check:captures holds the slice to the capture, row for
 * row). Inverse and bold runs move with their rows.
 */
export function ttyNode(id: string, cap: TtyCapture, title: string, [from, to]: [number, number] = [0, cap.screen.length], place: Partial<Tty> = {}): Tty {
  const runs = (rs: number[][] = []) => rs.filter(([r]) => r >= from && r < to).map(([r, a, b]) => [r - from, a, b] as [number, number, number])
  const part = from > 0 || to < cap.screen.length ? ` — rows ${from + 1}–${to} of ${cap.screen.length}` : ''
  return {
    type: 'tty', id, title: `${title}${part}`, cols: COLS, screen: cap.screen.slice(from, to), inverse: runs(cap.inverse), bold: runs(cap.bold),
    h: consoleH(to - from), w: CONSOLE_W, ...place,
  }
}
