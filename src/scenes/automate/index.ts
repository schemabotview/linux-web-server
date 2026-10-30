import type { SceneModel } from '@graphlearning/graphl-flow'
import { CONSOLE_W, consoleFrame, consoleH, consoleNode, drawnRows, fold, rowOf, rowsFrom, transcript } from '../console'
import streams from '../../../sections/automate/01-streams/output.txt?raw'
import visits from '../../../sections/automate/02-who-visits/output.txt?raw'
import awk from '../../../sections/automate/03-awk/output.txt?raw'
import script from '../../../sections/automate/04-deploy-script/output.txt?raw'
import safe from '../../../sections/automate/05-safe-script/output.txt?raw'
import timer from '../../../sections/automate/06-timer/output.txt?raw'
import logrotate from '../../../sections/automate/07-logrotate/output.txt?raw'

// Course 6 — logs and automation. Every console is a capture from sections/automate/. The access log's
// visits (§2, §3, §6) were replayed off screen with curl, each with a chosen User-Agent: nginx's log
// of them is real, the visitors are stand-ins, and the frames say so.
const t = transcript
const WEB01 = 'ana@web-01: ~'
const LAPTOP = 'ana@laptop: ~'
const VISITS = 'A stand-in, said plainly: these visits were replayed off screen with curl — browsers, a crawler and a scanner, by their User-Agent. nginx and its log are real.'

/** A heredoc's body as the file it wrote: the `> ` rows after `cmd`, up to `> EOF`, prefix removed. */
function heredoc(text: string, cmd: string): string {
  const rows = text.split('\n'), a = rowOf(text, cmd), b = rowOf(text, '> EOF', a)
  return rows.slice(a, b - 1).map((r) => r.replace(/^> ?/, '')).join('\n')
}

// §1 ◆ stdin, stdout, stderr — a full scene: where each stream goes, and why the order of
// redirections matters.
const stT = t(streams)
const fd = (id: string, n: string, tone: 'ingest' | 'consume') => ({ type: 'item' as const, id, title: n === '1' ? '1 · stdout' : '2 · stderr', sub: n === '1' ? '/etc/hostname' : 'cannot access /nope', icon: n === '1' ? 'file' : 'zap', tone })
const target = (id: string, title: string, icon: string) => ({ type: 'item' as const, id, title, icon, chip: false })
const streamsScene: SceneModel = {
  title: 'Every process has three streams',
  sub: '0 stdin in, 1 stdout for results, 2 stderr for errors — both outputs go to the terminal unless redirected',
  nodes: [
    { type: 'group', id: 'row', dir: 'row', bare: true, children: [
      consoleNode('st-console', { output: streams, title: WEB01, highlight: [...rowsFrom(stT, 'ls /etc/hostname /nope > out.txt 2>&1'), ...rowsFrom(stT, 'ls /etc/hostname /nope 2>&1 > out.txt', "ls: cannot access '/nope'", rowOf(stT, '2>&1 > out.txt'))] },
        { w: CONSOLE_W, h: consoleH(drawnRows(stT)) }),
      { type: 'group', id: 'cases', bare: true, children: [
        { type: 'group', id: 'c1', title: '> out.txt 2>&1', sub: 'read left to right: 1 → the file, then 2 → wherever 1 points now: the file', dir: 'row', tone: 'store', children: [
          { type: 'group', id: 'c1-fds', bare: true, children: [fd('c1-1', '1', 'ingest'), fd('c1-2', '2', 'consume')] },
          { type: 'item', id: 'c1-file', title: 'out.txt', icon: 'file', bullets: ['/etc/hostname', 'cannot access /nope'] },
        ] },
        { type: 'group', id: 'c2', title: '2>&1 > out.txt', sub: '2 → wherever 1 points now: the terminal; THEN 1 → the file', dir: 'row', tone: 'consume', children: [
          { type: 'group', id: 'c2-fds', bare: true, children: [fd('c2-1', '1', 'ingest'), fd('c2-2', '2', 'consume')] },
          { type: 'group', id: 'c2-targets', bare: true, children: [target('c2-file', 'out.txt', 'file'), target('c2-term', 'the terminal', 'terminal')] },
        ] },
        { type: 'group', id: 'c3', title: 'ls /etc /nope 2>/dev/null | wc -l', sub: 'a pipe joins one stdout to the next stdin; /dev/null swallows what it gets', dir: 'row', tone: 'ingest', children: [
          { type: 'item', id: 'p-ls', title: 'ls', sub: '2 → /dev/null', icon: 'terminal', stack: true },
          { type: 'item', id: 'p-wc', title: 'wc -l', sub: 'counts the lines: 142', icon: 'terminal', stack: true, tone: 'store' },
        ] },
      ] },
    ] },
  ],
  edges: [
    { from: 'c1-1', to: 'c1-file' }, { from: 'c1-2', to: 'c1-file' },
    { from: 'c2-1', to: 'c2-file' }, { from: 'c2-2', to: 'c2-term' },
    { from: 'p-ls', to: 'p-wc', label: '|' },
  ],
}

