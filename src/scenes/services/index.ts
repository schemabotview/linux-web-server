import type { SceneModel } from '@graphlearning/graphl-flow'
import { CONSOLE_W, consoleFrame, consoleH, consoleNode, drawnRows, fold, rowOf, rowsFrom, transcript } from '../console'
import procs from '../../../sections/services/01-processes/output.txt?raw'
import signals from '../../../sections/services/02-signals/output.txt?raw'
import systemd from '../../../sections/services/03-systemd/output.txt?raw'
import enable from '../../../sections/services/04-enable-start/output.txt?raw'
import journal from '../../../sections/services/05-journal/output.txt?raw'
import boot from '../../../sections/services/06-boot/output.txt?raw'

// Course 4 — processes and services. Every console is a capture from sections/services/. PIDs are
// real but change on every run: scenes READ them from the capture, and narration never says one.
const t = transcript
const WEB01 = 'ana@web-01: ~'

// §1 — processes: the tree from PID 1.
const prT = t(procs)
const psRow = (re: RegExp) => re.exec(prT)!.slice(1)
const [bashPid, bashPpid] = psRow(/^ +(\d+) +(\d+) ana +-bash$/m)
const [masterPid] = psRow(/^ +(\d+) +1 root +nginx: master/m)
const [workerPid] = psRow(/^ +(\d+) +\d+ www-data +nginx: worker/m)
const processes = consoleFrame({
  left: { output: procs, title: WEB01, highlight: [...rowsFrom(prT, '/sbin/init'), ...rowsFrom(prT, `${masterPid}       1 root`), ...rowsFrom(prT, '/proc/1/exe -> /usr/lib/systemd/systemd')] },
  picture: [
    { type: 'group', id: 'tree', title: 'Every process has a parent — back to PID 1', sub: 'pstree, redrawn: systemd started everything else', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'p-1', title: 'systemd', sub: 'PID 1 · root — /sbin/init', icon: 'settings', stack: true, tone: 'infra' },
      { type: 'group', id: 'p-kids', bare: true, children: [
        { type: 'item', id: 'p-sshd', title: 'sshd', sub: 'the SSH server', icon: 'key' },
        { type: 'item', id: 'p-nginx', title: 'nginx master', sub: `PID ${masterPid} · root`, icon: 'nginx' },
        { type: 'item', id: 'p-journal', title: 'systemd-journald', sub: 'the log', icon: 'log' },
        { type: 'item', id: 'p-qemu', title: 'qemu-ga', sub: 'the provider’s agent — a VM', icon: 'server', tone: 'neutral' },
      ] },
      { type: 'group', id: 'p-grand', bare: true, children: [
        { type: 'item', id: 'p-bash', title: 'bash', sub: `PID ${bashPid} · ana — via sshd-session`, icon: 'terminal', tone: 'store' },
        { type: 'item', id: 'p-workers', title: '2 × nginx worker', sub: 'www-data — they answer requests', icon: 'users' },
      ] },
    ] },
    { type: 'table', id: 'ps-opts', title: 'ps, asked precisely', tone: 'ingest', fill: true, columns: ['option', 'means'], rows: [
      ['-o pid,ppid,user,cmd', 'print exactly these columns'],
      ['-p 1,$$', 'these processes: PID 1, and this shell'],
      ['-C nginx', 'every process running the command nginx'],
    ] },
    { type: 'table', id: 'ps', title: 'ps: each process names its parent (PPID)', tone: 'ingest', fill: true, columns: ['PID', 'PPID', 'USER', 'what'], rows: [
      ['1', '0', 'root', 'systemd: the kernel started it'],
      [bashPid, bashPpid, 'ana', 'ana’s shell'],
      [masterPid, '1', 'root', 'nginx master: reads config, opens ports'],
      [workerPid, masterPid, 'www-data', 'a worker: no root, serves files'],
    ] },
  ],
  edges: [
    { from: 'p-1', to: 'p-sshd' }, { from: 'p-1', to: 'p-nginx' }, { from: 'p-1', to: 'p-journal' }, { from: 'p-1', to: 'p-qemu' },
    { from: 'p-sshd', to: 'p-bash' }, { from: 'p-nginx', to: 'p-workers' },
  ],
})

