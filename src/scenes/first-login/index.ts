import type { SceneModel } from '@graphlearning/graphl-flow'
import { CONSOLE_W, consoleFrame, consoleH, consoleNode, drawnRows, macCard, rowOf, rowsFrom, transcript, ttyNode } from '../console'
import mac from '../../../sections/macos/capture.txt?raw'
import famDebian from '../../../sections/first-login/02-families/debian/output.txt?raw'
import famRocky from '../../../sections/first-login/02-families/rocky/output.txt?raw'
import ssh from '../../../sections/first-login/03-ssh/output.txt?raw'
import commands from '../../../sections/first-login/04-commands/output.txt?raw'
import manLs from '../../../sections/first-login/04-commands/man-ls.tty.json'
import tree from '../../../sections/first-login/05-tree/output.txt?raw'
import moving from '../../../sections/first-login/06-moving-around/output.txt?raw'
import reading from '../../../sections/first-login/07-reading-files/output.txt?raw'
import lessSshd from '../../../sections/first-login/07-reading-files/less-sshd_config.tty.json'

// Course 1 — log in and look around. Every console is a capture from sections/first-login/; §1 (the
// finished server, on the server map) is authored last, with Course 7.
const t = transcript
const WEB01 = 'ana@web-01: ~'

// §2 ◆ Linux, its families, and macOS — a full scene: one kernel, two families, and where macOS sits,
// with both servers' real `uname` and `os-release` under it.
const debT = t(famDebian), rockyT = t(famRocky)
const families: SceneModel = {
  title: 'One kernel, many distributions',
  sub: 'a distribution is the Linux kernel plus everything around it: packages, defaults, tools',
  nodes: [
    { type: 'item', id: 'f-kernel', title: 'Linux, the kernel', sub: 'processes, memory, files, network — the same code in every distribution', icon: 'linux', tone: 'infra' },
    { type: 'group', id: 'fams', dir: 'row', bare: true, children: [
      { type: 'group', id: 'f-deb', title: 'Debian family', sub: 'apt and .deb packages', icon: 'debian', tone: 'consume', dir: 'row', children: [
        { type: 'item', id: 'f-debian', title: 'Debian', sub: 'web-01', icon: 'debian', stack: true },
        { type: 'item', id: 'f-ubuntu', title: 'Ubuntu', sub: 'built from Debian', icon: 'ubuntu', stack: true },
      ] },
      { type: 'group', id: 'f-rh', title: 'Red Hat family', sub: 'dnf and .rpm packages', icon: 'redhat', tone: 'serve', dir: 'row', children: [
        { type: 'item', id: 'f-fedora', title: 'Fedora', sub: 'where it starts', icon: 'fedora', stack: true },
        { type: 'item', id: 'f-rhel', title: 'RHEL', sub: 'the commercial one', icon: 'redhat', stack: true },
        { type: 'item', id: 'f-rocky', title: 'Rocky Linux', sub: 'web-02 · a RHEL rebuild', icon: 'rocky', stack: true },
        { type: 'item', id: 'f-alma', title: 'AlmaLinux', sub: 'another rebuild', icon: 'almalinux', stack: true },
      ] },
      { type: 'group', id: 'f-other', title: 'and others', sub: 'their own packages', icon: 'linux', tone: 'neutral', children: [
        { type: 'item', id: 'f-arch', title: 'Arch', icon: 'arch', chip: true },
        { type: 'item', id: 'f-suse', title: 'SUSE', chip: true },
      ] },
      { type: 'group', id: 'f-notlinux', title: 'Not Linux', sub: 'Unix-like, its own kernel', icon: 'apple', tone: 'neutral', dashed: true, children: [
        { type: 'item', id: 'f-mac', title: 'macOS', sub: 'Darwin 25 · zsh and BSD tools', icon: 'apple' },
      ] },
    ] },
    { type: 'group', id: 'proof', dir: 'row', bare: true, children: [
      { type: 'group', id: 'left', bare: true, children: [
        consoleNode('deb-console', { output: famDebian, title: WEB01, highlight: [...rowsFrom(debT, 'Linux 6.12'), ...rowsFrom(debT, 'PRETTY_NAME')] },
          { w: CONSOLE_W, h: consoleH(drawnRows(debT)) }),
        macCard('mac', mac, ['uname -sr', 'ls /proc', 'cat /etc/os-release'], [], ['Darwin 25.6.0', 'ls: /proc: No such file']),
      ] },
      consoleNode('rocky-console', { output: famRocky, title: '[ana@web-02 ~]', highlight: [...rowsFrom(rockyT, 'Linux 6.12'), ...rowsFrom(rockyT, 'ID_LIKE'), ...rowsFrom(rockyT, 'PRETTY_NAME')] },
        { w: CONSOLE_W, h: consoleH(drawnRows(rockyT)) }),
    ] },
  ],
  edges: [{ from: 'f-kernel', to: 'f-deb' }, { from: 'f-kernel', to: 'f-rh' }, { from: 'f-fedora', to: 'f-rhel' }, { from: 'f-rhel', to: 'f-rocky' }, { from: 'f-debian', to: 'f-ubuntu' }],
}

