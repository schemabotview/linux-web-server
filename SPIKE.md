# Spike — can real VMs record this course here?

**2026-10-29. Part 1 (the machine) done; part 2 (graphl-flow 0.7.0, the recorder, the macOS script)
open.** Scripts in `spike/vm/` are the spike's, not the course's tooling: they prove each piece and
will be folded into one recorder.

## Verdict

Yes. Debian 13 and Rocky Linux 10 run as real VMs under QEMU without KVM, on a private network
that looks to every frame exactly like a VPS, with real nginx, real certbot and a real SELinux denial.
The state model changes from the plan: **a step is resumed from a saved running VM, not rebooted
from a disk overlay** (§4).

## 1. Images and boot (pinned)

| | image | sha | boot to SSH (TCG, 2–4 vCPU) |
| --- | --- | --- | --- |
| Debian 13 | `debian-13-genericcloud-amd64-20261026-2643.qcow2` (cloud.debian.org) | SHA-512 `3ace18e3…bc1b8e`, checked | 60–96 s |
| Rocky Linux 10.2 | `Rocky-10-GenericCloud-Base-10.2-20260525.0.x86_64.qcow2` (dl.rockylinux.org) | SHA-256 `9fc9e9ff…bc4b48`, checked | 167–187 s |

- Host: Ubuntu 24.04, no `/dev/kvm`, QEMU 8.2.2. `-cpu max` under TCG provides x86-64-v3, which
  Rocky 10 requires.