// §2 — signals: TERM asks, KILL forces. The trap on KILL is set and never runs.
const sgT = t(signals)
const signalsFrame = consoleFrame({
  left: { output: signals, title: WEB01, highlight: [rowOf(sgT, 'got TERM: cleaning up', rowOf(sgT, 'kill $!')), rowOf(sgT, '[1]+  Killed')] },
  picture: [
    { type: 'group', id: 'two', dir: 'row', bare: true, children: [
      { type: 'group', id: 's-term', title: 'kill — SIGTERM, asked', sub: 'the process may catch it', icon: 'power', tone: 'store', children: [
        { type: 'item', id: 's-t1', title: 'its trap runs', sub: '“got TERM: cleaning up”', icon: 'check' },
        { type: 'item', id: 's-t2', title: 'it exits itself', sub: 'Done', icon: 'power' },
      ] },
      { type: 'group', id: 's-kill', title: 'kill -KILL — SIGKILL, forced', sub: 'the kernel removes it', icon: 'zap', tone: 'consume', children: [
        { type: 'item', id: 's-k1', title: 'its trap never runs', sub: 'no message: it cannot be caught', icon: 'zap' },
        { type: 'item', id: 's-k2', title: 'gone mid-step', sub: 'Killed — no cleanup', icon: 'power' },
      ] },
    ] },
    { type: 'table', id: 'sigs', title: 'The signals a server admin sends', tone: 'ingest', fill: true, columns: ['signal', 'number', 'means'], rows: [
      ['SIGTERM', '15', 'please stop — kill’s default; clean up first'],
      ['SIGINT', '2', 'Ctrl+C at the keyboard'],
      ['SIGHUP', '1', 'by convention, many daemons reload their config'],
      ['SIGQUIT', '3', 'to nginx: a graceful stop — its unit sends this first'],
      { cells: ['SIGKILL', '9', 'stop now — last resort, nothing is saved'], tone: 'consume' },
    ] },
    { type: 'note', id: 'order', tone: 'ingest', text: 'Always TERM first, then wait. systemd does the same when it stops a service, and sends KILL only after a timeout.' },
  ],
  edges: [{ from: 's-t1', to: 's-t2' }, { from: 's-k1', to: 's-k2' }],
})

// §3 — systemd: reading `systemctl status`, the unit file, and After= ≠ Requires=. Folded: the unit's
// comment block and the less important status lines.
const sdT = t(systemd)
const systemdFrame = consoleFrame({
  left: {
    output: systemd, title: WEB01,
    show: fold(sdT, ['Invocation:', 'Docs:'], ['Process: ', 'de=exited'], ['ExecStart=/usr/sbin/nginx -g daemon on', 'de=exited'], ['Tasks:', 'CPU:'], ['', 'Warning: some journal files', rowOf(sdT, 'Warning: some journal files') - 1],
      ['# Stop dance for nginx', 'nginx.org/en/docs/control.html'], ['Description=A high', 'Documentation='], ['Type=forking', 'PIDFile=']),
    highlight: [...rowsFrom(sdT, 'Loaded: loaded', 'bled)'), ...rowsFrom(sdT, 'Active: active (running)'), ...rowsFrom(sdT, 'WantedBy=multi-user.target'), ...rowsFrom(sdT, 'After=network-online.target')],
  },
  picture: [
    { type: 'table', id: 'status', title: 'Reading systemctl status', tone: 'ingest', fill: true, columns: ['line', 'says'], rows: [
      ['Loaded', 'the unit file it read — and enabled: it starts at boot'],
      ['Active', 'active (running), and since when'],
      ['Main PID', `${/Main PID: (\d+)/.exec(sdT)![1]}: the nginx master`],
      ['CGroup', 'every process the service owns — systemd tracks them all'],
    ] },
    { type: 'group', id: 'deps', title: 'Two separate questions', sub: 'a unit says what it needs, and separately, what must come first', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'd-wants', title: 'Wants= / Requires=', sub: 'start that too? Requires= also stops me if it fails', icon: 'boxes', stack: true },
      { type: 'item', id: 'd-after', title: 'After=', sub: 'only the ORDER: if both start, that one first', icon: 'workflow', stack: true },
      { type: 'item', id: 'd-wanted', title: 'WantedBy=', sub: 'multi-user.target: what enable links it into', icon: 'server', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'nginx-deps', title: 'systemctl show: nginx’s real dependencies', tone: 'ingest', fill: true, columns: ['property', 'includes'], rows: [
      ['Requires', 'sysinit.target, system.slice'],
      ['Wants', 'network-online.target'],
      ['After', 'network-online.target, nss-lookup.target, …'],
    ] },
  ],
})

