import type { SceneModel } from '@graphlearning/graphl-flow'
import { CONSOLE_W, consoleFrame, consoleH, consoleNode, drawnRows, familyCard, fold, macCard, rowOf, rowsFrom, transcript } from '../console'
import mac from '../../../sections/macos/capture.txt?raw'
import conf from '../../../sections/web/01-nginx-config/output.txt?raw'
import confRocky from '../../../sections/web/01-nginx-config/rocky/output.txt?raw'
import deploy from '../../../sections/web/02-deploy/output.txt?raw'
import reload from '../../../sections/web/03-test-reload/output.txt?raw'
import network from '../../../sections/web/04-network/output.txt?raw'
import request from '../../../sections/web/05-request-path/output.txt?raw'
import ports from '../../../sections/web/06-ports-sockets/output.txt?raw'
import https from '../../../sections/web/07-https/output.txt?raw'
import firewall from '../../../sections/web/08-firewall/output.txt?raw'
import firewallSecond from '../../../sections/web/08-firewall/second.txt?raw'
import firewallRocky from '../../../sections/web/08-firewall/rocky/output.txt?raw'
import selinux from '../../../sections/web/09-selinux/output.txt?raw'

// Course 5 — put the site online. Every console is a capture from sections/web/. Two lab-network
// traces are never quoted outside the console (CLAUDE.md): the gateway's address in `ip route` is
// "the gateway", and rows where a server names the laptop by that address are folded.
const t = transcript
const WEB01 = 'ana@web-01: ~'
const LAPTOP = 'ana@laptop: ~'
const rows = (text: string, a: number, b: number) => text.split('\n').slice(a - 1, b).join('\n')

// §1 — nginx's config: a server block for ana.example, enabled by a link. The file shown in the picture
// is the one tee echoed back in the capture. Folded: that echo.
const confT = t(conf)
const echoFrom = rowOf(confT, 'server {', rowOf(confT, '[sudo] password'))
const block = rows(confT, echoFrom, rowOf(confT, '}', echoFrom))
const nginxConfig = consoleFrame({
  left: {
    output: conf, title: WEB01, show: fold(confT, ['server {', '}', echoFrom]),
    highlight: [...rowsFrom(confT, 'include /etc/nginx/sites-enabled/*'), ...rowsFrom(confT, 'ana.example -> /etc/nginx/sites-available', '/ana.example')],
  },
  picture: [
    { type: 'code', id: 'block', lang: 'nginx', filename: '/etc/nginx/sites-available/ana.example', code: block, fill: true, highlight: [3, 4] },
    { type: 'group', id: 'chain', title: 'How nginx finds it', sub: 'available is a shelf; enabled is what nginx reads', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'n-conf', title: 'nginx.conf', sub: 'include sites-enabled/*', icon: 'file', stack: true },
      { type: 'item', id: 'n-link', title: 'sites-enabled/ana.example', sub: 'a symlink — ln -s', icon: 'branch', stack: true },
      { type: 'item', id: 'n-file', title: 'sites-available/ana.example', sub: 'the real file', icon: 'file', stack: true, tone: 'store' },
    ] },
    familyCard('rocky', 'rocky', { output: confRocky, title: '[ana@web-02 ~]', highlight: [...rowsFrom(t(confRocky), 'include /etc/nginx/conf.d/*.conf'), ...rowsFrom(t(confRocky), 'No such file or directory')] }),
  ],
  edges: [{ from: 'n-conf', to: 'n-link', label: 'reads' }, { from: 'n-link', to: 'n-file', label: 'points to' }],
})