// §2 — who visits: grep, cut, sort, uniq -c. The unsorted uniq -c is the lesson: it only merges
// ADJACENT lines.
const viT = t(visits)
const whoVisits = consoleFrame({
  left: { output: visits, title: WEB01, highlight: [rowOf(viT, '      9 /'), rowOf(viT, '      3 /'), rowOf(viT, '     13 /')] },
  picture: [
    { type: 'table', id: 'fields', title: 'One line of access.log, split on spaces', tone: 'ingest', fill: true, columns: ['field', 'here', 'is'], rows: [
      ['1', '192.0.2.10', 'the client’s address'],
      ['4', '[02/Nov/2026:09:30:56', 'when'],
      ['7', '/', 'the path asked for'],
      ['9', '200', 'the status code'],
      ['10', '75', 'bytes sent'],
    ] },
    { type: 'group', id: 'pipe', title: 'cut -d\' \' -f7 | sort | uniq -c | sort -rn', sub: 'each tool does one thing; the pipe joins them', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'v-cut', title: 'cut', sub: 'field 7: the path', icon: 'filter', stack: true },
      { type: 'item', id: 'v-sort', title: 'sort', sub: 'equal paths side by side', icon: 'layers', stack: true },
      { type: 'item', id: 'v-uniq', title: 'uniq -c', sub: 'count each RUN of equal lines', icon: 'table', stack: true },
      { type: 'item', id: 'v-rank', title: 'sort -rn', sub: 'by count, biggest first', icon: 'chart', stack: true, tone: 'store' },
    ] },
    { type: 'note', id: 'adjacent', tone: 'consume', text: 'Without sort, / is counted three times — 9, 1 and 3 — because uniq only merges lines that are next to each other.' },
    { type: 'note', id: 'standin', tone: 'neutral', text: VISITS },
  ],
  edges: [{ from: 'v-cut', to: 'v-sort' }, { from: 'v-sort', to: 'v-uniq' }, { from: 'v-uniq', to: 'v-rank' }],
})

// §3 — awk: status codes, the 404s' paths, the visitors, and a sum.
const awT = t(awk)
const awkFrame = consoleFrame({
  left: { output: awk, title: WEB01, highlight: [rowOf(awT, '      6 404'), rowOf(awT, '      5 Mozilla/5.0 zgrab/0.x'), rowOf(awT, '24 requests, 1926 bytes')] },
  picture: [
    { type: 'table', id: 'shape', title: 'awk: pattern { action }, for every line', tone: 'ingest', fill: true, columns: ['program', 'does'], rows: [
      ['{print $9}', 'every line: print field 9, the status'],
      ['$9 == 404 {print $7}', 'only lines whose status is 404: print the path'],
      ['-F\'"\' {print $6}', 'split on quotes instead: field 6 is the User-Agent'],
      ['{bytes += $10} END {print NR, …}', 'add as you go; END runs once, after the last line'],
    ] },
    { type: 'table', id: 'found', title: 'What the log says', tone: 'ingest', fill: true, columns: ['question', 'answer'], rows: [
      ['status codes', '18 × 200, 6 × 404'],
      { cells: ['what failed', '/wp-login.php, /.env, /.git/config, /admin — probes for files this site never had'], tone: 'consume' },
      ['who', 'Firefox, Safari, Googlebot — and zgrab, a scanner'],
      ['how much', '24 requests, 1926 bytes'],
    ] },
    { type: 'note', id: 'standin', tone: 'neutral', text: VISITS },
  ],
})