// §4 — enable ≠ start, proved by a real reboot. Run from the laptop (the reboot ends the session).
// Folded: both login banners, and the second login's "Last login … from" (never quoted, CLAUDE.md).
const enT = t(enable)
const secondLogin = rowOf(enT, 'ana@laptop:~$ ssh ana@192.0.2.10', 2)
const enableStart = consoleFrame({
  left: {
    output: enable, title: 'ana@laptop: ~',
    show: fold(enT, ['Linux web-01', 'permitted by applicable law'], ['Linux web-01', 'Last login:', secondLogin]),
    highlight: [rowOf(enT, 'disabled'), rowOf(enT, 'active', rowOf(enT, 'disabled')), rowOf(enT, 'inactive')],
  },
  picture: [
    { type: 'table', id: 'states', title: 'Two switches, read after every step', tone: 'ingest', fill: true, columns: ['after', 'is-enabled', 'is-active'], rows: [
      ['install (Debian)', 'enabled', 'active'],
      { cells: ['systemctl disable', 'disabled', 'active — still running'], tone: 'consume' },
      { cells: ['reboot', 'disabled', 'inactive'], tone: 'consume' },
      { cells: ['systemctl enable --now', 'enabled', 'active'], tone: 'store' },
    ] },
    { type: 'group', id: 'switches', dir: 'row', bare: true, children: [
      { type: 'group', id: 'sw-enable', title: 'enable / disable', sub: 'the NEXT boot', icon: 'power', tone: 'ingest', children: [
        { type: 'item', id: 'sw-link', title: 'a symlink', sub: 'in multi-user.target.wants/', icon: 'file' },
      ] },
      { type: 'group', id: 'sw-start', title: 'start / stop', sub: 'RIGHT NOW', icon: 'zap', tone: 'ingest', children: [
        { type: 'item', id: 'sw-proc', title: 'the processes', sub: 'running, or not', icon: 'cpu' },
      ] },
    ] },
    { type: 'note', id: 'now', tone: 'store', text: 'enable --now does both. Disable alone stopped nothing, which is why the reboot was the proof.' },
  ],
})

// §5 — the journal. Folded: sshd's "Accepted password … from" (the laptop's address, never quoted).
const jnT = t(journal)
const journalFrame = consoleFrame({
  left: {
    output: journal, title: WEB01,
    show: fold(jnT, ['Accepted password for ana', '2.1 port']),
    highlight: [...rowsFrom(jnT, '-- No entries --'), ...rowsFrom(jnT, 'Reloading nginx.service', 'eb server and a reverse proxy server.', rowOf(jnT, 'Reloading nginx.service'))],
  },
  picture: [
    { type: 'group', id: 'flow', title: 'One log for the whole system', dir: 'row', tone: 'ingest', children: [
      { type: 'group', id: 'j-src', bare: true, children: [
        { type: 'item', id: 'j-kernel', title: 'the kernel', sub: 'from the first line of boot', icon: 'linux' },
        { type: 'item', id: 'j-systemd', title: 'systemd', sub: 'Starting, Started, Reloaded', icon: 'settings' },
        { type: 'item', id: 'j-svc', title: 'services', sub: 'sshd, nginx: what they print', icon: 'server' },
      ] },
      { type: 'item', id: 'j-journald', title: 'systemd-journald', sub: 'stores it, indexed by unit, boot, time', icon: 'log', stack: true, tone: 'store' },
      { type: 'item', id: 'j-ctl', title: 'journalctl', sub: 'reads it, filtered', icon: 'search', stack: true },
    ] },
    { type: 'table', id: 'flags', title: 'journalctl, filtered', tone: 'ingest', fill: true, columns: ['add', 'shows'], rows: [
      ['-u nginx', 'one unit'],
      ['-b', 'this boot only'],
      ['-n 4', 'the last 4 entries'],
      ['-f', 'new entries as they arrive, until Ctrl+C'],
      ['--no-pager', 'print it all, no less'],
    ] },
    { type: 'note', id: 'perm', tone: 'consume', text: 'Without sudo, ana sees “No entries”: the system’s log is for root and the groups adm and systemd-journal.' },
  ],
  edges: [{ from: 'j-src', to: 'j-journald' }, { from: 'j-journald', to: 'j-ctl' }],
})