// §2 — deploy the site: rsync from the laptop as deploy (its key installed off screen).
const dpT = t(deploy)
const secondRun = rowOf(dpT, 'rsync -av', rowOf(dpT, '>> ~/site/index.html'))
const deployFrame = consoleFrame({
  left: { output: deploy, title: LAPTOP, highlight: [...rowsFrom(dpT, 'about.html', 'index.html', rowOf(dpT, './')), rowOf(dpT, 'index.html', secondRun + 1)] },
  picture: [
    { type: 'group', id: 'path', title: 'From the laptop to the web root', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'd-site', title: '~/site/', sub: 'Ana edits here, on the laptop', icon: 'laptop', stack: true },
      { type: 'item', id: 'd-rsync', title: 'rsync over SSH', sub: 'logs in as deploy, with a key', icon: 'key', stack: true },
      { type: 'item', id: 'd-root', title: '/var/www/ana.example', sub: 'owned by deploy', icon: 'folder', stack: true, tone: 'store' },
      { type: 'item', id: 'd-nginx', title: 'nginx', sub: 'serves what is there', icon: 'nginx', stack: true },
    ] },
    { type: 'table', id: 'flags', title: 'rsync -av ~/site/ deploy@192.0.2.10:/var/www/ana.example/', tone: 'ingest', fill: true, columns: ['part', 'means'], rows: [
      ['-a', 'archive: recurse, keep modes and times'],
      ['-v', 'name each file it sends'],
      ['~/site/', 'the trailing slash: the folder’s CONTENTS, not the folder'],
      ['deploy@…:', 'the remote user, then the path on web-01'],
    ] },
    { type: 'table', id: 'runs', title: 'Two runs, two answers', tone: 'ingest', fill: true, columns: ['run', 'sent', 'why'], rows: [
      ['first', './  about.html  index.html', 'nothing was there yet'],
      { cells: ['second', 'index.html', 'only the file that changed'], tone: 'store' },
    ] },
    macCard('mac', mac, ['rsync --version | head -2'], [
      { type: 'note', id: 'mac-note', tone: 'neutral', text: 'Apple ships openrsync, which speaks an older protocol (29). -a, -v and the trailing slash mean the same.' },
    ], ['openrsync']),
  ],
  edges: [{ from: 'd-site', to: 'd-rsync' }, { from: 'd-rsync', to: 'd-root' }, { from: 'd-root', to: 'd-nginx' }],
})

// §3 — nginx -t, then reload. The master's PID stays, the workers' change: read from the capture.
const rlT = t(reload)
const pidsAfter = (from: number) => [...rows(rlT, from, from + 3).matchAll(/^ +(\d+) nginx: (master|worker)/gm)].map((m) => m[1])
const before = pidsAfter(rowOf(rlT, 'PID CMD')), after = pidsAfter(rowOf(rlT, 'PID CMD', rowOf(rlT, 'systemctl reload nginx')))
const testReload = consoleFrame({
  left: { output: reload, title: WEB01, highlight: [...rowsFrom(rlT, '[emerg]', 'n.conf:1'), ...rowsFrom(rlT, 'Job for nginx.service failed'), rowOf(rlT, 'systemctl is-active') + 1] },
  picture: [
    { type: 'table', id: 'pids', title: 'systemctl reload, seen in ps', tone: 'ingest', fill: true, columns: ['process', 'before', 'after'], rows: [
      { cells: ['master', before[0], after[0]], tone: 'store' },
      { cells: ['worker', before[1], after[1]], tone: 'consume' },
      { cells: ['worker', before[2], after[2]], tone: 'consume' },
    ] },
    { type: 'group', id: 'reload', title: 'reload: the master stays', sub: 'it re-reads the config and starts new workers; the old ones finish their requests first', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'r-master', title: 'master', sub: 'same process, new config', icon: 'nginx', stack: true, tone: 'store' },
      { type: 'item', id: 'r-new', title: 'new workers', sub: 'take new connections', icon: 'users', stack: true },
    ] },
    { type: 'table', id: 'vs', title: 'reload ≠ restart', tone: 'ingest', fill: true, columns: ['', 'reload', 'restart'], rows: [
      ['the master', 'kept', 'stopped, started again'],
      ['open connections', 'finish', 'cut'],
      { cells: ['a broken config', 'refused — the old one keeps serving', 'nginx stops: the site is down'], tone: 'consume' },
    ] },
  ],
  edges: [{ from: 'r-master', to: 'r-new', label: 'starts' }],
})

