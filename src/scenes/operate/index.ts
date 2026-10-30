import type { SceneModel } from '@graphlearning/graphl-flow'
import { consoleFrame, fold, rowOf, rowsFrom, transcript } from '../console'
import disk from '../../../sections/operate/01-disk-full/output.txt?raw'
import memory from '../../../sections/operate/02-memory-load/output.txt?raw'
import backups from '../../../sections/operate/03-backups/output.txt?raw'
import down from '../../../sections/operate/04-site-down/output.txt?raw'
import review from '../../../sections/operate/05-hardening-review/output.txt?raw'
import kernel from '../../../sections/operate/06-kernel/output.txt?raw'
import { runbook, finishedServer } from './map-scenes'

// Course 7 — keep it running. Every console is a capture from sections/operate/. Two sections start
// from a server broken OFF SCREEN on purpose — a 3 GB log made with fallocate (§1), a missing
// semicolon and a chmod 600 (§4) — and their frames say so.
const t = transcript
const WEB01 = 'ana@web-01: ~'
const LAPTOP = 'ana@laptop: ~'

// §1 — the disk is full: df vs du, and a deleted file that is still open.
const dkT = t(disk)
const dfAfter = /^\/dev\/vda1 +\S+ +(\S+) +(\S+) +(\d+%)/m
const usedRows = [...dkT.matchAll(new RegExp(dfAfter.source, 'gm'))].map((m) => m.slice(1))
const holders = [...dkT.matchAll(/^\/proc\/(\d+)\/fd\/(\d+) -> \/var\/log\/nginx\/access\.log \(deleted\)$/gm)].map((m) => m[1])
const diskFull = consoleFrame({
  left: { output: disk, title: WEB01, highlight: [rowOf(dkT, '3.0G Nov'), rowOf(dkT, '42% /', rowOf(dkT, 'sudo rm')), rowOf(dkT, '8.0K'), ...rowsFrom(dkT, `/proc/${holders[0]}/fd`, `/proc/${holders[holders.length - 1]}/fd`), rowOf(dkT, '20% /')] },
  picture: [
    { type: 'table', id: 'nums', title: 'df and du, after each step', tone: 'ingest', fill: true, columns: ['after', 'df: used', 'du: /var/log/nginx'], rows: [
      ['the start', `${usedRows[0][0]} (${usedRows[0][2]})`, '3.1G'],
      { cells: ['rm access.log', `${usedRows[1][0]} (${usedRows[1][2]}) — unchanged`, '8.0K'], tone: 'consume' },
      { cells: ['reload nginx', `${usedRows[2][0]} (${usedRows[2][2]})`, '8.0K'], tone: 'store' },
    ] },
    { type: 'group', id: 'open', title: 'rm removes a NAME; the data goes when nothing holds it', sub: 'df counts the filesystem’s used blocks; du adds up the files it can find by name', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'o-name', title: 'access.log', sub: 'the name — gone after rm', icon: 'file', stack: true, tone: 'neutral' },
      { type: 'item', id: 'o-inode', title: 'the file itself', sub: '3 GB of blocks, “(deleted)”', icon: 'disk', stack: true, tone: 'consume' },
      { type: 'item', id: 'o-nginx', title: 'nginx', sub: `pids ${holders.join(', ')}: still holding it, fd 12`, icon: 'nginx', stack: true },
    ] },
    { type: 'note', id: 'fix', tone: 'store', text: 'The space came back only when nginx reopened its logs. Next time: rotate it, or empty it in place with truncate -s 0 — never rm a log that a program has open.' },
    { type: 'note', id: 'standin', tone: 'neutral', text: 'A stand-in, said plainly: the 3 GB log was made off screen with fallocate. Everything after that is real.' },
  ],
  edges: [{ from: 'o-name', to: 'o-inode', label: 'rm cut this' }, { from: 'o-nginx', to: 'o-inode', label: 'still open' }],
})

