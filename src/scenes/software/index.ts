import type { SceneModel } from '@graphlearning/graphl-flow'
import { consoleFrame, familyCard, fold, rowOf, rowsFrom, transcript } from '../console'
import packages from '../../../sections/software/01-packages/output.txt?raw'
import upgrade from '../../../sections/software/02-update-upgrade/output.txt?raw'
import install from '../../../sections/software/03-install-nginx/output.txt?raw'
import rocky from '../../../sections/software/04-rocky-nginx/output.txt?raw'
import auto from '../../../sections/software/05-auto-updates/debian/output.txt?raw'
import autoRocky from '../../../sections/software/05-auto-updates/rocky/output.txt?raw'

// Course 3 — install software. Every console is a capture from sections/software/.
const t = transcript
const WEB01 = 'ana@web-01: ~'
const WEB02 = '[ana@web-02 ~]'

// §1 — packages, sources, signatures. Folded: the older releases' keyrings, and the index downloads
// after the four signed InRelease files.
const pkgT = t(packages)
const sources = consoleFrame({
  left: {
    output: packages, title: WEB01,
    show: fold(pkgT, ['debian-archive-bookworm-automatic.gpg', 'debian-archive-bullseye-stable.pgp'], ['Get:7 ', 'n [167 kB]']),
    highlight: [...rowsFrom(pkgT, 'Signed-By:'), ...rowsFrom(pkgT, 'trixie InRelease'), rowOf(pkgT, 'debian-archive-keyring.gpg', rowOf(pkgT, 'ls /usr/share/keyrings'))],
  },
  picture: [
    { type: 'group', id: 'chain', title: 'Where a package comes from', sub: 'nothing is installed from a file that the keyring cannot vouch for', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'c-repo', title: 'the repository', sub: 'deb.debian.org — trixie, trixie-security', icon: 'globe', stack: true, tone: 'source' },
      { type: 'item', id: 'c-index', title: 'InRelease', sub: 'the signed index: every list’s checksum', icon: 'cert', stack: true },
      { type: 'item', id: 'c-lists', title: '/var/lib/apt/lists', sub: 'the package lists, kept on web-01', icon: 'database', stack: true },
      { type: 'item', id: 'c-pkg', title: 'a .deb', sub: 'checked against its list, then unpacked', icon: 'package', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'fetched', title: 'What apt update fetched, per suite', tone: 'ingest', fill: true, columns: ['file', 'is'], rows: [
      ['InRelease', 'the signed index — checked first'],
      ['Packages', 'every binary package: name, version, checksum'],
      ['Sources', 'the same for source code (deb-src)'],
      ['Translation-en', 'the descriptions apt shows'],
    ] },
    { type: 'table', id: 'fields', title: 'debian.sources — one block per source', tone: 'ingest', fill: true, columns: ['field', 'here', 'means'], rows: [
      ['Types', 'deb deb-src', 'binary packages, and their source code'],
      ['URIs', 'mirror+file:…', 'a list of mirrors; deb.debian.org answered'],
      ['Suites', 'trixie trixie-updates …', 'Debian 13, its point updates, newer backports'],
      ['', 'trixie-security', 'security fixes, from their own archive'],
      ['Components', 'main', 'free software only'],
      { cells: ['Signed-By', 'debian-archive-keyring.gpg', 'the only keys this source may be signed with'], tone: 'store' },
    ] },
  ],
  edges: [{ from: 'c-repo', to: 'c-index', label: 'apt update' }, { from: 'c-index', to: 'c-lists', label: 'verified' }, { from: 'c-lists', to: 'c-pkg' }],
})