// §4 — deploy.sh: variables, quoting, exit codes. The script shown is the heredoc in the capture. Its
// bug is real: rsync fails, the script says Done, and exits 0.
const scT = t(script)
const deployScript = consoleFrame({
  left: { output: script, title: LAPTOP, highlight: [...rowsFrom(scT, 'rsync: [sender] change_dir', '3) at main.c'), rowOf(scT, 'Done.', rowOf(scT, '3) at main.c')), rowOf(scT, '0', rowOf(scT, 'echo $?', rowOf(scT, 'mv ~/site ~/site.old')))] },
  picture: [
    { type: 'code', id: 'file', lang: 'shell', filename: '~/deploy.sh', code: heredoc(scT, 'cat > ~/deploy.sh'), fill: true, highlight: [3, 4, 7] },
    { type: 'table', id: 'parts', title: 'The parts of a script', tone: 'ingest', fill: true, columns: ['part', 'means'], rows: [
      ['#!/bin/bash', 'the interpreter: run me with bash'],
      ['site_dir="$HOME/site"', 'a variable — no spaces around ='],
      ['"$site_dir/"', 'quoted: a path with spaces stays one word'],
      ['$?', 'the last command’s exit code: 0 is success'],
    ] },
    { type: 'group', id: 'bug', title: 'The bug, from the real output', sub: 'a script’s exit code is its LAST command’s', dir: 'row', tone: 'consume', children: [
      { type: 'item', id: 'b-rsync', title: 'rsync fails', sub: 'code 23: no ~/site', icon: 'zap', stack: true },
      { type: 'item', id: 'b-done', title: 'echo "Done."', sub: 'runs anyway', icon: 'terminal', stack: true },
      { type: 'item', id: 'b-zero', title: 'exit 0', sub: 'it reports success', icon: 'check', stack: true },
    ] },
  ],
  edges: [{ from: 'b-rsync', to: 'b-done' }, { from: 'b-done', to: 'b-zero' }],
})

// §5 — make it safe: set -euo pipefail, an if, a trap; and their limits.
const sfT = t(safe)
const safeCode = heredoc(sfT, 'cat > ~/deploy.sh')
const sl = (s: string) => safeCode.split('\n').findIndex((l) => l.includes(s)) + 1
const safeScript = consoleFrame({
  left: { output: safe, title: LAPTOP, highlight: [rowOf(sfT, 'deploy.sh: no /home/ana/site/index.html'), rowOf(sfT, '1', rowOf(sfT, 'echo $?'))] },
  picture: [
    { type: 'code', id: 'file', lang: 'shell', filename: '~/deploy.sh', code: safeCode, fill: true, highlight: [sl('set -euo pipefail'), sl('trap '), sl('if [ ! -f'), sl('exit 1')] },
    { type: 'table', id: 'flags', title: 'set -euo pipefail', tone: 'ingest', fill: true, columns: ['flag', 'makes', 'limit'], rows: [
      ['-e', 'a failing command stops the script', 'not inside if, or before && / ||'],
      ['-u', 'an unset variable is an error', 'catches typos like $site_dri'],
      ['-o pipefail', 'a pipeline fails if ANY part fails', 'not just the last command'],
      ['trap … ERR', 'say where it failed, on stderr', 'an explicit exit 1 does not trigger it'],
    ] },
    { type: 'note', id: 'check', tone: 'store', text: 'The if checks for what the script needs BEFORE touching the server, says why on stderr, and exits 1: a caller — or a timer — can tell it failed.' },
  ],
})