// §2 — memory and load: "available" vs "free"; load ≠ CPU %.
const mmT = t(memory)
const load = (from: number) => /load average: ([\d.]+), ([\d.]+), ([\d.]+)/.exec(mmT.split('\n')[rowOf(mmT, 'load average', from) - 1])!.slice(1)
const before = load(1), during = load(rowOf(mmT, '; do yes'))
const memoryLoad = consoleFrame({
  left: { output: memory, title: WEB01, highlight: [rowOf(mmT, 'Mem:'), rowOf(mmT, '2', rowOf(mmT, 'nproc')), rowOf(mmT, 'load average', rowOf(mmT, '; do yes')), rowOf(mmT, '%Cpu(s)')] },
  picture: [
    { type: 'table', id: 'free', title: 'free -h, read correctly', tone: 'ingest', fill: true, columns: ['column', 'means'], rows: [
      ['used', 'held by programs'],
      ['buff/cache', 'file data kept in RAM, in case it is read again'],
      { cells: ['free', 'never used at all — NOT what you have left'], tone: 'consume' },
      { cells: ['available', 'what a program could get now: free + cache the kernel can drop'], tone: 'store' },
    ] },
    { type: 'table', id: 'load', title: `Load average on ${/^(\d+)$/m.exec(mmT.split('\n').slice(rowOf(mmT, 'nproc')).join('\n'))![1]} CPUs`, tone: 'ingest', fill: true, columns: ['when', '1 min', '5 min', '15 min'], rows: [
      ['idle', ...before],
      { cells: ['4 × yes, a minute later', ...during], tone: 'consume' },
    ] },
    { type: 'group', id: 'meaning', title: 'Load is a queue, not a percentage', sub: 'how many tasks are running or waiting to run, averaged over 1, 5 and 15 minutes', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'l-cpu', title: '2 CPUs', sub: 'nproc: 2 can run at once', icon: 'cpu', stack: true },
      { type: 'item', id: 'l-q', title: '4 runnable', sub: 'top: 0.0 id — no idle time; 2 always wait', icon: 'users', stack: true, tone: 'consume' },
      { type: 'item', id: 'l-avg', title: 'load → 4', sub: 'climbing: 1-min first, 15-min last', icon: 'gauge', stack: true },
    ] },
  ],
  edges: [{ from: 'l-cpu', to: 'l-q' }, { from: 'l-q', to: 'l-avg' }],
})

// §3 — backups, and a tested restore.
const bkT = t(backups)
const hashes = [...bkT.matchAll(/^([0-9a-f]{64})  (\S+)$/gm)].map((m) => [m[2], m[1]])
const backupsFrame = consoleFrame({
  left: { output: backups, title: LAPTOP, highlight: [rowOf(bkT, 'restore matches the backup', rowOf(bkT, 'diff -r') + 2), ...rowsFrom(bkT, 'about.html', 'index.html', rowOf(bkT, "sha256sum *'")), ...rowsFrom(bkT, 'about.html', 'index.html', rowOf(bkT, 'cd /tmp/restore-test && sha256sum'))] },
  picture: [
    { type: 'group', id: 'flow', title: 'Back up, then prove you can restore', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'b-site', title: 'web-01', sub: '/var/www/ana.example', icon: 'server', stack: true },
      { type: 'item', id: 'b-copy', title: '~/backups/ana.example', sub: 'on the laptop: another machine', icon: 'laptop', stack: true, tone: 'store' },
      { type: 'item', id: 'b-restore', title: '/tmp/restore-test', sub: 'a restore, somewhere harmless', icon: 'folder', stack: true },
    ] },
    { type: 'table', id: 'hashes', title: 'The proof: same bytes on the server and in the restore', tone: 'ingest', fill: true, columns: ['file', 'sha256 (first 16)', 'server = restore'], rows: [
      ...hashes.slice(0, 2).map(([f, h]) => ({ cells: [f, h.slice(0, 16) + '…', hashes.slice(2).some(([g, k]) => g === f && k === h) ? 'yes' : 'NO'], tone: 'store' as const })),
    ] },
    { type: 'table', id: 'scope', title: 'What a full backup of web-01 covers', tone: 'ingest', fill: true, columns: ['path', 'holds'], rows: [
      { cells: ['/var/www/ana.example', 'the site — backed up here'], tone: 'store' },
      ['/etc', 'every configuration file: nginx, ssh, nftables'],
      ['/etc/letsencrypt', 'the certificate and its key'],
    ] },
    { type: 'table', id: 'rules', title: 'Three rules', tone: 'ingest', fill: true, columns: ['rule', 'because'], rows: [
      ['keep it on another machine', 'a backup on the same disk dies with it'],
      ['redundancy is not a backup', 'a mirror copies a deletion instantly'],
      { cells: ['it is a backup once a restore is tested', 'until then it is a hope'], tone: 'store' },
    ] },
  ],
  edges: [{ from: 'b-site', to: 'b-copy', label: 'rsync -a' }, { from: 'b-copy', to: 'b-restore', label: 'restore' }],
})

