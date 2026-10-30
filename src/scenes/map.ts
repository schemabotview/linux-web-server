import type { Edge, Group, Item } from '@graphlearning/graphl-flow'

// The server map (COURSE-PLAN.md, "Frames" 2): the anatomy of web-01 in ONE fixed layout — the
// outside world, the firewall, the services, systemd, the kernel and the machine, plus people and
// files. Each part names the course that built it (§course.section). Every fact on it was captured:
// 2 vCPU (nproc, §7.2), 1.4 GiB (free, §7.2), 9.7 GB (df, §7.1), Linux 6.12 (uname, §1.2).
//
// It is drawn complete, in first-login/01 (the finished server, payoff first) and operate/07 (the
// runbook). The plan's "opens each course, the unbuilt parts muted" has no section of its own in the
// 47; if the owner wants it, `muted` on a part is paint only and moves nothing.

const part = (id: string, title: string, sub: string, icon: string, tone?: Item['tone']): Item => ({ type: 'item', id, title, sub, icon, tone })

export function serverMap(): { nodes: Group[]; edges: Edge[] } {
  const outside: Group = {
    type: 'group', id: 'm-outside', title: 'Outside', icon: 'globe', tone: 'source', children: [
      part('m-visitors', 'visitors', 'https://ana.example §5.7', 'users'),
      part('m-laptop', 'Ana’s laptop', 'key §2.5 · deploy.sh §6.4 · backup §7.3', 'laptop'),
    ],
  }
  const services: Group = {
    // Two columns, the two services the outside reaches on the LEFT: an edge into the right column
    // would cross the left one (check-render failed the first, three-column map for it).
    type: 'group', id: 'm-services', title: 'Services', sub: 'run by systemd §4.3', dir: 'grid', cols: 2, tone: 'serve', children: [
      part('m-nginx', 'nginx', 'the site, HTTPS §5', 'nginx'),
      part('m-journald', 'journald', 'one log §4.5', 'log'),
      part('m-sshd', 'sshd', 'keys only §2.6', 'key'),
      part('m-unattended', 'unattended-upgrades', 'fixes daily §3.5', 'shield'),
      part('m-report', 'site-report.timer', 'nightly §6.6', 'timer'),
      part('m-logrotate', 'logrotate.timer', 'logs end §6.7', 'archive'),
    ],
  }
  const firewall: Group = {
    type: 'group', id: 'm-firewall', title: 'nftables §5.8', sub: 'only 22, 80, 443 get in', icon: 'firewall', tone: 'consume', dashed: true, children: [services],
  }
  const side: Group = {
    type: 'group', id: 'm-side', bare: true, children: [
      { type: 'group', id: 'm-people', title: 'People §2', icon: 'users', tone: 'ingest', children: [
        part('m-ana', 'ana', 'sudo §2.1', 'admin'),
        part('m-deploy', 'deploy', 'the web root §2.4', 'user'),
      ] },
      { type: 'group', id: 'm-files', title: 'Files §1.5', icon: 'folder', tone: 'ingest', children: [
        part('m-www', '/var/www/ana.example', 'the site §5.2', 'folder'),
        part('m-etc', '/etc', 'configuration', 'settings'),
        part('m-varlog', '/var/log', 'logs §6', 'log'),
      ] },
    ],
  }
  const stack: Group = {
    type: 'group', id: 'm-stack', bare: true, children: [
      firewall,
      part('m-systemd', 'systemd · PID 1', 'starts everything §4', 'settings', 'ingest'),
      part('m-kernel', 'Linux 6.12', 'the kernel §1.2', 'linux', 'infra'),
      part('m-hw', 'a VM', '2 vCPU · 1.4 GiB · 9.7 GB §4.6, §7', 'cpu', 'neutral'),
    ],
  }
  const server: Group = {
    type: 'group', id: 'm-server', title: 'web-01', sub: 'Debian 13 · 192.0.2.10', icon: 'debian', tone: 'neutral', dir: 'row', children: [stack, side],
  }
  return {
    nodes: [{ type: 'group', id: 'm-row', bare: true, dir: 'row', children: [outside, server] }],
    edges: [{ from: 'm-laptop', to: 'm-sshd', label: 'SSH' }, { from: 'm-visitors', to: 'm-nginx', label: 'HTTPS' }],
  }
}
