# Learn Linux by running your own web server — plan

**Status: v1 plan, agreed with the owner (2026-10-29).** Nothing is authored yet. Spike part 1
(the machine) done, see `SPIKE.md`; part 2 (the engine, the recorder, the macOS script) next.

## The idea

Ana rents a fresh Debian 13 server, `web-01`, and puts her website, `ana.example`, on it. The
course is that server's life, in the order a server actually lives it:

> first login → look around → users and access → install software → run services → put the site
> online → logs and automation → keep it running

Every Linux topic is taught **when the server first needs it**, and only if it needs it. The site
is a plain static site served by nginx: no application code, because this course is about the
system, not development.

Why a web server: it is the most common reason anyone meets Linux (a VPS, an SSH login, nginx), and
its lifecycle is the natural learning order. Nothing has to be invented to motivate the next topic.

### Sized from the server, not from other repos

- A section is in the course only if `web-01` needs it at that moment. Cut on purpose, and named in
  the last section as "where next": LVM and partitioning, fork/exec internals, netfilter internals,
  cgroups and namespaces, job control, `sed`/regex depth, vim.
- A course is a **phase of the server's life**, not a textbook chapter: 7 courses.
- A section is 60–90 s (mean ~75 s). A console frame shows one command and one picture.
- **7 courses, 47 sections, ~60 minutes, one film.**

## How it teaches (a Linux expert's rules)

- **Observe, then change.** Every course opens by looking (`ls`, `ps`, `ss`, `systemctl`,
  `journalctl`, `/proc`) before touching anything. A change sits beside its rollback, and a change
  that can lock Ana out (SSH, firewall) is tested from a second session before the first is closed.
- **Linux explains itself.** Everything is a file, `/proc`, the process tree from PID 1, the manual
  pages: the learner sees why a tool works, not only which flag to type.
- **One command → one mental model.** The console shows the command and its real output; the scene
  beside it is the picture of what that output means:

  | console | picture |
  | --- | --- |
  | `ls -li` | name → inode → data |
  | `ps -ef --forest` | the process tree from systemd |
  | `ls -l` + *Permission denied* | the kernel's permission check, one path lit |
  | `systemctl status`, `list-dependencies` | the unit and its state; `After=` ≠ `Requires=` |
  | `curl -v https://ana.example` | DNS → TCP → TLS → nginx → file |
  | `ss -tlnp` | sockets → process → port |
  | `free`, `df`, `du` | what the numbers count, and what they don't |

- **The classic misreadings each get their moment:** `enable` ≠ start, `update` ≠ `upgrade`, reload
  ≠ restart, ping works ≠ the site works, deleting a file ≠ freeing its space while it is open,
  "free" memory ≠ memory pressure, load average ≠ CPU %, `>out 2>&1` ≠ `2>&1 >out`,
  `uniq` only groups adjacent lines, correct rwx ≠ access (SELinux), redundancy ≠ backup, a backup
  is only a backup once a restore has been tested.
- Each section: objective → picture → the real command and its real output → a failure or contrast
  → a one-line bridge. Narration explains and never reads a command character by character.

## Linux families and macOS

The concepts are the same everywhere, so the course is taught once, on Debian. Where the families
really differ, the scene pane carries a **family card**: the same step on the other family, from real
output. It costs no section.

| | Debian family | Red Hat family | macOS |
| --- | --- | --- | --- |
| members | Debian, Ubuntu, Mint | RHEL, Fedora, Rocky, AlmaLinux, Amazon Linux | — |
| in the course | **`web-01`, Debian 13** — the main server | **`web-02`, Rocky Linux 10** — a second real server | **the laptop side**: Unix-like, not Linux |

The points where they differ (every row verified in the spike before a frame quotes it):