// §4 — network basics: addresses, routes, name lookup. Folded: resolv.conf's comment block.
const nwT = t(network)
const networkFrame = consoleFrame({
  left: {
    output: network, title: WEB01, show: fold(nwT, ['# This is /run/systemd/resolve/stub-resolv.conf', 'operation for /etc/resolv.conf.']),
    highlight: [rowOf(nwT, 'inet 192.0.2.10/24'), rowOf(nwT, 'default via'), rowOf(nwT, 'hosts:          files'), rowOf(nwT, '# stand-in for public DNS')],
  },
  picture: [
    { type: 'table', id: 'addr', title: 'ip addr: two interfaces', tone: 'ingest', fill: true, columns: ['interface', 'address', 'reaches'], rows: [
      ['lo', '127.0.0.1/8', 'this machine only — loopback'],
      { cells: ['ens3', '192.0.2.10/24', 'the network: 192.0.2.0 – 192.0.2.255'], tone: 'store' },
    ] },
    { type: 'table', id: 'route', title: 'ip route: where a packet goes', tone: 'ingest', fill: true, columns: ['destination', 'via'], rows: [
      ['192.0.2.0/24', 'straight out of ens3: it is on this network'],
      ['default — everything else', 'the gateway, which forwards it on'],
    ] },
    { type: 'group', id: 'lookup', title: 'Name lookup, in nsswitch.conf’s order', sub: 'the first source that answers wins', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'l-files', title: 'files', sub: '/etc/hosts — ana.example, a stand-in for public DNS', icon: 'file', stack: true, tone: 'store' },
      { type: 'item', id: 'l-resolve', title: 'resolve', sub: 'systemd-resolved at 127.0.0.53', icon: 'search', stack: true },
      { type: 'item', id: 'l-dns', title: 'DNS', sub: 'deb.debian.org → four addresses', icon: 'globe', stack: true },
    ] },
    macCard('mac', mac, ['ip addr', 'ifconfig en0 | head -1', 'ss -tln', 'netstat -an -p tcp | head -2'], [], ['command not found: ip', 'command not found: ss']),
  ],
  edges: [{ from: 'l-files', to: 'l-resolve', label: 'not found' }, { from: 'l-resolve', to: 'l-dns', label: 'asks' }],
})

// §5 ◆ A request's path — a full scene: name → TCP → HTTP → nginx → file, with curl -v under it.
const rqT = t(request)
const requestPath: SceneModel = {
  title: 'What happens when you open http://ana.example/',
  sub: 'curl -v prints every step: * is curl itself, > what it sent, < what came back',
  nodes: [
    { type: 'group', id: 'steps', dir: 'row', bare: true, children: [
      { type: 'item', id: 'q-name', title: '1 · the name', sub: 'ana.example → 192.0.2.10 (/etc/hosts: a stand-in for DNS)', icon: 'search', stack: true, tone: 'source' },
      { type: 'item', id: 'q-tcp', title: '2 · a connection', sub: 'TCP to port 80 — “Connected”', icon: 'network', stack: true, tone: 'ingest' },
      { type: 'item', id: 'q-tls', title: 'HTTPS adds TLS here', sub: 'encryption — in §7', icon: 'lock', stack: true, tone: 'neutral' },
      { type: 'item', id: 'q-http', title: '3 · the request', sub: 'GET / and Host: ana.example', icon: 'file', stack: true, tone: 'ingest' },
      { type: 'item', id: 'q-nginx', title: '4 · nginx', sub: 'server_name picks the block; root + index pick the file', icon: 'nginx', stack: true, tone: 'serve' },
      { type: 'item', id: 'q-file', title: '5 · the answer', sub: '200 OK and the file’s bytes — or 404', icon: 'check', stack: true, tone: 'store' },
    ] },
    { type: 'group', id: 'proof', dir: 'row', bare: true, children: [
      consoleNode('rq-console', {
        output: request, title: LAPTOP,
        highlight: [rowOf(rqT, '* IPv4: 192.0.2.10'), rowOf(rqT, '* Connected to'), ...rowsFrom(rqT, '> GET / HTTP/1.1', '> Host: ana.example'), rowOf(rqT, '< HTTP/1.1 200 OK'), rowOf(rqT, 'HTTP/1.1 404 Not Found')],
      }, { w: CONSOLE_W, h: consoleH(drawnRows(rqT)) }),
      { type: 'group', id: 'reading', bare: true, children: [
        { type: 'table', id: 'headers', title: 'The answer’s headers', tone: 'serve', columns: ['header', 'says'], rows: [
          ['Server', 'nginx — who answered'],
          ['Content-Type', 'text/html: what the bytes are'],
          ['Content-Length', '75: how many bytes follow'],
          ['Last-Modified', 'when index.html last changed'],
        ] },
        { type: 'table', id: 'codes', title: 'Status codes', tone: 'serve', columns: ['code', 'means'], rows: [
          { cells: ['200', 'OK: here it is'], tone: 'store' },
          ['301', 'moved: ask over there — §7'],
          { cells: ['403', 'forbidden: it exists, you may not — §9'], tone: 'consume' },
          { cells: ['404', 'not found: no such file under root'], tone: 'consume' },
        ] },
      ] },
    ] },
  ],
  edges: [
    { from: 'q-name', to: 'q-tcp' }, { from: 'q-tcp', to: 'q-tls' }, { from: 'q-tls', to: 'q-http' },
    { from: 'q-http', to: 'q-nginx' }, { from: 'q-nginx', to: 'q-file' },
  ],
}

