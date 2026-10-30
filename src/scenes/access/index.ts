import type { SceneModel } from '@graphlearning/graphl-flow'
import { CONSOLE_W, consoleFrame, consoleH, consoleNode, drawnRows, familyCard, fold, macCard, rowsFrom, transcript } from '../console'
import mac from '../../../sections/macos/capture.txt?raw'
import sudo from '../../../sections/access/01-root-sudo/debian/output.txt?raw'
import sudoRocky from '../../../sections/access/01-root-sudo/rocky/output.txt?raw'
import users from '../../../sections/access/02-users-groups/debian/output.txt?raw'
import usersRocky from '../../../sections/access/02-users-groups/rocky/output.txt?raw'
import perms from '../../../sections/access/03-permissions/output.txt?raw'
import owner from '../../../sections/access/04-ownership/output.txt?raw'
import keys from '../../../sections/access/05-ssh-keys/output.txt?raw'
import lock from '../../../sections/access/06-lock-ssh/output.txt?raw'
import lockSecond from '../../../sections/access/06-lock-ssh/second.txt?raw'
import lockRocky from '../../../sections/access/06-lock-ssh/rocky/output.txt?raw'

// Course 2 — users, sudo and permissions. Every console is a capture from sections/access/ (real
// output from web-01, web-02 or the laptop); every value in a picture is in that capture.
const t = transcript
const WEB01 = 'ana@web-01: ~'
const LAPTOP = 'ana@laptop: ~'

// §1 — root, ana and sudo: one door to root, and every use of it logged.
const rootSudo = consoleFrame({
  left: { output: sudo, title: WEB01, highlight: [...rowsFrom(t(sudo), 'groups='), ...rowsFrom(t(sudo), '(ALL : ALL) ALL')] },
  picture: [
    { type: 'group', id: 'door', title: 'One door to root', sub: 'ana never logs in as root: she asks, per command', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'ana', title: 'ana · uid 1000', sub: 'groups: ana, sudo (27)', icon: 'user', stack: true },
      { type: 'item', id: 'sudo', title: 'sudo', sub: 'checks the group, asks ana’s own password', icon: 'shield', stack: true },
      { type: 'item', id: 'root', title: 'root · uid 0', sub: 'reads /etc/shadow', icon: 'admin', stack: true, tone: 'consume' },
    ] },
    { type: 'table', id: 'log', title: 'Every sudo is in the journal', tone: 'ingest', fill: true, columns: ['who', 'as', 'command'], rows: [
      ['ana', 'root', '/usr/bin/head -n 1 /etc/shadow'],
      ['ana', 'root', '/usr/bin/whoami'],
      ['ana', 'root', '/usr/bin/journalctl -q --no-pager …'],
    ] },
    familyCard('rocky', 'rocky', { output: sudoRocky, title: '[ana@web-02 ~]', highlight: [...rowsFrom(t(sudoRocky), 'groups='), ...rowsFrom(t(sudoRocky), '%wheel')] }),
  ],
  edges: [{ from: 'ana', to: 'sudo' }, { from: 'sudo', to: 'root' }],
})

// §2 — users and groups: a user is a line in /etc/passwd; Rocky's useradd beside Debian's adduser.
const usersGroups = consoleFrame({
  left: { output: users, title: WEB01, highlight: rowsFrom(t(users), 'deploy:x:1001') },
  picture: [
    { type: 'table', id: 'passwd', title: '/etc/passwd — one line per user, seven fields', tone: 'ingest', fill: true, columns: ['field', 'deploy', 'what it is'], rows: [
      ['name', 'deploy', 'the login name'],
      ['password', 'x', 'kept in /etc/shadow, readable by root only'],
      ['UID', '1001', 'the number the kernel checks — not the name'],
      ['GID', '1001', 'the primary group, also called deploy'],
      ['comment', 'Site deploys', 'free text: --comment'],
      ['home', '/home/deploy', 'drwx------: private to deploy'],
      ['shell', '/bin/bash', 'what a login runs'],
    ] },
    familyCard('rocky', 'rocky', { output: usersRocky, title: '[ana@web-02 ~]', highlight: rowsFrom(t(usersRocky), 'uid=1001') }, [
      { type: 'table', id: 'diff', fill: true, columns: ['', 'Debian · web-01', 'Rocky · web-02'], rows: [
        ['add a user', 'adduser (a script)', 'useradd'],
        ['extra group', '100(users)', 'none'],
        ['ls -l mode', 'drwx------', 'drwx------. (SELinux label)'],
      ] },
    ]),
  ],
})

