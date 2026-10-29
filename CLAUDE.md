# CLAUDE.md — linux-web-server

> Workspace invariants live in the workspace `CLAUDE.md`. This file is only what is true here.

## What this repo is

A GraphL concept app: **learn Linux by running your own web server**. Ana's Debian 13 server,
`web-01`, grows from a first SSH login to a hardened server serving `ana.example` over HTTPS. A
**section** is `(scene, narration)`: one full-screen 16:9 frame, one chapter of the video. It
replaces `linux-ct` (re-authored from scratch).

**`COURSE-PLAN.md` is the source of truth**: courses, sections, frames, the machine, the facts.
Change it first; never drift from it.

## Status

Plan agreed 2026-10-29. The simulator works (`scripts/sim.py`): one real VM, commands in, real
output out. Courses 1 (`first-login`, 02–07; 01 comes last) and 2 (`access`) are authored and
captured. The app is not scaffolded yet.

## Commands

```sh
python3 scripts/sim.py up [web-01|web-02|laptop] # start a VM (first time: build it, ~2–5 min)
python3 scripts/sim.py run first-login/04-commands   # capture a section's real output
python3 scripts/sim.py sh web-01 'ls -l /etc'    # one command as ana, real output (quick checks)
python3 scripts/sim.py down                      # stop the VMs
zsh scripts/macos-capture.sh                     # the owner, once, on a Mac
```

Needs `qemu-system-x86`, `qemu-utils`, `genisoimage`, `openssh-client`, and Python's `pexpect` and
`pyte` (`scripts/requirements.txt`). VM disks live in `.machine/` (never committed).

## The simulator (details in `scripts/sim.py`)

- `web-01` Debian 13 (192.0.2.10), `web-02` Rocky Linux 10 (192.0.2.20): the official cloud images,
  pinned, under QEMU, set up as a fresh VPS (`ana` with the provider's password, in sudo/wheel).
- Every `run` starts from the snapshot `fresh`: a section never depends on another. What it assumes
  (nginx installed, a user added) goes in its `setup`, run as root OFF screen. On Debian a setup
  that installs packages starts with `apt-get update` (a fresh image has no package lists).
- `sections/<course>/<NN-id>/section.json` = `vm` + `setup` + `session` (commands; `answer` for
  prompts — `@password` is never echoed; `tty` for a full-screen program). Output beside it:
  `output.txt` (the 80 × 44 terminal, row for row) and `<name>.tty.json`.
- `laptop` (Debian 13, 192.0.2.100) is Ana's laptop: from it, `ssh ana@192.0.2.10` reaches the real
  web-01 (and .20 web-02). A section on the laptop names its servers in `with`; `setup` steps can
  run `on` another VM, `pipe` passes one step's output to the next (a key made on the laptop, put on
  web-01); `{"window": "second"}` opens a second terminal (`second.txt`), as §2.6 tests a lockdown.
- Each VM has its own network, so a server sees the laptop's logins as coming from 192.0.2.1
  (`Last login: … from 192.0.2.1`, `who`, auth logs). Scenes and narration never quote that address.
- A command that does not return in 5 minutes fails with the screen it is stuck on (a pager:
  `journalctl` needs `--no-pager`, or a `tty` item).
- `first-login/03-ssh` was captured by the earlier recorder (ssh from a laptop VM); it has no
  session to run.

## Invariants (from the plan)

- Every output is real, from a real VM (`web-01` Debian 13, `web-02` Rocky Linux 10), or
  from the owner's macOS capture. Never a container for a server: it shows the host's kernel.
- What is a stand-in says so on screen (the local ACME CA, "a VM", "macOS, not captured").
- Taught on Debian; the other family appears as a family card, from real output.
- No IDE: console frame (console left, picture right), server map, ◆ full scene.
- Never write `x`/`y`; scenes are declarative.
- Stylesheets in order: graphl-flow, shell, `./theme.css` last.
- Narration: `.tts` → `.wav` via Colab + Chatterbox only. Audio at `public/audio/<course>/<id>.wav`.