// §6 — ports and sockets: ss -tlnp. Folded: `ss -tn` (its one connection names the laptop by the lab
// network's address).
const ptT = t(ports)
const nginxPids = /users:\(\("nginx",pid=(\d+).*\("nginx",pid=(\d+).*\("nginx",pid=(\d+)/.exec(ptT)!.slice(1)
const portsFrame = consoleFrame({
  left: {
    output: ports, title: WEB01, show: fold(ptT, ['ss -tn', 'ESTAB']),
    highlight: [...rowsFrom(ptT, '0.0.0.0:80', 'users:(("nginx"', rowOf(ptT, 'sudo ss -tlnp')), ...rowsFrom(ptT, '0.0.0.0:22', 'users:(("sshd"', rowOf(ptT, 'sudo ss -tlnp'))],
  },
  picture: [
    { type: 'group', id: 'sock', title: 'Port → socket → process', sub: 'a program asks the kernel for a port; ss shows who holds which', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'k-port', title: 'port 80', sub: 'on 0.0.0.0: every IPv4 address', icon: 'network', stack: true },
      { type: 'item', id: 'k-socket', title: 'one listening socket', sub: 'fd 5, shared by three processes', icon: 'zap', stack: true },
      { type: 'item', id: 'k-nginx', title: 'nginx', sub: `pids ${nginxPids.join(', ')}: master and workers`, icon: 'nginx', stack: true, tone: 'store' },
    ] },
    { type: 'table', id: 'listen', title: 'What web-01 listens on', tone: 'ingest', fill: true, columns: ['address:port', 'process', 'reachable from'], rows: [
      { cells: ['0.0.0.0:80', 'nginx', 'anywhere — the website'], tone: 'store' },
      { cells: ['0.0.0.0:22 and [::]:22', 'sshd', 'anywhere — SSH'], tone: 'store' },
      ['127.0.0.53:53, 127.0.0.54:53', 'systemd-resolved', 'this machine only: 127.x'],
      { cells: ['0.0.0.0:5355 and [::]:5355', 'systemd-resolved', 'anywhere — LLMNR, a name protocol this server does not need'], tone: 'consume' },
    ] },
    { type: 'table', id: 'flags', title: 'ss -tlnp', tone: 'ingest', fill: true, columns: ['flag', 'means'], rows: [
      ['-t', 'TCP'], ['-l', 'listening sockets'], ['-n', 'numbers, not names'], ['-p', 'the process — needs sudo'],
    ] },
  ],
  edges: [{ from: 'k-port', to: 'k-socket' }, { from: 'k-socket', to: 'k-nginx' }],
})

// §7 — HTTPS with certbot, against Pebble: a local ACME CA standing in for Let's Encrypt (NOTES.md).
// 172 rows fold to 43: the login banner, apt's install, certbot's footer, part of the grep, the exit.
const hsT = t(https)
const httpsFrame = consoleFrame({
  left: {
    output: https, title: LAPTOP,
    show: fold(hsT, ['Linux web-01', 'permitted by applicable law'], ['Installing:', 'Processing triggers for libc-bin'], ['Saving debug log', 'Requesting a certificate'],
      ['', undefined, rowOf(hsT, 'Requesting a certificate') + 1],
      ['he background.', 'Deploying certificate', rowOf(hsT, 'Certbot has set up')], ['Congratulations!', 'eff.org/donate-le'], ['- - - -', undefined, rowOf(hsT, 'eff.org/donate-le') + 1],
      ['8:    ssl_certificate_key', '16:    } # managed by Certbot'], ['sudo ls /etc/letsencrypt', 'Connection to 192.0.2.10 closed.'], ['Server: nginx', 'Date: Mon']),
    highlight: [...rowsFrom(hsT, 'curl: (7) Failed to connect', 'ct to server'), ...rowsFrom(hsT, 'This certificate expires on'), ...rowsFrom(hsT, '6:    listen 443 ssl'), rowOf(hsT, 'HTTP/1.1 200 OK'), rowOf(hsT, 'HTTP/1.1 301 Moved Permanently'), ...rowsFrom(hsT, ' 0 s:', 'i:CN=Pebble Root CA')],
  },
  picture: [
    { type: 'group', id: 'chain', title: 'The certificate chain', sub: 'each certificate is signed by the one above it; the browser already trusts the top', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'h-root', title: 'Pebble Root CA', sub: 'trusted by the laptop — set up off screen', icon: 'shield', stack: true, tone: 'neutral' },
      { type: 'item', id: 'h-int', title: 'Pebble Intermediate CA', sub: 'signs the sites’ certificates', icon: 'cert', stack: true },
      { type: 'item', id: 'h-leaf', title: 'ana.example', sub: 'valid 90 days: expires 2027-01-31', icon: 'lock', stack: true, tone: 'store' },
    ] },
    { type: 'note', id: 'standin', tone: 'consume', text: 'A stand-in, said plainly: Pebble is a local ACME CA. It plays Let’s Encrypt because ana.example is not on public DNS. certbot and every step are the real ones; only --server differs.' },
    { type: 'table', id: 'did', title: 'What certbot --nginx did', tone: 'ingest', fill: true, columns: ['step', 'result'], rows: [
      ['proved control of ana.example', 'the CA checked it over HTTP'],
      ['saved the certificate and key', '/etc/letsencrypt/live/ana.example/'],
      ['edited the server block', 'listen 443 ssl; ssl_certificate …'],
      ['redirected port 80', 'http:// now answers 301 → https://'],
      ['scheduled renewal', 'certbot.timer, well before the 90 days end'],
    ] },
  ],
  edges: [{ from: 'h-root', to: 'h-int', label: 'signs' }, { from: 'h-int', to: 'h-leaf', label: 'signs' }],
})

