# Session handoff — linux-web-server

Written 2026-10-30 for whoever continues this, on any account. Branch:
`claude/optimistic-hopper-4l5fgg` (last pushed commit before this file: `3ad69f8`). Read `CLAUDE.md`
first, then `COURSE-PLAN.md` (the source of truth), then `sections/NOTES.md` (open questions).

## Where things stand

- **The simulator works**: `scripts/sim.py`, one file. Real VMs under QEMU (`web-01` Debian 13,
  `web-02` Rocky Linux 10, `laptop` Debian 13), commands in, real output out. No containers.
- **All 7 courses are authored and captured**: 52 `output.txt` files under `sections/<course>/<NN-id>/`,
  each beside the `section.json` that produced it. Rocky Linux family cards live in `…/rocky/`.
- **Not done**: narration (needs the owner's `.tts` format: ask for an example), the app scaffold
  (waits on graphl-flow 0.7.0 being on npm), `first-login/01` and `operate/07` (scene-only, no console),
  the owner's macOS capture (`scripts/macos-capture.sh`, run by the owner on a Mac).

## How we got here (so you don't redo it)

1. The spike built a four-VM recorder with saved running states chained step to step, published as
   GitHub release assets. Cloud sessions cannot write releases (the proxy answers 403), a GitHub
   workflow was added to publish them, and the owner then said: **too much — we need a simulator
   that gives proper outputs to author with trust.** All of that was removed (`git log` has it).
   Do not bring back state chains, releases, or the workflow.
2. The release `states` on GitHub is unused leftover; the owner may delete it.
3. `RELEASE_TOKEN` is no longer needed for anything.

## Starting in a fresh cloud session

```sh
sudo apt-get install -y qemu-system-x86 qemu-utils genisoimage zstd openssh-client socat
pip install -r scripts/requirements.txt
python3 scripts/sim.py up web-01 laptop &  python3 scripts/sim.py up web-02 &  wait
#   first build: ~2.5 min Debian, ~5–7 min Rocky (in parallel ~7 min). Disks in .machine/ (not committed)
python3 scripts/sim.py sh web-01 'uname -a'          # one command as ana (~5 s)
python3 scripts/sim.py run access/03-permissions     # one section (5–25 s; laptop/reboot ones longer)
python3 scripts/sim.py down
```

Re-capture everything (≈30 min, two batches in parallel so Debian and Rocky overlap):

```sh
ALL=$(find sections -name section.json -printf '%h\n' | sed 's|^sections/||' | grep -v '03-ssh$' | sort)
python3 scripts/sim.py run $(echo "$ALL" | grep -v rocky | grep -v '04-rocky-nginx\|09-selinux') &
python3 scripts/sim.py run $(echo "$ALL" | grep -E 'rocky|09-selinux') &
wait
```

A failed section prints `FAILED — …` with the screen it was stuck on; the others still run.
The machine here had 4 cores and 16 GB; no KVM, so QEMU emulates (TCG). Builds need ~2 GB disk.

## How a section works (details in `CLAUDE.md` and the docstring of `scripts/sim.py`)

- Each `run` resets its VMs to the snapshot `fresh` and sets one clock (09:30, 2026-11-02) on all
  of them, so a section never depends on another.
- `setup` runs as root OFF screen through the QEMU guest agent (never a login: nothing in auth logs).
  Steps can run `on` another VM; `pipe` passes the previous step's output (a key made on the laptop,
  put on web-01). Debian setups that install packages start with `apt-get update`.
- `session` is typed in Ana's 80 × 44 terminal: strings, `answer` for prompts (`@password` never
  echoed), `tty` for full-screen programs, `window` for a second terminal, `pause` for a reboot.
- `with` names the other VMs a laptop section uses (they reset too).

## Rules learned the hard way (each one cost a re-capture)

- `systemctl status/cat/show/list-*`, `journalctl`, `systemd-analyze` page their output: always
  `--no-pager` (or the command hangs until the 15-minute limit).
- Test a **closed port on the server itself**. From the laptop, a closed port reads as an opened
  then dropped connection (`curl: (35)`, empty reply), not `Connection refused` — an artifact of the
  link between VMs. A firewall DROP (a timeout) is truthful from the laptop.
- On Rocky, `curl http://localhost/` goes over IPv6 to the default server: use `127.0.0.1` with a
  `Host:` header.
- A server sees the laptop's logins as from `192.0.2.1`, not `192.0.2.100`. Never quote it.
- After §2.6's lockdown (passwords off) Ana's terminal cannot log in to web-01 directly: run such a
  section on the laptop and `ssh` in with her key (setup makes and installs it; see `operate/05`).
- Rocky: sudo's first-use lecture is shown once (`access/01-root-sudo/rocky`); later Rocky sections
  mark it seen in setup (`/var/db/sudo/lectured`).
- Use `curl -sS`, not `-s`, when a failure should be visible.
- Re-read every output after capture. Several first captures were real but wrong for the lesson
  (`grep ana` matching "Manager", `head` hiding the `uniq` point, the journal showing only itself).

## Changing the simulator

Anything in `user_data()`, `settle()` or the QEMU arguments needs a rebuild:
`python3 scripts/sim.py down; rm -rf .machine/web-01 .machine/web-02 .machine/laptop`, then `up`,
then re-capture everything (timestamps and package counts shift). The guest agent on Rocky runs in a
permissive SELinux domain of its own (a one-line `semodule`); everything else stays enforcing.

## Open decisions for the owner (`sections/NOTES.md`)

1. `software/02` and `operate/06`: the pinned image is current — nothing to upgrade, no kernel
   pending. Narrate over the real output, capture those two from an older pinned image, or wait.
2. The `192.0.2.1` login address (above).
3. `first-login/01` and `operate/07` are scene-only.

## Next steps, in order

1. Ask the owner for a `.tts` example; write narration per section from the captured output.
2. The owner's answers to the open decisions; re-capture what changes.
3. When graphl-flow 0.7.0 is on npm: scaffold the app (`COURSE-PLAN.md` → Build order 3), console
   frame and server map reading `sections/**/output.txt`.

The owner prefers small, direct steps: ask before adding machinery, and say plainly what is real,
what is a stand-in, and what failed.