// §6 — a timer for the nightly report: .timer → .service, vs cron. The unit files shown are the ones
// tee echoed in the capture. Folded: the start of the service's heredoc, both echoes, and list-timers'
// footer.
const tmT = t(timer)
// The terminal wrapped the service's ExecStart at 80 columns: a row exactly COLS wide continues on the
// next, so the FILE joins them back (as Code.tsx does for a wrapped command).
const unwrap = (rows: string[]) => rows.reduce<string[]>((out, r, i) => (i && rows[i - 1].length === 80 ? [...out.slice(0, -1), out[out.length - 1] + r] : [...out, r]), [])
const unitEcho = (from: string) => { const a = rowOf(tmT, '[Unit]', rowOf(tmT, from)); return unwrap(tmT.split('\n').slice(a - 1, rowOf(tmT, 'ana@web-01', a) - 1)).join('\n') }
const serviceUnit = unitEcho('[sudo] password for ana'), timerUnit = unitEcho('[Install]')
const timerFrame = consoleFrame({
  left: {
    output: timer, title: WEB01,
    show: fold(tmT, ['> [Unit]', rowOf(tmT, '> [Unit]') + 2], [rowOf(tmT, '[sudo] password for ana') + 1, rowOf(tmT, 'site-report.timer <<') - 1],
      ['> [Unit]', rowOf(tmT, 'site-report.timer <<') + 3, rowOf(tmT, 'site-report.timer <<')],
      [rowOf(tmT, '> EOF', rowOf(tmT, 'site-report.timer <<')) + 1, rowOf(tmT, 'daemon-reload') - 1], ['Created symlink', 'etc/systemd/system/site-report.timer'], ['', 'Pass --all', rowOf(tmT, '1 timers listed.') - 1]),
    highlight: [rowOf(tmT, '> OnCalendar=*-*-* 02:00'), rowOf(tmT, 'Tue 2026-11-03 02:00:00'), ...rowsFrom(tmT, '     18 200', '      6 404'), rowOf(tmT, 'inactive', rowOf(tmT, 'systemctl is-active cron'))],
  },
  picture: [
    { type: 'group', id: 'units', bare: true, children: [
      { type: 'code', id: 'timer-unit', lang: 'ini', filename: 'site-report.timer', code: timerUnit, fill: true },
      { type: 'code', id: 'service-unit', lang: 'ini', filename: 'site-report.service', code: serviceUnit, fill: true },
    ] },
    { type: 'group', id: 'flow', title: 'Two units: when, and what', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 't-timer', title: 'site-report.timer', sub: 'OnCalendar: 02:00 every day', icon: 'timer', stack: true },
      { type: 'item', id: 't-service', title: 'site-report.service', sub: 'oneshot: runs the report, exits', icon: 'settings', stack: true },
      { type: 'item', id: 't-journal', title: 'the journal', sub: 'its output, under its own unit', icon: 'log', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'vs', title: 'A timer, compared with cron', tone: 'ingest', fill: true, columns: ['', 'systemd timer', 'cron'], rows: [
      ['output', 'in the journal, by unit', 'mailed, or lost'],
      ['missed run (server off)', 'Persistent=true: runs at boot', 'skipped'],
      ['test it now', 'systemctl start the .service', 'wait, or copy the line'],
      { cells: ['on this image', 'built in', 'cron is not even running'], tone: 'consume' },
    ] },
  ],
  edges: [{ from: 't-timer', to: 't-service', label: 'starts' }, { from: 't-service', to: 't-journal', label: 'writes' }],
})

// §7 — logrotate: missing from the cloud image, though nginx ships its config. Folded: apt's install.
const lrT = t(logrotate)
const logrotateFrame = consoleFrame({
  left: {
    output: logrotate, title: WEB01, show: fold(lrT, ['Installing:', 'Processing triggers for man-db']),
    highlight: [rowOf(lrT, 'sudo: logrotate: command not found'), rowOf(lrT, 'Tue 2026-11-03'), ...rowsFrom(lrT, '0 Nov  2 09:31 access.log', '1390 Nov  2 09:30 error.log.1')],
  },
  picture: [
    { type: 'group', id: 'rotate', title: 'One rotation, every day', sub: 'logs that never grow forever', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'r-log', title: 'access.log', sub: 'a new, empty file: nginx writes here', icon: 'log', stack: true, tone: 'store' },
      { type: 'item', id: 'r-1', title: 'access.log.1', sub: 'yesterday — not yet compressed', icon: 'file', stack: true },
      { type: 'item', id: 'r-gz', title: 'access.log.2.gz …', sub: 'older days, compressed', icon: 'archive', stack: true },
      { type: 'item', id: 'r-gone', title: 'after 14', sub: 'deleted', icon: 'zap', stack: true, tone: 'neutral' },
    ] },
    { type: 'table', id: 'conf', title: '/etc/logrotate.d/nginx, line by line', tone: 'ingest', fill: true, columns: ['line', 'means'], rows: [
      ['daily', 'rotate once a day'],
      ['rotate 14', 'keep 14 old logs'],
      ['compress, delaycompress', 'gzip them — all but the newest old one'],
      ['create 0640 www-data adm', 'the new, empty log’s mode and owner'],
      ['postrotate … nginx rotate', 'tell nginx to reopen its log files'],
    ] },
    { type: 'note', id: 'finding', tone: 'consume', text: 'A real finding: Debian 13’s cloud image has no logrotate, though nginx ships its config. These logs would never have rotated. It is the kind of thing a review finds.' },
  ],
  edges: [{ from: 'r-log', to: 'r-1' }, { from: 'r-1', to: 'r-gz' }, { from: 'r-gz', to: 'r-gone' }],
})

export const automateScenes: Record<string, SceneModel> = {
  'automate-streams': streamsScene,
  'automate-who-visits': whoVisits,
  'automate-awk': awkFrame,
  'automate-deploy-script': deployScript,
  'automate-safe-script': safeScript,
  'automate-timer': timerFrame,
  'automate-logrotate': logrotateFrame,
}