| point | Debian / Ubuntu | Red Hat family | macOS (laptop) |
| --- | --- | --- | --- |
| prompt | `ana@web-01:~$` | `[ana@web-02 ~]$` | `ana@MacBook ~ %` (zsh) |
| packages | `apt`, `dpkg` | `dnf`, `rpm` | `brew` (not built in) |
| admin group | `sudo` | `wheel` | `admin` |
| add a user | `adduser` (an interactive script) | `useradd` + `passwd` (`adduser` is a link to `useradd`) | — |
| nginx layout | `sites-available/` + `sites-enabled/`, user `www-data`, root `/var/www/html` | `conf.d/`, user `nginx`, root `/usr/share/nginx/html` | — |
| SSH service | `ssh` (`sshd` is an alias) | `sshd` | — |
| firewall | nftables, installed by us (`ufw` on Ubuntu) | `firewalld`, installed by us | — |
| mandatory access control | AppArmor | SELinux (`ls -l` shows a `.`) | — |
| automatic updates | `unattended-upgrades`, already installed | `dnf-automatic`, installed by us | — |
| system log | the journal only | the journal + `/var/log/messages` (rsyslog) | `log show` |
| shell and tools | bash, GNU | bash, GNU | zsh, BSD tools (`sed -i ''`, no `ip`/`ss`, Apple's `rsync`) |

The Linux columns are measured on the pinned cloud images (`SPIKE.md` §5); the macOS column
waits for the owner's capture.

Other families (Arch, SUSE) get one mention in §1.2.

**macOS is captured on the owner's Mac.** It cannot run here (Apple's licence ties it to Apple
hardware). The laptop-side commands are a script the owner runs once on a Mac; its output is checked
in as the macOS capture. Anything not captured that way is labelled "macOS, not captured".

## Frames

Every section is one full-screen 16:9 frame and one narration. No IDE: this course is operated, not
developed.

1. **Console frame** (most sections). **Left:** a real terminal, 80 columns × ~44 rows, with the
   real prompt — `ana@laptop:~$` → `ssh` → `ana@web-01:~$`, `root@web-01:~#` when privileged.
   **Right:** the picture of what the console just showed. When a file is edited (a server block, a
   unit, a script), the right pane shows the file with its changed lines highlighted, above its
   diagram. Fixed column widths: every console frame shares one fit, so nothing moves between
   sections (`SAME_FIT`, checked). No edges between the panes; `focus` rings the console line.
2. **Server map.** The anatomy of `web-01` in one fixed layout: hardware → kernel → systemd →
   services, plus users, disks, network and firewall. A part not built yet is `muted` in place.
   It opens each course and shows what the course adds.
3. **◆ Full scene.** A canonical big picture that cannot fit the right pane at ≥ 24px body text in
   the 4K frame (families, the directory tree, boot, a request's path, stdin/stdout/stderr). It
   carries real output inside it. When in doubt, full scene.

### Engine work: graphl-flow 0.7.0 (a minor, like the notebook in 0.4)

- **`console`** — a code variant: prompts parsed (user, host, cwd, `$`/`#`), root's prompt marked,
  command highlighted, output plain, long output folded `··· N lines`, lines addressable for `focus`.
- **`tty`** — a fixed character grid with inverse video, for full-screen programs (`top`, `less`,
  `nano`), captured from a real virtual terminal, never typed.
- **Config highlighting** — systemd units (ini), nginx, fstab, nftables.
- **Icons** — Tux, Debian, Rocky Linux, nginx, OpenSSH, systemd, Let's Encrypt, Apple.
- **The console frame** as a study fixture, its frames one `SAME_FIT` group.

`@graphlearning/shell` needs nothing.

## The machine: real VMs, not containers

A container shows the host's kernel, boot, disks and memory — exactly what a Linux course teaches.
So every server is a real VM:

- **`web-01`**: the official Debian 13 cloud image (`20261026-2643`) under QEMU, set up by cloud-init.
- **`web-02`**: the official Rocky Linux 10.2 cloud image (`20260525.0`), the same way.
- **`laptop`**: a small Linux VM standing in for Ana's laptop (SSH, keys, `rsync`, backups' target);
  the macOS differences come from the owner's capture.
- **`gw`**: the hosting provider's gateway, a stand-in, never on screen as a machine: NAT, DNS
  (`ana.example`), and the local ACME CA. Every other VM has ONE network card, on the shared LAN
  (192.0.2.0/24), so `ip addr` and `ip route` show what a VPS shows.
- No KVM here, so QEMU runs unaccelerated (TCG): a boot is 1–3 minutes, acceptable because **each
  step is recorded once**. A step resumes every VM from its parent's **saved running state**
  (`savevm`, 7 s) — a server runs continuously, so uptime, PIDs and the journal carry on, and the
  course reboots only when a section reboots. The check runs nothing.
