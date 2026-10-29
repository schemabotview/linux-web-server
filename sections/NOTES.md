# Notes for the owner

Things the real output showed that a section's content depends on. Each says what was captured,
why it matters, and the options. Nothing here is faked: a choice is the owner's.

## software/02-update-upgrade — nothing to upgrade

The pinned Debian image (2026-10-26) was current on the day it was captured: `apt list
--upgradable` is empty and `apt upgrade` reports `Upgrading: 0`. True, but it does not show
`update` ≠ `upgrade` (index refreshed vs packages replaced). Options:

1. Keep it and let the narration say so: a fresh server is current; one running a few weeks is not.
2. Capture this section from an older pinned Debian 13 image (still real, still Debian 13), labelled.
3. Re-capture it later, once Debian has published updates since 2026-10-26.

## All sections

- A server sees the laptop's logins as coming from 192.0.2.1, not 192.0.2.100 (each VM has its own
  network). Never quoted.
- Every section's VMs start at 09:30 on 2026-11-02, on one clock (a certificate one VM issues is
  valid on the other). Build-time entries (boot, cloud-init) are from 09:00.
- A closed port tested FROM THE LAPTOP looks like a connection that opens and drops (`curl: (35)`,
  `Empty reply`), not `Connection refused`: the link between the VMs accepts it first. Sections
  test closed ports on the server itself; a firewall's DROP (a timeout) reads truthfully.
- Rocky Linux: sudo's first-use lecture is shown once, in access/01-root-sudo/rocky; later Rocky
  sections record (in setup) that Ana has already seen it.
- The setup channel is the QEMU guest agent, so `qemu-ga` shows in `ps`/`pstree` (services/01).
  A provider's agent; never a login.
- Timings (boot 1 min 37 s in `systemd-analyze`, apt/dnf speeds) are an emulated VM's: never quoted.

## services/04-enable-start — the reboot

Once (of three captures) the laptop's ssh reported `Bad packet length … Connection corrupted` when
web-01 rebooted, an artifact of the link between the VMs. A real reboot reads `Connection to
192.0.2.10 closed by remote host.`, as the committed capture does. If the artifact appears, re-capture.

## web/07-https — the local CA

Real certbot 4.0 against Pebble (the local ACME CA standing in for Let's Encrypt) on web-01 itself,
at `https://localhost:14000/dir`: that `--server` flag is the one visible trace, and the frame
labels it. The chain reads `Pebble Intermediate CA` → `Pebble Root CA`; validity is 90 days, as
Let's Encrypt's. The VMs trust Pebble's root off screen (the public trust store's role).

## automate/07-logrotate — the Debian 13 cloud image has no logrotate

Real finding: `logrotate` is not installed on the genericcloud image, though nginx ships
/etc/logrotate.d/nginx — so its logs would never rotate. The section shows `command not found`,
installs it, and rotates. Worth a line in the narration: it is the kind of thing a review finds.

## operate/06-kernel — no kernel update to install

Same root as software/02: the image runs 6.12.113, Debian 13's newest security kernel; nothing is
pending and /run/reboot-required is absent. The only newer kernel is 7.2.11 in trixie-backports,
which is not how a security update arrives. Options: narrate the mechanism over this real output;
capture from an older pinned image; or re-capture after Debian's next kernel update.

## Scene-only sections (no console to capture)

first-login/01 (the finished server, recorded last) and operate/07 (the runbook and "where next")
are the server map and narration; they quote output already captured elsewhere.