// §3 — permissions: the kernel's check, with ana falling through to "other" on every path.
const permissions = consoleFrame({
  left: { output: perms, title: WEB01, highlight: [...rowsFrom(t(perms), 'cat: /etc/shadow'), ...rowsFrom(t(perms), '-bash: /etc/hostname'), ...rowsFrom(t(perms), "cannot open directory '/root'")] },
  picture: [
    { type: 'group', id: 'check', title: 'The kernel’s check', sub: 'the first class that matches decides; the others are never read', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'c-owner', title: 'owner?', sub: 'ana is uid 1000, the owner is root', icon: 'user', stack: true, tone: 'neutral' },
      { type: 'item', id: 'c-group', title: 'group?', sub: 'ana is not in root or shadow', icon: 'users', stack: true, tone: 'neutral' },
      { type: 'item', id: 'c-other', title: 'other', sub: 'these three bits decide', icon: 'lock', stack: true },
    ] },
    { type: 'table', id: 'anatomy', title: 'One line of ls -l, taken apart', tone: 'ingest', fill: true, columns: ['part', '/etc/shadow', 'means'], rows: [
      ['type', '-', 'a regular file (d: a directory)'],
      ['owner bits', 'rw-', 'root reads and writes'],
      ['group bits', 'r--', 'members of shadow read'],
      ['other bits', '---', 'everyone else: nothing'],
      ['owner · group', 'root · shadow', 'who “owner” and “group” are'],
      ['size', '800', 'bytes'],
    ] },
    { type: 'table', id: 'files', title: 'What ana gets — always as “other”', tone: 'ingest', fill: true, columns: ['path', 'mode', 'other', 'ana may'], rows: [
      { cells: ['/etc/hostname', '-rw-r--r--', 'r--', 'read, not write'], tone: 'store' },
      { cells: ['/etc/shadow', '-rw-r-----', '---', 'nothing'], tone: 'consume' },
      { cells: ['/etc', 'drwxr-xr-x', 'r-x', 'list and enter'], tone: 'store' },
      { cells: ['/root', 'drwx------', '---', 'not even list'], tone: 'consume' },
    ] },
    { type: 'note', id: 'dirs', tone: 'ingest', text: 'On a directory, r lists the names, x lets you pass through, and w creates and removes names.' },
  ],
  edges: [{ from: 'c-owner', to: 'c-group', label: 'no' }, { from: 'c-group', to: 'c-other', label: 'no' }],
})

// §4 — chown, chmod, umask: the web root belongs to deploy.
const ownership = consoleFrame({
  left: { output: owner, title: WEB01, highlight: [...rowsFrom(t(owner), 'drwxr-xr-x 2 deploy'), ...rowsFrom(t(owner), "touch: cannot touch")] },
  picture: [
    { type: 'group', id: 'root', title: '/var/www/ana.example', sub: 'after chown deploy:deploy', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'o-deploy', title: 'deploy', sub: 'owner: rwx — writes the site', icon: 'user', stack: true, tone: 'store' },
      { type: 'item', id: 'o-dir', title: 'the web root', sub: 'drwxr-xr-x deploy deploy', icon: 'folder', stack: true },
      { type: 'item', id: 'o-ana', title: 'ana', sub: 'other: r-x — reads, cannot create', icon: 'user', stack: true, tone: 'consume' },
    ] },
    { type: 'table', id: 'steps', title: 'The web root, step by step', tone: 'ingest', fill: true, columns: ['after', 'ls -l shows', 'so'], rows: [
      ['sudo mkdir', 'drwxr-xr-x root root', 'root’s directory'],
      ['sudo chown deploy:deploy', 'drwxr-xr-x deploy deploy', 'deploy’s now'],
      ['deploy writes index.html', '-rw-rw-r-- deploy deploy', 'the umask’s 664'],
      { cells: ['sudo chmod 640', '-rw-r----- deploy deploy', 'ana: Permission denied'], tone: 'consume' },
      { cells: ['sudo chmod 644', '-rw-r--r-- deploy deploy', 'ana reads it again'], tone: 'store' },
    ] },
    { type: 'table', id: 'umask', title: 'umask 0002: the bits a new file does NOT get', tone: 'ingest', fill: true, columns: ['', 'octal', 'bits'], rows: [
      ['a new file asks for', '666', 'rw-rw-rw-'],
      ['umask takes away', '002', '-------w-'],
      { cells: ['index.html got', '664', 'rw-rw-r--'], tone: 'store' },
    ] },
    { type: 'table', id: 'octal', title: 'chmod in octal: r = 4, w = 2, x = 1', tone: 'ingest', fill: true, columns: ['chmod', 'owner', 'group', 'other', 'ana can cat it'], rows: [
      { cells: ['640', 'rw-', 'r--', '---', 'no'], tone: 'consume' },
      { cells: ['644', 'rw-', 'r--', 'r--', 'yes'], tone: 'store' },
    ] },
  ],
  edges: [{ from: 'o-deploy', to: 'o-dir', label: 'owns' }, { from: 'o-ana', to: 'o-dir' }],
})