// §8 — a firewall: nftables, default-deny, tested from a second terminal on the laptop. The service on
// 8080 is a test server set up off screen, to have something the firewall should block.
const fwT = t(firewall), fsT = t(firewallSecond)
const fwShow = fold(fwT, ['Linux web-01', 'permitted by applicable law'], ['Installing:', 'Processing triggers for libc-bin'], [rowOf(fwT, '> EOF') + 1, rowOf(fwT, 'sudo nft -c') - 1],
  ['Created symlink', 'usr/lib/systemd/system/nftables.service'], ['icmpv6 type { echo-request, nd-router-advert', 't, nd-neighbor-advert } accept'],
  ['> #!/usr/sbin/nft -f', rowOf(fwT, '> #!/usr/sbin/nft -f') + 2], ['icmpv6 type { echo-request, nd-neighbor-solicit', '> }'], ['ana@web-01:~$ exit', 'Connection to 192.0.2.10 closed.'])
const firewallFrame = consoleFrame({
  left: { output: firewall, title: `${LAPTOP} — first terminal`, show: fwShow, highlight: [rowOf(fwT, '200'), rowOf(fwT, 'sudo: nft: command not found'), ...rowsFrom(fwT, 'policy drop;', 'tcp dport { 22, 80, 443 } accept', rowOf(fwT, 'sudo nft list ruleset', 20))] },
  picture: [
    { type: 'group', id: 'second', title: 'Tested from a second terminal', sub: 'the first stays logged in until SSH is proven to still work', tone: 'store', children: [
      consoleNode('second-console', { output: firewallSecond, title: `${LAPTOP} — second terminal`, highlight: [rowOf(fsT, 'web-01'), rowOf(fsT, '000')] }, { w: CONSOLE_W, h: consoleH(drawnRows(fsT)) }),
    ] },
    { type: 'group', id: 'rules', title: 'A packet arriving at web-01', sub: 'rules are read top to bottom; the first match decides', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'f-est', title: 'a reply?', sub: 'established, related: accept', icon: 'check', stack: true },
      { type: 'item', id: 'f-port', title: '22, 80, 443?', sub: 'SSH and the website: accept', icon: 'network', stack: true, tone: 'store' },
      { type: 'item', id: 'f-drop', title: 'anything else', sub: 'policy drop: no answer at all', icon: 'firewall', stack: true, tone: 'consume' },
    ] },
    familyCard('rocky', 'rocky', { output: firewallRocky, title: '[ana@web-02 ~]', highlight: rowsFrom(t(firewallRocky), 'package firewalld is not installed') }),
  ],
  edges: [{ from: 'f-est', to: 'f-port', label: 'no' }, { from: 'f-port', to: 'f-drop', label: 'no' }],
})