// §4 — the site is down: the ladder, rung by rung. Folded: the login banner.
const dnT = t(down)
const siteDown = consoleFrame({
  left: {
    output: down, title: LAPTOP, show: fold(dnT, ['Linux web-01', 'permitted by applicable law']),
    highlight: [rowOf(dnT, '192.0.2.10      ana.example'), rowOf(dnT, 'failed', rowOf(dnT, 'systemctl is-active')), ...rowsFrom(dnT, '[emerg]', 'd/ana.example:6'), rowOf(dnT, 'HTTP/1.1 403 Forbidden'), rowOf(dnT, '-rw------- 1 deploy'), rowOf(dnT, 'HTTP/1.1 200 OK')],
  },
  picture: [
    { type: 'group', id: 'ladder', title: 'Climb the ladder, one rung at a time', sub: 'each rung rules something out; do not guess, ask', tone: 'ingest', children: [
      { type: 'group', id: 'rungs', dir: 'row', bare: true, children: [
        { type: 'item', id: 'r-dns', title: 'name', sub: 'getent: resolves ✓', icon: 'search', stack: true, tone: 'store' },
        { type: 'item', id: 'r-net', title: 'port', sub: 'curl: cannot connect — nothing listening', icon: 'network', stack: true, tone: 'consume' },
        { type: 'item', id: 'r-svc', title: 'nginx', sub: 'failed → journal → nginx -t: line 6', icon: 'nginx', stack: true, tone: 'consume' },
        { type: 'item', id: 'r-perm', title: 'permissions', sub: '403: -rw------- deploy', icon: 'lock', stack: true, tone: 'consume' },
        { type: 'item', id: 'r-ok', title: '200 OK', sub: 'from the laptop too', icon: 'check', stack: true, tone: 'store' },
      ] },
    ] },
    { type: 'table', id: 'asks', title: 'The ladder, as commands', tone: 'ingest', fill: true, columns: ['rung', 'ask'], rows: [
      ['name', 'getent hosts ana.example'],
      ['port', 'curl -sS http://ana.example/'],
      ['service', 'systemctl is-active · journalctl -u · nginx -t'],
      ['permissions', 'ls -l on the file nginx must read'],
    ] },
    { type: 'table', id: 'fixes', title: 'Two faults, two fixes', tone: 'ingest', fill: true, columns: ['symptom', 'cause', 'fix'], rows: [
      ['nginx failed', 'a missing ; after index index.html', 'sed adds it, nginx -t, start'],
      ['403 Forbidden', 'index.html is -rw------- deploy: nginx (www-data) cannot read', 'chmod 644'],
    ] },
    { type: 'note', id: 'standin', tone: 'neutral', text: 'A stand-in, said plainly: both faults were made off screen on purpose — the kind a hurried edit makes. Finding them is real.' },
  ],
  edges: [{ from: 'r-dns', to: 'r-net' }, { from: 'r-net', to: 'r-svc' }, { from: 'r-svc', to: 'r-perm' }, { from: 'r-perm', to: 'r-ok' }],
})

