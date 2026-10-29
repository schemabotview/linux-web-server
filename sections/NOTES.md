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