// §2 — update ≠ upgrade. The pinned image was current when captured: nothing to upgrade (NOTES.md).
// The frame says so rather than staging a list.
const upT = t(upgrade)
const updateUpgrade = consoleFrame({
  left: { output: upgrade, title: WEB01, show: fold(upT, ['Get:7 ', 'n [167 kB]']), highlight: [...rowsFrom(upT, 'All packages are up to date'), ...rowsFrom(upT, 'Upgrading: 0')] },
  picture: [
    { type: 'group', id: 'two', dir: 'row', bare: true, children: [
      { type: 'group', id: 'u-update', title: 'apt update', sub: 'refreshes what apt KNOWS', icon: 'database', tone: 'ingest', children: [
        { type: 'item', id: 'u-index', title: 'the package lists', sub: 'which versions exist, today', icon: 'file' },
        { type: 'item', id: 'u-nothing', title: 'installs nothing', sub: 'no program on web-01 changes', icon: 'check', tone: 'neutral' },
      ] },
      { type: 'group', id: 'u-upgrade', title: 'apt upgrade', sub: 'changes what is INSTALLED', icon: 'package', tone: 'store', children: [
        { type: 'item', id: 'u-compare', title: 'installed vs listed', sub: 'every package with a newer version', icon: 'search' },
        { type: 'item', id: 'u-replace', title: 'replaced', sub: 'downloaded, unpacked, configured', icon: 'package' },
      ] },
    ] },
    { type: 'table', id: 'order', title: 'Always in this order', tone: 'ingest', fill: true, columns: ['step', 'command', 'without it'], rows: [
      ['1', 'sudo apt update', 'upgrade compares against old lists and finds nothing'],
      ['2', 'apt list --upgradable', 'you upgrade blind'],
      ['3', 'sudo apt upgrade', 'the server keeps its old, unpatched versions'],
    ] },
    { type: 'table', id: 'writes', title: 'What each one writes', tone: 'ingest', fill: true, columns: ['command', 'writes'], rows: [
      ['apt update', '/var/lib/apt/lists — the lists, nothing else'],
      ['apt upgrade', 'the packages’ own files, and a record in /var/log/apt/history.log'],
    ] },
    { type: 'note', id: 'zero', tone: 'neutral', text: 'Upgrading: 0 is the real answer: this image was current on the day it was captured. A server that has run for a few weeks lists packages here.' },
  ],
  edges: [{ from: 'u-index', to: 'u-compare', label: 'read by' }],
})

// §3 — install nginx: what it put where. Folded: the suggested packages and the download and unpack
// lines, the remaining setup lines, and nginx's documentation files.
const insT = t(install)
const installNginx = consoleFrame({
  left: {
    output: install, title: WEB01,
    show: fold(insT, ['Suggested packages:', 'Setting up nginx-common'], ['Setting up nginx (', 'Processing triggers'], ['/usr/share/doc', '/usr/share/doc/nginx/copyright']),
    highlight: [...rowsFrom(insT, 'Created symlink', 'usr/lib/systemd/system/nginx.service'), rowOf(insT, '/usr/sbin/nginx'), ...rowsFrom(insT, 'nginx-common: /etc/nginx/nginx.conf'), ...rowsFrom(insT, 'HTTP/1.1 200 OK')],
  },
  picture: [
    { type: 'group', id: 'pkgs', title: 'apt install -y nginx', sub: 'one request, two packages: apt pulled in the dependency', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'i-nginx', title: 'nginx', sub: 'the program', icon: 'nginx', stack: true },
      { type: 'item', id: 'i-common', title: 'nginx-common', sub: 'its configuration and service unit', icon: 'package', stack: true },
    ] },
    { type: 'table', id: 'where', title: 'What it put where', tone: 'ingest', fill: true, columns: ['path', 'what', 'package'], rows: [
      ['/usr/sbin/nginx', 'the program', 'nginx'],
      ['/etc/nginx/', 'configuration: nginx.conf, sites-…', 'nginx-common'],
      ['/usr/lib/systemd/system/nginx.service', 'the unit: how systemd runs it', 'nginx-common'],
      ['/var/log/nginx/', 'access.log and error.log', ''],
      ['/var/www/html/', 'a default page', ''],
    ] },
    { type: 'table', id: 'running', title: 'And on Debian, it is already running', tone: 'store', fill: true, columns: ['asked', 'answer'], rows: [
      ['systemctl is-active nginx', 'active'],
      ['curl -sI http://localhost', '200 OK, Server: nginx'],
    ] },
  ],
  edges: [{ from: 'i-nginx', to: 'i-common', label: 'depends on' }],
})