- Kernels: Debian `6.12.113+deb13-cloud-amd64`, Rocky `6.12.0-211.16.1.el10_2.0.1.x86_64`.
- `-nodefaults` hangs the Debian kernel after GRUB (no output, nothing written to disk). Without it
  `lsblk` shows `sr0` (QEMU's empty CD) and the cloud-init seed as `vdb`. Open: hide both from
  frames (detach the seed after first boot; drop the default CD without `-nodefaults`).
- `-rtc base=…,clock=vm` pins the clock: `date` reads Mon Nov 2 2026 from boot.
- The Bash tool's guard: never `pgrep -f` a pattern that appears in the waiting script's own
  command line (it matches itself and never ends). Wait on the PID file.

## 2. Console capture (`spike/vm/console.py`)

A real interactive bash over `ssh -tt`, the byte stream replayed through pyte (VT100) at 80 × 44:
wrapping, `\r` progress bars (apt, dpkg) and full-screen programs (`top`) come out as a terminal
draws them. A command ends when the real prompt returns. Prompts differ by family, so the detector
and the engine's `console` both need two forms:

| family | prompt |
| --- | --- |
| Debian | `ana@web-01:~$` |
| Red Hat | `[ana@web-02 ~]$` |
| macOS (zsh) | `ana@MacBook ~ %` — to be confirmed by the owner's capture |

## 3. The network

One shared LAN, a QEMU multicast socket (`230.0.2.1:5555`), 192.0.2.0/24. No host bridge or tap
(none is allowed here, and none is needed).

- **`gw` (192.0.2.1)** stands in for the hosting provider's gateway: the only VM with a second card
  (slirp, for the internet and the control port). nftables masquerade, `dnsmasq` (`ana.example`,
  `web-01`, `web-02`, `laptop`, `acme.gw`), and Pebble.
- **Every other VM has one card, on the LAN.** `ip -br addr` on `web-01`: `lo` and
  `ens3 192.0.2.10/24`; `ip route`: `default via 192.0.2.1`. The control path is `ssh -J` through
  `gw`, never a card of the VM's own, so no frame shows the machinery.
- Internet: plain HTTP passes; HTTPS passes once the VM trusts this environment's egress proxy CA,
  which re-signs TLS. That CA is added off screen by cloud-init (`ca_certs`), in the base layer:
  `/usr/local/share/ca-certificates/cloud-init-ca-cert-1.crt` on Debian. No frame may list that
  directory. apt's own trust (signed Release files) is unaffected.

## 4. State: resume a running VM, don't reboot it

- A disk overlay per step works: after `fstrim`, a small step (add a user) is 12 MiB raw,
  **2.4 MiB** zstd-compressed (`qemu-img convert -c -B parent`). The first step (first boot,
  `apt update`, nginx) is 89 MiB.
- But **rebooting between steps is wrong for this course**: Pebble makes a new root CA on every
  start (every later HTTPS step would break), and uptime, PIDs and the journal would restart in
  every section, where a real server runs continuously.
- **`savevm` / `-loadvm` works under TCG**: save 3 s; resume to SSH in **7 s** (a boot is 96 s);
  `uptime` continued (9 min → 9 min), a background process kept its PID and kept running, the clock
  resumed where it paused (`clock=vm`). The course reboots only when a section reboots.
- Size: 315 MiB of RAM state per VM (1.5 GiB guest); **88 MiB** zstd-compressed. Dropping caches
  first does not help (freed pages keep their contents). Open: virtio-balloon free page reporting,
  which hands freed pages back as zeroes.
- Consequence: at ~47 steps × 3–4 VMs, saved RAM is ~10+ GB — **not for git**. Disk overlays
  (MBs) can be committed; RAM states need a home outside git. **Owner decision** (§8).

## 5. Families, measured (corrects the plan's table)

| point | Debian 13 (cloud image) | Rocky Linux 10.2 (cloud image) |
| --- | --- | --- |
| admin group | `sudo` (gid 27) | `wheel` (gid 10) |
| `adduser` | a Perl script (interactive) | a symlink to `useradd` |
| SSH unit | `ssh.service`; `sshd.service` is an alias | `sshd.service` only |
| nginx layout | `sites-available/default` + empty `conf.d/` | `conf.d/` only |
| nginx worker user | `www-data` | `nginx` |
| nginx default root | `/var/www/html` | `/usr/share/nginx/html`; no `/var/www` |
| firewall | **nftables not installed** | **firewalld not installed** |
| automatic updates | **`unattended-upgrades` already installed** | `dnf-automatic` not installed |
| system log | journal only: no rsyslog, no `/var/log/syslog` | rsyslog: `/var/log/messages` |
| MAC | AppArmor loaded, 7 profiles enforcing | SELinux `Enforcing` |
| package lists on a fresh image | none until `apt update` | — |
| `ls -l` | no trailing mark | `.` after the mode (SELinux context) |

Plan consequences: §3.5 inspects `unattended-upgrades` (already there) instead of installing it;
§5.8 installs nftables first; §3.2 is a natural `update` ≠ `upgrade` (a fresh image cannot install
anything before `update`).

## 6. SELinux (§5.9) — real

On `web-02`: files with correct rwx; nginx answers **403**; `ausearch -m avc` shows the denial
(`scontext=…httpd_t`, `tcontext=…var_t`, `getattr`, `permissive=0`); `semanage fcontext -a -t
httpd_sys_content_t` + `restorecon -Rv` relabels; `curl` serves the page. The realistic triggers,
both measured: a new `/var/www/ana.example` is `var_t` (Rocky has no `/var/www` for nginx), and a file
`mv`d from the home directory keeps `user_home_t` (`cp` would take the target's label). The section
uses the `mv`: it is the mistake people actually make.

## 7. HTTPS (§5.7) — real certbot, local CA

- Pebble 2.6.0 from Debian trixie (`apt install pebble`) on `gw`, `acme.gw:14000`, its listener
  certificate signed by a lab CA the servers trust (off screen). HTTP-01 validated against `web-01`
  through `dnsmasq`.
- `sudo certbot --nginx -d ana.example --server https://acme.gw:14000/dir -m … --agree-tos -n`:
  "Successfully received certificate", deployed into `sites-enabled/default`; the chain is
  `Pebble Intermediate CA` → `Pebble Root CA`.
- Pebble's default validity is 5 years; `certificateValidityPeriod: 7776000` makes it Let's Encrypt's
  90 days (accepted; re-issue to confirm in part 2).
- Pebble's root must be trusted where the course `curl`s the site (`laptop`, `web-01`), off screen —
  the role the public trust store plays for Let's Encrypt. It stays valid only while `gw` is never
  restarted: §4's resume model.
- On screen, the `--server` flag is the stand-in's one visible trace; the frame says so.

## 8. Decisions for the owner

1. **Where saved VM states live.** Disk overlays (MBs per step) can be committed. RAM states (~88 MiB
   per VM per step, until balloon free-page reporting is tried) cannot. Options: GitHub release
   assets per course; Git LFS; or a bucket. Without them, a fresh cloud session must re-record from
   the last state it has.

## 9. Part 2 (open)

- One recorder (`scripts/record.py`): steps as `step.json` + typed commands, `savevm` per step, the
  transcript checked like the other repos' `check:spine`.
- `laptop` VM; hide `sr0` / the seed; balloon free-page reporting; confirm Pebble's 90 days.
- graphl-flow 0.7.0: `console` (both prompt forms, root `#`, folds, addressable lines), `tty`
  (with inverse video from pyte's attributes), ini / nginx / nftables highlighting, icons, the
  console-frame study.
- The macOS capture script for the owner.