// §3 — SSH in: the host key's first meeting, the password, and the prompt read part by part.
const sshT = t(ssh)
const sshIn = consoleFrame({
  left: { output: ssh, title: 'ana@laptop: ~', highlight: [...rowsFrom(sshT, 'ED25519 key fingerprint'), ...rowsFrom(sshT, 'ana@web-01:~$ whoami')] },
  picture: [
    { type: 'group', id: 'conn', dir: 'row', bare: true, children: [
      { type: 'item', id: 's-laptop', title: 'ssh', sub: 'on Ana’s laptop', icon: 'laptop', stack: true },
      { type: 'item', id: 's-sshd', title: 'sshd', sub: 'web-01’s SSH server, port 22', icon: 'key', stack: true, tone: 'store' },
      { type: 'item', id: 's-bash', title: 'bash', sub: 'a shell, running as ana', icon: 'terminal', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'hostkey', title: 'The first connection', tone: 'ingest', fill: true, columns: ['ssh says', 'which means'], rows: [
      ['authenticity … can’t be established', 'the laptop has never met this server'],
      ['ED25519 key fingerprint is SHA256:…', 'the server’s own key: compare it with the provider’s'],
      ['Permanently added … to known hosts', 'saved: next time it is checked, silently'],
      ['ana@192.0.2.10’s password:', 'the provider’s password, never echoed'],
    ] },
    { type: 'table', id: 'prompt', title: 'Reading the prompt: ana@web-01:~$', tone: 'ingest', fill: true, columns: ['part', 'means'], rows: [
      ['ana', 'who you are — whoami'],
      ['web-01', 'which machine — hostname'],
      ['~', 'where you are: your home, /home/ana'],
      ['$', 'an ordinary user; root’s prompt ends in #'],
    ] },
  ],
  edges: [{ from: 's-laptop', to: 's-sshd', label: 'encrypted' }, { from: 's-sshd', to: 's-bash', label: 'starts' }],
})

// §4 — commands, options, arguments, and the manual. The man page is a slice of the real screen.
const cmdT = t(commands)
const commandLine = consoleFrame({
  left: { output: commands, title: WEB01, highlight: rowsFrom(cmdT, 'ls -l --human-readable /var/log') },
  picture: [
    { type: 'group', id: 'parts', title: 'ls -l --human-readable /var/log', sub: 'a command line is words separated by spaces', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'p-cmd', title: 'ls', sub: 'the command: a program, /usr/bin/ls', icon: 'terminal', stack: true },
      { type: 'item', id: 'p-short', title: '-l', sub: 'a short option: one dash, one letter', icon: 'settings', stack: true },
      { type: 'item', id: 'p-long', title: '--human-readable', sub: 'a long option: two dashes, a word (-h)', icon: 'settings', stack: true },
      { type: 'item', id: 'p-arg', title: '/var/log', sub: 'an argument: what to work on', icon: 'folder', stack: true, tone: 'store' },
    ] },
    { type: 'group', id: 'man', title: 'man ls — the manual, in a pager', sub: 'q quits; LS(1) is section 1, user commands', tone: 'ingest', children: [
      ttyNode('man-ls', manLs, 'man ls', [0, 18]),
    ] },
    { type: 'table', id: 'sections', title: 'Manual sections a server admin meets', tone: 'ingest', fill: true, columns: ['section', 'holds', 'e.g.'], rows: [
      ['1', 'user commands', 'ls(1)'],
      ['5', 'file formats', 'sshd_config(5)'],
      ['8', 'administration commands', 'sshd(8)'],
    ] },
  ],
})

// §5 ◆ The directory tree — a full scene: what lives where, beside the real listings.
const treeT = t(tree)
const directoryTree: SceneModel = {
  title: 'One tree, starting at /',
  sub: 'no drive letters: every disk, device and even the kernel’s view is a directory somewhere under /',
  nodes: [
    { type: 'group', id: 'row', dir: 'row', bare: true, children: [
      { type: 'tree', id: 'fs', title: '/', entries: [
        { name: 'etc', folder: true, note: 'configuration — text files, edited by root', state: 'active', children: [{ name: 'ssh', folder: true }, { name: 'hostname' }] },
        { name: 'var', folder: true, note: 'data that changes: logs, caches — and, later, the site', state: 'active', children: [{ name: 'log', folder: true }, { name: 'www', folder: true, state: 'muted', note: 'not yet' }] },
        { name: 'home', folder: true, note: 'one directory per user', state: 'active', children: [{ name: 'ana', folder: true }] },
        { name: 'root', folder: true, note: 'root’s own home, not /' },
        { name: 'usr', folder: true, note: 'installed programs and their files', children: [{ name: 'bin', folder: true }, { name: 'share', folder: true }] },
        { name: 'boot', folder: true, note: 'the kernel and the bootloader' },
        { name: 'proc', folder: true, note: 'not on disk: the kernel, as files', state: 'active' },
        { name: 'dev', folder: true, note: 'devices: disks, terminals' },
        { name: 'tmp', folder: true, note: 'scratch space, emptied on reboot' },
        { name: 'bin', note: '→ usr/bin: a link, kept for old paths' },
      ] },
      consoleNode('tree-console', { output: tree, title: WEB01, highlight: [...rowsFrom(treeT, 'ana@web-01:~$ ls /proc')] },
        { w: CONSOLE_W, h: consoleH(drawnRows(treeT)) }),
    ] },
  ],
  edges: [],
}

