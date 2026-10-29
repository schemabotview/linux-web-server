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
- Rocky Linux: sudo's first-use lecture is shown once, in access/01-root-sudo/rocky; later Rocky
  sections record (in setup) that Ana has already seen it.
- The setup channel is the QEMU guest agent, so `qemu-ga` shows in `ps`/`pstree` (services/01).
  A provider's agent; never a login.
- Timings (boot 1 min 37 s in `systemd-analyze`, apt/dnf speeds) are an emulated VM's: never quoted.

## services/04-enable-start — the reboot

Once (of three captures) the laptop's ssh reported `Bad packet length … Connection corrupted` when
web-01 rebooted, an artifact of the link between the VMs. A real reboot reads `Connection to
192.0.2.10 closed by remote host.`, as the committed capture does. If the artifact appears, re-capture.