// §5 — SSH keys from the laptop. 69 rows fold to the console's 43: the randomart, ssh-copy-id's
// INFO lines and summary, and web-01's login banner.
const keysT = t(keys)
const sshKeys = consoleFrame({
  left: {
    output: keys, title: LAPTOP,
    show: fold(keysT, ['+--[ED25519 256]--+', '+----[SHA256]-----+'], ['INFO: Source of key', '_ed25519.pub"'], ['INFO: attempting', 'ed now it is to install'],
      ['Number of key(s) added', 'check to make sure'], ['Linux web-01', 'permitted by applicable law'], ['logout', 'Connection to 192.0.2.10 closed']),
    highlight: [...rowsFrom(keysT, 'Your identification', 'Your public key'), ...rowsFrom(keysT, 'ana@laptop:~$ ssh ana@192.0.2.10')],
  },
  picture: [
    { type: 'group', id: 'pair', dir: 'row', bare: true, children: [
      { type: 'group', id: 'laptop', title: 'laptop', sub: 'ssh-keygen -t ed25519', icon: 'laptop', tone: 'ingest', children: [
        { type: 'item', id: 'k-priv', title: 'id_ed25519', sub: 'private · -rw------- · never leaves', icon: 'key', tone: 'consume' },
        { type: 'item', id: 'k-pub', title: 'id_ed25519.pub', sub: 'public · safe to copy anywhere', icon: 'file' },
      ] },
      { type: 'group', id: 'web01', title: 'web-01', sub: '/home/ana/.ssh', icon: 'debian', tone: 'store', children: [
        { type: 'item', id: 'k-auth', title: 'authorized_keys', sub: '-rw------- inside drwx------', icon: 'lock' },
      ] },
    ] },
    { type: 'table', id: 'proof', title: 'How web-01 knows it is ana — without a password', tone: 'ingest', fill: true, columns: ['', 'laptop', 'web-01'], rows: [
      ['1', 'offers the public key', 'finds it in authorized_keys'],
      ['2', 'signs this session’s data with the private key', ''],
      ['3', '', 'checks the signature with the public key'],
      { cells: ['4', 'a shell on web-01', 'logs ana in'], tone: 'store' },
    ] },
    { type: 'table', id: 'login', title: 'ssh ana@192.0.2.10', tone: 'ingest', fill: true, columns: ['', 'before', 'after'], rows: [
      ['the server asks for', 'ana’s password', 'proof she holds the private key'],
      ['what crosses the network', 'the password', 'a signature — never the key'],
    ] },
    macCard('mac', mac, ['ssh -V', 'command -v ssh-copy-id rsync brew'], [], ['OpenSSH_10.3p1', '/usr/bin/ssh-copy-id']),
  ],
  edges: [{ from: 'k-pub', to: 'k-auth', label: 'ssh-copy-id' }],
})

// §6 — lock SSH down, tested from a second terminal before the first is closed. The second window's
// "Last login … from" row is folded: a server sees the laptop as the VM network's address (CLAUDE.md).
const secondT = t(lockSecond)
const secondShow = fold(secondT, ['Linux web-01', 'Last login:'])
const lockSsh = consoleFrame({
  left: { output: lock, title: `${LAPTOP} — first terminal`, highlight: [...rowsFrom(t(lock), 'sudo sshd -t'), ...rowsFrom(t(lock), 'permitrootlogin no', 'passwordauthentication no')] },
  picture: [
    { type: 'group', id: 'second', title: 'A second terminal, before closing the first', sub: 'the first stays logged in: if the test fails, it can still undo the change', tone: 'store', children: [
      consoleNode('second-console', { output: lockSecond, title: `${LAPTOP} — second terminal`, show: secondShow, highlight: rowsFrom(secondT, 'Permission denied (publickey)') },
        { w: CONSOLE_W, h: consoleH(drawnRows(secondT, secondShow)) }),
    ] },
    { type: 'table', id: 'effective', title: 'sshd -T: what sshd will do, every file read', tone: 'ingest', fill: true, columns: ['setting', 'before', 'after'], rows: [
      ['permitrootlogin', 'without-password', 'no'],
      ['passwordauthentication', 'yes', 'no'],
    ] },
    familyCard('rocky', 'rocky', { output: lockRocky, title: '[ana@web-02 ~]', highlight: rowsFrom(t(lockRocky), 'systemctl is-active sshd') }),
  ],
})

export const accessScenes: Record<string, SceneModel> = {
  'access-root-sudo': rootSudo,
  'access-users-groups': usersGroups,
  'access-permissions': permissions,
  'access-ownership': ownership,
  'access-ssh-keys': sshKeys,
  'access-lock-ssh': lockSsh,
}
