// Capture guard — "every output is real" (CLAUDE.md) as a check, not a promise:
//
//   1. Every console a scene draws IS a capture: its text equals a transcript of one of
//      sections/**/output.txt or second.txt, byte for byte (console.ts `transcript`). A console typed
//      by hand, or a capture edited after the fact, fails here — scenes import captures with `?raw`.
//   2. Every section.json has the output.txt its run wrote (`sim.py run` writes them side by side).
//
// It reports, without failing, the captures no scene draws yet: until every course is authored, that
// list is the work left.
//
// Run: npm run check:captures
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { consolesOf, loadRegistry } from './registry.mjs'

const { SCENES, FRAME } = await loadRegistry()
const problems = []

const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else files.push(p)
  }
}
walk('sections')

// --- 2. every section.json has its output -------------------------------------------------------
// first-login/03-ssh was captured by the earlier recorder and has no session to run (CLAUDE.md).
for (const f of files.filter((f) => f.endsWith('section.json'))) {
  const out = join(f, '..', 'output.txt')
  if (!existsSync(out)) problems.push(`${relative('.', f)}  has no output.txt beside it — run: python3 scripts/sim.py run ${relative('sections', join(f, '..'))}`)
}

// --- 1. every console is a capture --------------------------------------------------------------
const captures = new Map(files.filter((f) => /(output|second)\.txt$/.test(f)).map((f) => [FRAME.transcript(readFileSync(f, 'utf8')), relative('.', f)]))
const used = new Set()
for (const [id, scene] of Object.entries(SCENES))
  for (const c of consolesOf(scene)) {
    const from = captures.get(c.code)
    if (from) used.add(from)
    else problems.push(`scene ${id}  console '${c.id}' is not a capture — import an output.txt with ?raw, never type a transcript`)
  }

if (problems.length) {
  console.error(`✗ ${problems.length} capture problem(s):\n` + problems.map((p) => '  ' + p).join('\n'))
  process.exit(1)
}
const unused = [...captures.values()].filter((f) => !used.has(f)).sort()
console.log(`✓ every console is a capture — ${used.size} of ${captures.size} captures drawn`)
if (unused.length) console.log(`  not drawn by any scene yet (${unused.length}):\n` + unused.map((f) => '    ' + f).join('\n'))