// §9 — on Red Hat, SELinux says no: rwx is right, nginx answers 403. Folded: the audit record's
// PROCTITLE and SYSCALL lines, leaving the AVC denial.
const slT = t(selinux)
const selinuxFrame = consoleFrame({
  left: {
    output: selinux, title: '[ana@web-02 ~]', show: fold(slT, ['type=PROCTITLE', 'system_r:httpd_t:s0 key=(null)']),
    highlight: [rowOf(slT, '-rw-r--r--.'), rowOf(slT, 'HTTP/1.1 403 Forbidden'), ...rowsFrom(slT, 'avc:  denied  { read }', 'tclass=file permissive=0'), rowOf(slT, 'HTTP/1.1 200 OK')],
  },
  picture: [
    { type: 'group', id: 'checks', title: 'Two checks, both must pass', dir: 'row', tone: 'ingest', children: [
      { type: 'item', id: 'x-dac', title: 'rwx', sub: 'other: r-- — nginx may read: allowed', icon: 'lock', stack: true, tone: 'store' },
      { type: 'item', id: 'x-mac', title: 'SELinux', sub: 'httpd_t may not read user_home_t: denied', icon: 'redhat', stack: true, tone: 'consume' },
    ] },
    { type: 'table', id: 'avc', title: 'The denial, read field by field', tone: 'ingest', fill: true, columns: ['field', 'value', 'means'], rows: [
      ['denied', '{ read }', 'what was refused'],
      ['comm', 'nginx', 'who asked'],
      ['scontext', 'httpd_t', 'the web server’s domain'],
      ['tcontext', 'user_home_t', 'the file’s label: “a home directory file”'],
    ] },
    { type: 'table', id: 'labels', title: 'Why, and the fix', tone: 'ingest', fill: true, columns: ['step', 'label'], rows: [
      { cells: ['mv from ~ keeps the file’s label', 'user_home_t → 403'], tone: 'consume' },
      ['semanage fcontext -a …', 'the rule: this path is web content (persistent)'],
      { cells: ['restorecon -Rv', 'httpd_sys_content_t → 200'], tone: 'store' },
    ] },
    { type: 'note', id: 'debian', tone: 'neutral', text: 'Mandatory access control exists on both families: SELinux on Red Hat, AppArmor on Debian. Correct rwx is not the same as access.' },
  ],
  edges: [{ from: 'x-dac', to: 'x-mac', label: 'then' }],
})

export const webScenes: Record<string, SceneModel> = {
  'web-nginx-config': nginxConfig,
  'web-deploy': deployFrame,
  'web-test-reload': testReload,
  'web-network': networkFrame,
  'web-request-path': requestPath,
  'web-ports-sockets': portsFrame,
  'web-https': httpsFrame,
  'web-firewall': firewallFrame,
  'web-selinux': selinuxFrame,
}