// §5 — a hardening review. Folded: the login banner and the logout.
const rvT = t(review)
const hardening = consoleFrame({
  left: {
    output: review, title: LAPTOP, show: fold(rvT, ['Linux web-01', 'permitted by applicable law'], ['logout', 'Connection to 192.0.2.10 closed.']),
    highlight: [...rowsFrom(rvT, '0.0.0.0:5355', 'users:(("systemd-resolve"', rowOf(rvT, 'sudo ss -tlnp')), ...rowsFrom(rvT, 'permitrootlogin no', 'passwordauthentication no'), ...rowsFrom(rvT, 'policy drop;')],
  },
  picture: [
    { type: 'table', id: 'review', title: 'Six questions for any server', tone: 'ingest', fill: true, columns: ['question', 'web-01 answers', 'verdict'], rows: [
      { cells: ['what is listening?', '22 sshd, 80 nginx — and 5355, LLMNR', '5355: not needed, and the firewall drops it'], tone: 'consume' },
      { cells: ['who can log in over SSH?', 'keys only; root may not', 'good'], tone: 'store' },
      { cells: ['who can become root?', 'the sudo group: ana', 'good'], tone: 'store' },
      ['which accounts have a shell?', 'root, ana, deploy — sync is Debian’s own', 'root: no password, no SSH; deploy: for rsync'],
      { cells: ['what gets through?', 'policy drop; 22, 80, 443', 'good'], tone: 'store' },
      { cells: ['what is out of date?', 'nothing upgradable; unattended-upgrades active', 'good'], tone: 'store' },
    ] },
    { type: 'table', id: 'asked', title: 'Asked with', tone: 'ingest', fill: true, columns: ['question', 'command'], rows: [
      ['listening', 'sudo ss -tlnp'],
      ['SSH', 'sudo sshd -T | grep …'],
      ['root', 'getent group sudo'],
      ['shells', 'awk -F: on /etc/passwd'],
      ['firewall · updates', 'sudo nft list ruleset · apt list --upgradable'],
    ] },
    { type: 'group', id: 'layers', title: 'Defence in layers', sub: 'each one covers for a mistake in another', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'y-fw', title: 'firewall', sub: 'drops 5355 though it listens', icon: 'firewall', stack: true },
      { type: 'item', id: 'y-ssh', title: 'SSH', sub: 'no passwords to guess', icon: 'key', stack: true },
      { type: 'item', id: 'y-upd', title: 'updates', sub: 'fixes arrive daily', icon: 'shield', stack: true },
    ] },
  ],
})

// §6 — a kernel update and a reboot: running vs installed. The image's kernel is the newest security
// kernel: nothing is pending (NOTES.md), and the frame says so.
const knT = t(kernel)
const kernelFrame = consoleFrame({
  left: { output: kernel, title: WEB01, highlight: [rowOf(knT, '6.12.113+deb13-cloud-amd64'), rowOf(knT, "cannot access '/run/reboot-required'"), ...rowsFrom(knT, 'Installed: 6.12.113-1', 'Candidate: 6.12.113-1'), rowOf(knT, '7.2.11-1~bpo13+1 100')] },
  picture: [
    { type: 'table', id: 'three', title: 'Three questions, three places to look', tone: 'ingest', fill: true, columns: ['question', 'ask', 'answer here'], rows: [
      ['which kernel is RUNNING?', 'uname -r', '6.12.113'],
      ['which are INSTALLED?', 'dpkg -l linux-image-* · ls /boot', '6.12.113 — one'],
      ['is a reboot needed?', '/run/reboot-required', 'absent: no'],
    ] },
    { type: 'group', id: 'update', title: 'How a kernel update arrives — not today', sub: 'the new kernel is installed BESIDE the running one; only a reboot switches', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'k-apt', title: 'apt upgrade', sub: 'installs the new linux-image', icon: 'package', stack: true },
      { type: 'item', id: 'k-flag', title: '/run/reboot-required', sub: 'appears', icon: 'bell', stack: true },
      { type: 'item', id: 'k-old', title: 'uname -r', sub: 'still the OLD kernel', icon: 'linux', stack: true, tone: 'consume' },
      { type: 'item', id: 'k-boot', title: 'reboot', sub: 'GRUB boots the newest', icon: 'power', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'policy', title: 'apt-cache policy: where versions come from', tone: 'ingest', fill: true, columns: ['version', 'from', 'priority'], rows: [
      { cells: ['6.12.113-1 (installed)', 'trixie-security', '500'], tone: 'store' },
      ['6.12.107-1', 'trixie, as released', '500'],
      { cells: ['7.2.11 (backports)', 'trixie-backports', '100: never chosen on its own'], tone: 'neutral' },
    ] },
  ],
  edges: [{ from: 'k-apt', to: 'k-flag' }, { from: 'k-flag', to: 'k-old' }, { from: 'k-old', to: 'k-boot' }],
})

export const operateScenes: Record<string, SceneModel> = {
  'operate-disk-full': diskFull,
  'operate-memory-load': memoryLoad,
  'operate-backups': backupsFrame,
  'operate-site-down': siteDown,
  'operate-hardening-review': hardening,
  'operate-kernel': kernelFrame,
  'operate-runbook': runbook,
  'first-login-finished': finishedServer,
}