// §4 — the same install on Rocky Linux (web-02). Folded: repository metadata, and dnf's download and
// transaction lines.
const rkT = t(rocky)
const rockyNginx = consoleFrame({
  left: {
    output: rocky, title: WEB02,
    show: fold(rkT, ['Rocky Linux 10 - BaseOS', 'Rocky Linux 10 - Extras'], ['Downloading Packages:', 'Complete!']),
    highlight: [...rowsFrom(rkT, 'inactive'), ...rowsFrom(rkT, 'sudo systemctl enable --now nginx')],
  },
  picture: [
    { type: 'table', id: 'compare', title: 'One nginx, two families', tone: 'ingest', fill: true, columns: ['', 'Debian · web-01', 'Rocky · web-02'], rows: [
      ['install', 'apt install nginx', 'dnf install nginx'],
      ['packages', 'nginx, nginx-common', 'nginx, nginx-core, nginx-filesystem, rocky-logos-httpd'],
      ['who owns nginx.conf', 'dpkg -S → nginx-common', 'rpm -qf → nginx-core'],
      ['site config', 'sites-available/ + sites-enabled/', 'conf.d/ (and default.d/)'],
      ['default page', '/var/www/html', '/usr/share/nginx/html'],
      { cells: ['after install', 'active: started for you', 'inactive: enable --now'], tone: 'consume' },
      ['Server: header', 'nginx', 'nginx/1.26.3'],
    ] },
    { type: 'table', id: 'verbs', title: 'The same questions, asked of each', tone: 'ingest', fill: true, columns: ['question', 'Debian', 'Red Hat'], rows: [
      ['which package owns this file?', 'dpkg -S', 'rpm -qf'],
      ['which files did it install?', 'dpkg -L', 'rpm -ql'],
      ['refresh the lists', 'apt update', 'dnf refreshes them itself'],
    ] },
    { type: 'group', id: 'policy', title: 'Two policies for a new service', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'p-deb', title: 'Debian', sub: 'install means: run it, now and at boot', icon: 'debian', stack: true },
      { type: 'item', id: 'p-rh', title: 'Red Hat', sub: 'nothing listens until an admin says so', icon: 'rocky', stack: true },
    ] },
  ],
})

// §5 — automatic security updates: already on in Debian's image; dnf-automatic installed by hand on Rocky.
const auT = t(auto), arT = t(autoRocky)
const autoUpdates = consoleFrame({
  left: { output: auto, title: WEB01, highlight: [...rowsFrom(auT, 'APT::Periodic::Update-Package-Lists', 'APT::Periodic::Unattended-Upgrade'), ...rowsFrom(auT, 'Allowed origins are', 'el=Debian-Security')] },
  picture: [
    { type: 'group', id: 'daily', title: 'Every day, on their own', sub: 'two systemd timers, already enabled on this image', tone: 'ingest', children: [
      { type: 'group', id: 'd-rows', dir: 'row', bare: true, children: [
        { type: 'item', id: 'd-t1', title: 'apt-daily.timer', sub: 'Update-Package-Lists "1"', icon: 'timer', stack: true },
        { type: 'item', id: 'd-s1', title: 'apt update', sub: 'fresh package lists', icon: 'database', stack: true },
        { type: 'item', id: 'd-t2', title: 'apt-daily-upgrade.timer', sub: 'Unattended-Upgrade "1"', icon: 'timer', stack: true },
        { type: 'item', id: 'd-s2', title: 'unattended-upgrade', sub: 'only from Debian’s trixie and security origins', icon: 'shield', stack: true, tone: 'store' },
      ] },
    ] },
    familyCard('rocky', 'rocky', {
      output: autoRocky, title: WEB02, show: fold(arT, ['Rocky Linux 10 - BaseOS', 'Complete!']),
      highlight: [...rowsFrom(arT, 'package dnf-automatic is not installed'), ...rowsFrom(arT, 'apply_updates = no')],
    }),
  ],
  edges: [{ from: 'd-t1', to: 'd-s1' }, { from: 'd-t2', to: 'd-s2' }],
})

export const softwareScenes: Record<string, SceneModel> = {
  'software-packages': sources,
  'software-update-upgrade': updateUpgrade,
  'software-install-nginx': installNginx,
  'software-rocky-nginx': rockyNginx,
  'software-auto-updates': autoUpdates,
}
