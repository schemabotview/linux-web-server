import type { SceneModel } from '@graphlearning/graphl-flow'
import { CONSOLE_W, consoleH, consoleNode, drawnRows, fold, rowOf, transcript } from '../console'
import { serverMap } from '../map'
import https from '../../../sections/web/07-https/output.txt?raw'

// The two sections drawn on the server map (COURSE-PLAN.md: first-login/01 and operate/07). They have
// no capture of their own; first-login/01 shows the end of web/07's real capture — the finished site
// answering over HTTPS — and labels its certificate authority as the stand-in it is.

// first-login/01 — the server we'll build: the map, complete, beside the proof.
const hsT = transcript(https)
const proofFrom = rowOf(hsT, 'ana@laptop:~$ curl -sSI https://ana.example/')
const proofShow = fold(hsT, [1, proofFrom - 1])
const map1 = serverMap()
export const finishedServer: SceneModel = {
  title: 'The server we’ll build',
  sub: 'web-01 at the end of this course: ana.example, served over HTTPS, locked down and looking after itself',
  nodes: [
    { type: 'group', id: 'f-row', dir: 'row', bare: true, children: [
      ...map1.nodes,
      { type: 'group', id: 'f-proof', bare: true, children: [
        consoleNode('f-console', { output: https, title: 'ana@laptop: ~', show: proofShow, highlight: [proofFrom + 1, rowOf(hsT, 'HTTP/1.1 301')] }, { w: CONSOLE_W, h: consoleH(drawnRows(hsT, proofShow)) }),
        { type: 'note', id: 'f-standin', tone: 'neutral', text: 'Pebble is a local certificate authority standing in for Let’s Encrypt: ana.example is a documentation name, never on public DNS (§5.7).' },
      ] },
    ] },
  ],
  edges: map1.edges,
}

// operate/07 — a runbook, and where next: the map, complete, with the first command for each symptom
// (every one met in this course) and what the course deliberately left out (COURSE-PLAN.md).
const map7 = serverMap()
export const runbook: SceneModel = {
  title: 'A runbook, and where next',
  sub: 'the server Ana built — and the first command to reach for when something is wrong',
  nodes: [
    { type: 'group', id: 'r-row', dir: 'row', bare: true, children: [
      ...map7.nodes,
      { type: 'group', id: 'r-tables', bare: true, children: [
        { type: 'table', id: 'r-book', title: 'Symptom → first command', tone: 'ingest', columns: ['symptom', 'first', 'met in'], rows: [
          ['the site is down', 'systemctl status nginx; nginx -t', '§7.4'],
          ['a 403', 'ls -l; on Red Hat, ls -Z', '§2.3, §5.9'],
          ['the disk is full', 'df -h, then du -sh', '§7.1'],
          ['slow', 'uptime, free -h, top', '§7.2'],
          ['what happened?', 'journalctl -u <unit>', '§4.5'],
          ['what is open?', 'ss -tlnp; nft list ruleset', '§5.6, §5.8'],
          ['a change to make', 'test, then reload — from a 2nd session', '§2.6, §5.3'],
        ] },
        { type: 'table', id: 'r-next', title: 'Left out on purpose — where next', tone: 'neutral', columns: ['topic', 'why it waits'], rows: [
          ['LVM and partitioning', 'one disk was enough'],
          ['cgroups and namespaces', 'how containers are built'],
          ['netfilter internals', 'the firewall’s own machinery'],
          ['fork / exec, job control', 'how a shell runs programs'],
          ['sed and regular expressions', 'text editing, in depth'],
          ['vim', 'an editor worth its own course'],
        ] },
      ] },
    ] },
  ],
  edges: map7.edges,
}