// §6 ◆ Boot — a full scene (COURSE-PLAN.md, "Frames" 3): the chain from power-on to multi-user.target,
// each stage named by a line from THIS VM's boot log, with the log beside it. The console folds the
// kernel's echo of /proc/cmdline (shown just above it), the BIOS RAM map's rows, systemd's
// compile-time feature list and the bottom of `blame`. Times are an emulated VM's (NOTES.md):
// the scene says so, and narration never quotes one.
const bootT = transcript(boot)
const bootShow = fold(bootT, ['kernel: Command line:', 'consoleblank=0'], ['BIOS-e820: [mem 0x0000000000000000', '0fffff] reserved'], ['mode (+PAM', 'VE)'],
  ['10.136s cloud-init-local', 'systemd-binfmt.service'])

const bootScene: SceneModel = {
  title: 'Boot: from power-on to a login prompt',
  sub: 'web-01’s own boot, read back from its journal — a VM, so its firmware is the emulator’s',
  nodes: [
    { type: 'group', id: 'chain', dir: 'row', bare: true, children: [
      { type: 'item', id: 'b-fw', title: 'firmware', sub: 'finds the RAM: BIOS-e820', icon: 'cpu', stack: true, tone: 'neutral' },
      { type: 'item', id: 'b-grub', title: 'GRUB', sub: 'the bootloader: /boot/grub', icon: 'disk', stack: true, tone: 'source' },
      { type: 'item', id: 'b-kernel', title: 'Linux 6.12', sub: 'vmlinuz: “Linux version”', icon: 'linux', stack: true, tone: 'infra' },
      { type: 'item', id: 'b-initrd', title: 'initramfs', sub: '“Run /init”: finds the root disk', icon: 'archive', stack: true, tone: 'infra' },
      { type: 'item', id: 'b-systemd', title: 'systemd, PID 1', sub: 'the first process', icon: 'settings', stack: true, tone: 'ingest' },
      { type: 'item', id: 'b-target', title: 'multi-user.target', sub: 'services up, logins open', icon: 'server', stack: true, tone: 'store' },
    ] },
    { type: 'group', id: 'proof', dir: 'row', bare: true, children: [
      consoleNode('boot-console', {
        output: boot, title: 'ana@web-01: ~', show: bootShow,
        highlight: [...rowsFrom(bootT, 'kernel: Linux version'), ...rowsFrom(bootT, 'kernel: Run /init'), ...rowsFrom(bootT, 'systemd 257'), ...rowsFrom(bootT, 'Reached target multi-user.target')],
      }, { w: CONSOLE_W, h: consoleH(drawnRows(bootT, bootShow)) }),
      { type: 'group', id: 'files', bare: true, children: [
        { type: 'table', id: 'boot-dir', title: '/boot — each file names its kernel, 6.12.113+deb13-cloud-amd64', tone: 'infra', columns: ['file', 'stage'], rows: [
          ['grub/', 'the bootloader’s modules and menu'],
          ['vmlinuz-…', 'the kernel, compressed'],
          ['initrd.img-…', 'the initramfs'],
          ['config-…', 'the options it was built with'],
          ['System.map-…', 'its symbol addresses'],
        ] },
        { type: 'table', id: 'cmdline', title: '/proc/cmdline — what GRUB told the kernel', tone: 'source', columns: ['argument', 'means'], rows: [
          ['BOOT_IMAGE=/boot/vmlinuz-…', 'the kernel file GRUB loaded'],
          ['root=PARTUUID=84fd0772-…', 'the disk partition to mount as /'],
          ['ro', 'mount it read-only first; systemd remounts it'],
          ['console=ttyS0,115200', 'also print to the serial port — a VM’s screen'],
        ] },
        { type: 'note', id: 'times', tone: 'neutral', text: 'This VM is emulated, so every second here is slow: read the ORDER, not the times.' },
      ] },
    ] },
  ],
  edges: [
    { from: 'b-fw', to: 'b-grub', label: 'starts' }, { from: 'b-grub', to: 'b-kernel', label: 'loads' },
    { from: 'b-kernel', to: 'b-initrd', label: 'unpacks' }, { from: 'b-initrd', to: 'b-systemd', label: 'runs' },
    { from: 'b-systemd', to: 'b-target', label: 'starts' },
  ],
}

export const servicesScenes: Record<string, SceneModel> = {
  'services-processes': processes,
  'services-signals': signalsFrame,
  'services-systemd': systemdFrame,
  'services-enable-start': enableStart,
  'services-journal': journalFrame,
  'services-boot': bootScene,
}