- Determinism: images pinned by checksum; each VM's clock pinned (`-rtc base=…,clock=vm`), so it runs
  only while a step runs; PIDs, timings and inode numbers masked as volatile, read by scenes from the
  session, never said in narration.
- Labelled stand-ins: HTTPS uses **real certbot against a local ACME CA** (Pebble, from Debian),
  labelled as standing in for Let's Encrypt, because `ana.example` is not on public DNS. Firmware and
  GRUB are this VM's own, labelled "a VM". What the machinery adds off screen is in `SPIKE.md`.

## Facts (frozen once a frame quotes them)

| fact | value |
| --- | --- |
| site | `ana.example` (static), web root `/var/www/ana.example` |
| servers | `web-01` Debian 13 (192.0.2.10), `web-02` Rocky Linux 10 (192.0.2.20) |
| laptop | `laptop` (192.0.2.100); macOS capture from the owner's Mac |
| people | `ana` (admin: `sudo` / `wheel`), `deploy` (owns the web root, no sudo) |
| first login | `ssh ana@192.0.2.10`, the provider's password (password logins on, no key until §2.5) |
| Ana's terminal | the laptop's console, 80 × 44; she stays logged in from section to section |
| addresses | 192.0.2.0/24 (TEST-NET-1, documentation range) |
| versions | pinned by the spike, recorded here |

Extend this table; never change a value a frame already quotes.

## The courses

**1. `first-login` · Log in and look around · 7**

| # | Section | Picture |
| --- | --- | --- |
| 1 | The server we'll build | the finished site over HTTPS; the server map, complete (recorded last) |
| 2 | ◆ Linux, its families, and macOS | kernel → distributions; the Debian and Red Hat trees; where macOS sits; real `uname`, `os-release` from both servers |
| 3 | SSH in | `ssh ana@192.0.2.10`: the host key fingerprint, the password; reading the prompt (recorded) |
| 4 | Commands, options, arguments, `man` | a command line split into its parts; man sections |
| 5 | ◆ The directory tree | `/etc`, `/var`, `/home`, `/usr`, `/proc` — what lives where, and why |
| 6 | Moving around | `pwd`, `cd`, `ls -l` read column by column |
| 7 | Reading files; everything is a file | `cat`, `less`, `tail`; `/proc/<pid>` |

**2. `access` · Users, sudo and permissions · 6**

| # | Section | Picture |
| --- | --- | --- |
| 1 | root, ana and `sudo` | why you don't log in as root; `sudo` / `wheel` card |
| 2 | Users and groups | `/etc/passwd` fields; the `deploy` user (`adduser` / `useradd` card) |
| 3 | Permissions | rwx, and the kernel's check, one path lit |
| 4 | `chown`, `chmod`, `umask` | the web root belongs to `deploy` |
| 5 | SSH keys from the laptop | key pair → `authorized_keys`; macOS note |
| 6 | Lock SSH down | no passwords, no root login; tested from a second session first (`ssh` / `sshd` card) |

**3. `software` · Install software · 5**

| # | Section | Picture |
| --- | --- | --- |
| 1 | Packages, sources, signatures | repository → signed index → package |
| 2 | `update` ≠ `upgrade` | the index refreshed vs packages replaced |
| 3 | Install nginx: what it put where | `dpkg -L`: binary, config, unit, logs, web root |
| 4 | The same install on Rocky Linux | real `dnf install nginx` on `web-02`; the layout differences |
| 5 | Automatic security updates | already on Debian's image — is it on, and what will it do? (`dnf-automatic` card: installed by hand) |

**4. `services` · Processes and services · 6**

| # | Section | Picture |
| --- | --- | --- |
| 1 | Processes | the tree from PID 1 |
| 2 | Signals | TERM (asked) vs KILL (forced) |
| 3 | systemd | what `systemctl status` is telling you |
| 4 | `enable` ≠ start | a real reboot proves it |
| 5 | The journal | `journalctl -u`, `-b`, `-f` |
| 6 | ◆ Boot | firmware → bootloader → kernel → initramfs → systemd, from this VM's boot log |

**5. `web` · Put the site online · 9**