// §6 — moving around: absolute and relative paths, `..`, `cd` alone; `ls -l` read column by column.
const movT = t(moving)
const movingAround = consoleFrame({
  left: { output: moving, title: WEB01, highlight: rowsFrom(movT, 'os-release -> ../usr/lib/os-release') },
  picture: [
    { type: 'group', id: 'walk', title: 'Where cd took ana', sub: 'pwd prints the current directory, always as a full path from /', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'w-home', title: '/home/ana', sub: 'where a login starts — ~', icon: 'folder', stack: true, tone: 'store' },
      { type: 'item', id: 'w-etc', title: '/etc', sub: 'cd /etc — absolute: from /', icon: 'folder', stack: true },
      { type: 'item', id: 'w-root', title: '/', sub: 'cd .. — relative: one up', icon: 'folder', stack: true },
    ] },
    { type: 'table', id: 'paths', title: 'Paths and their shortcuts', tone: 'ingest', fill: true, columns: ['write', 'means', 'from /etc, reaches'], rows: [
      ['/etc/hosts', 'absolute: starts at /', '/etc/hosts — from anywhere'],
      ['hosts', 'relative: starts here', '/etc/hosts'],
      ['..', 'the parent directory', '/'],
      ['~', 'your home directory', '/home/ana'],
      ['cd (alone)', 'go home', '/home/ana'],
    ] },
    { type: 'table', id: 'cols', title: 'ls -l, column by column', tone: 'ingest', fill: true, columns: ['column', 'os-release', 'means'], rows: [
      ['type + mode', 'lrwxrwxrwx', 'l: a symbolic link; its own bits are not used'],
      ['links', '1', 'how many names this file has'],
      ['owner, group', 'root root', 'who the permissions are about'],
      ['size', '21', 'bytes — a link’s size is its target’s path'],
      ['modified', 'Jul 17 17:05', 'the last change to its contents'],
      ['name', 'os-release -> ../usr/lib/os-release', 'a link shows where it points'],
    ] },
  ],
  edges: [{ from: 'w-home', to: 'w-etc', label: 'cd /etc' }, { from: 'w-etc', to: 'w-root', label: 'cd ..' }],
})

// §7 — reading files, and everything is a file: cat, less, tail; the shell itself under /proc. The
// PID is read from the capture (it changes on every run; narration never says it).
const readT = t(reading)
const pid = /echo \$\$\n(\d+)/.exec(readT)![1]
const readingFiles = consoleFrame({
  left: { output: reading, title: WEB01, highlight: [rowOf(readT, 'ClientAliveInterval'), ...rowsFrom(readT, `/proc/${pid}/cwd -> /home/ana`)] },
  picture: [
    { type: 'group', id: 'less', title: 'less — a file, one screen at a time', sub: 'space pages down, / searches, q quits', tone: 'ingest', children: [
      ttyNode('less-sshd', lessSshd, 'less /etc/ssh/sshd_config', [0, 17]),
    ] },
    { type: 'table', id: 'readers', title: 'Three ways to read a file', tone: 'ingest', fill: true, columns: ['command', 'shows', 'for'], rows: [
      ['cat', 'all of it, at once', 'short files: /etc/hostname'],
      ['less', 'a screen at a time', 'long files: sshd_config'],
      ['tail -n 5', 'the last 5 lines', 'logs, which grow at the end'],
    ] },
    { type: 'group', id: 'proc', title: `/proc/${pid} — ana’s shell, as files`, sub: '$$ is the shell’s own process ID', dir: 'row', tone: 'infra', children: [
      { type: 'item', id: 'pr-comm', title: 'comm', sub: 'its name: bash', icon: 'file', stack: true },
      { type: 'item', id: 'pr-shell', title: `process ${pid}`, sub: 'the bash ana is typing into', icon: 'cpu', stack: true },
      { type: 'item', id: 'pr-cwd', title: 'cwd', sub: 'a link to where it is: /home/ana', icon: 'folder', stack: true },
    ] },
  ],
  edges: [{ from: 'pr-shell', to: 'pr-comm' }, { from: 'pr-shell', to: 'pr-cwd' }],
})

export const firstLoginScenes: Record<string, SceneModel> = {
  'first-login-families': families,
  'first-login-ssh': sshIn,
  'first-login-commands': commandLine,
  'first-login-tree': directoryTree,
  'first-login-moving-around': movingAround,
  'first-login-reading-files': readingFiles,
}
