// Content guard — silent failures that build green and break only on screen or in the recording.
// It reads the REAL registries (scripts/registry.mjs bundles src/content and src/scenes), so it sees
// exactly what renders:
//
//   1. A section is scene-only and narrated, and its scene exists.
//   2. Node ids are unique within a scene (graphl-flow resolves edges and focus by id).
//   3. A console frame's picture is a DIAGRAM (COURSE-PLAN.md, "One command → one mental model"): it
//      holds an edge, a plot or a table — not a list of cards.
//   4. A console frame draws edges only INSIDE its picture: an edge between the columns widens the gap
//      it crosses (graphl-flow's EDGE_GAP) and moves both off the shared template.
//   5. Every console holds what it shows: its drawn rows (folds count one each) fit its height, and no
//      row is wider than COLS — a real 80-column terminal wrapped it already, so a wider row means the
//      text did not come from a capture. The frame's console holds CONSOLE_ROWS: fold with `fold()`.
//      A fold of ONE row saves nothing and is a mis-anchored needle.
//   6. Once a course has narration audio, every section of it has its wav — a missing one plays
//      silence and records a silent segment, with no error anywhere.
//
// That every console IS a capture is scripts/check-captures.mjs; what renders is check-render.mjs.
//
// Run: npm run check
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { consolesOf, isFrame, loadRegistry, nodesOf } from './registry.mjs'

const { COURSES, SCENES, FRAME } = await loadRegistry()
const problems = []

// --- 1. sections --------------------------------------------------------------------------------
for (const course of Object.values(COURSES))
  for (const section of course.sections) {
    const at = `${course.id}-${section.id}`
    if ('slide' in section) problems.push(`${at}  has a slide — sections in this repo are scene-only`)
    if (!section.narration?.trim()) problems.push(`${at}  has no narration`)
    if (!SCENES[section.scene]) problems.push(`${at}  scene '${section.scene}' is not registered`)
  }

for (const [id, scene] of Object.entries(SCENES)) {
  const all = nodesOf(scene)
  // --- 2. unique ids ----------------------------------------------------------------------------
  const seen = new Set()
  for (const { node } of all) {
    if (seen.has(node.id)) problems.push(`scene ${id}  node id '${node.id}' is used twice`)
    seen.add(node.id)
  }
  // --- 5. every console holds what it shows ------------------------------------------------------
  for (const c of consolesOf(scene)) {
    const rows = FRAME.drawnRows(c.code, c.show)
    const room = c.id === 'console' ? FRAME.CONSOLE_ROWS : c.h ? Math.floor((c.h - 51) / 24) : Infinity
    if (rows > room) problems.push(`scene ${id}  console '${c.id}' draws ${rows} rows; it holds ${room} — fold with fold()`)
    // A fold row replaces the rows it hides, so folding ONE row saves nothing: it is a needle that
    // matched its own first row (`fold(t, ['> #!/usr/sbin/nft -f', '>'])` folded one row, not three).
    const shown = c.show ?? []
    for (let i = 0; i < shown.length; i++) {
      const gap = (i === 0 ? shown[0][0] - 1 : shown[i][0] - shown[i - 1][1] - 1)
      if (gap === 1) problems.push(`scene ${id}  console '${c.id}' folds a single row (${shown[i][0] - 1}) — it saves nothing; check the fold's needles`)
    }
    const wide = c.code.split('\n').find((l) => l.length > FRAME.COLS)
    if (wide) problems.push(`scene ${id}  console '${c.id}' has a row of ${wide.length} columns (> ${FRAME.COLS}) — not a capture's row: "${wide.slice(0, 40)}…"`)
  }
  if (!isFrame(scene)) continue
  const top = new Map(all.map(({ node, top }) => [node.id, top]))
  // An endpoint is a node id or `<table>.<row>` / `<code>.L<n>`: its node is the part before the dot.
  const columnOf = (end) => top.get(end.split('.')[0])
  // --- 4. edges stay inside the picture ----------------------------------------------------------
  const edges = scene.edges ?? []
  for (const e of edges)
    for (const end of [e.from, e.to])
      if (columnOf(end) !== 'picture') problems.push(`scene ${id}  edge ${e.from} → ${e.to}: '${end}' is ${columnOf(end) ? `in the ${columnOf(end)} column` : 'not a node'} — edges stay inside the picture`)
  // --- 3. the picture is a diagram ----------------------------------------------------------------
  const picture = all.filter(({ top }) => top === 'picture').map(({ node }) => node)
  if (!edges.length && !picture.some((n) => n.type === 'table' || n.type === 'plot'))
    problems.push(`scene ${id}  the picture holds no edge, plot or table — it must carry a diagram, not a list`)
}

// --- 6. every section has its narration wav, once its course has any -----------------------------
const audio = 'public/audio'
for (const course of Object.values(COURSES)) {
  const dir = join(audio, course.id)
  if (!existsSync(dir) || !statSync(dir).isDirectory() || !readdirSync(dir).some((f) => f.endsWith('.wav'))) continue
  for (const section of course.sections) {
    const wav = join(dir, `${section.id}.wav`)
    if (!existsSync(wav)) problems.push(`${course.id}-${section.id}  no narration wav at ${wav} — the section plays silence`)
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} content problem(s):\n` + problems.map((p) => '  ' + p).join('\n'))
  process.exit(1)
}
const sections = Object.values(COURSES).reduce((n, c) => n + c.sections.length, 0)
console.log(`✓ content OK — ${sections} section(s), ${Object.keys(SCENES).length} scene(s), every console within its rows, every picture a diagram`)