| # | Section | Picture |
| --- | --- | --- |
| 1 | nginx's config | a server block for `ana.example`; `sites-enabled` / `conf.d` card |
| 2 | Deploy the site | `rsync` from the laptop as `deploy` |
| 3 | `nginx -t`, then reload | reload ≠ restart: workers replaced, connections kept |
| 4 | Network basics | `ip addr`, routes, name lookup |
| 5 | ◆ A request's path | DNS → TCP → nginx → file (`curl -v`) |
| 6 | Ports and sockets | `ss -tlnp`: socket → process → port |
| 7 | HTTPS with certbot | certificate chain; the local CA, labelled |
| 8 | A firewall | install nftables; default-deny, tested from the laptop (`ufw` / `firewalld` card) |
| 9 | On Red Hat, SELinux says no | the site `mv`d from home: rwx is right, nginx answers 403; the AVC denial, `ls -Z`, `semanage fcontext` + `restorecon` |

**6. `automate` · Logs and automation · 7**

| # | Section | Picture |
| --- | --- | --- |
| 1 | ◆ stdin, stdout, stderr | redirection and pipes; `>out 2>&1` ≠ `2>&1 >out` |
| 2 | Who visits | `grep`, `cut`, `sort`, `uniq -c` on `access.log` |
| 3 | `awk` | status codes and the top pages |
| 4 | `deploy.sh` | variables, quoting, exit codes |
| 5 | Make it safe | `set -euo pipefail` and its limits, `if`, `trap` |
| 6 | A timer for the nightly report | `.timer` → `.service`; vs cron |
| 7 | logrotate | logs that don't grow forever |

**7. `operate` · Keep it running · 7**

| # | Section | Picture |
| --- | --- | --- |
| 1 | The disk is full | `df` vs `du`; a deleted file that is still open |
| 2 | Memory and load | "available" vs "free"; load ≠ CPU % |
| 3 | Backups, and a tested restore | `rsync` to the laptop; restore into a scratch path and compare |
| 4 | The site is down | the ladder: DNS → network → firewall → nginx → permissions |
| 5 | A hardening review | what's listening, who can log in, what's out of date |
| 6 | A kernel update and a reboot | running vs installed kernel |
| 7 | A runbook, and where next | the server map, complete; what this course left out |

**Totals:** 7 + 6 + 5 + 6 + 9 + 7 + 7 = **47 sections**, 6 of them ◆ full scenes.

## Packaging for YouTube

**One video: "Learn Linux by running your own web server: full course, beginner to professional"**
— 7 courses, 47 sections, ~60 min, one continuous story. It opens with the finished site (payoff
first). A course is a chapter group and the owner's review unit; a section is one chapter. Each
section can also go out as a Short (`record-reels`).

## Build order

1. ~~Owner review of this plan.~~ Agreed 2026-10-29.
2. **Spike (no content):**
   - Debian 13 and Rocky Linux 10 cloud images under QEMU TCG: boot time, a recorded step's time,
     the qcow2 overlay chain, the clock pin, the package snapshots, three VMs on one network.
   - Real console capture through a pty: prompts, colours off, a full-screen program into a
     virtual-terminal grid (`tty`).
   - certbot against Pebble; SELinux denying a custom web root on `web-02`.
   - Verify every row of the family table; write the macOS capture script.
   - graphl-flow 0.7.0: `console`, `tty`, config highlighting, icons, the console-frame study.
3. **Repo scaffold:** vite + graphl-flow + shell, the console frame and the server map on one fit
   each, `check-content` / `check-render` / `check:spine`, `CLAUDE.md`.
4. **Pilot:** Course 2 (`access`) + ◆ Boot (4.6) → owner review of both frame kinds on 4K routes.
5. The remaining courses one at a time, each reviewed on its rendered routes, then narrated.
6. Record all 7 → the one film.

## Decisions (resolved with the owner, 2026-10-29)

1. Use case: running your own web server.
2. The site is static, served by nginx.
3. New repo `linux-web-server`; it replaces `linux-ct` (its narration is not carried over).
4. Sized from the server: 7 courses, 47 sections, ~60 min.
5. Families covered by family cards and two real sections on Rocky Linux 10 (`web-02`).
6. macOS captured by the owner running a script on a Mac.
