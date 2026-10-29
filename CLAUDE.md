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

Plan agreed 2026-10-29. Spike done (`SPIKE.md`): the recorder works and the chain's first two steps
are recorded (`first-login/03-ssh`, `04-commands`). The app is not scaffolded yet.

## Commands

```sh
python3 scripts/base.py                       # the chain's first state, from the pinned images (~15 min)
python3 scripts/record.py first-login/04-commands   # record a step from its parent's saved machine
python3 scripts/record.py --check             # every step recorded, current, untouched — runs NOTHING
python3 scripts/states.py pull <step>         # a fresh session: download the chain a step needs
python3 scripts/states.py push <step>…        # after recording: upload states (needs RELEASE_TOKEN)
zsh scripts/macos-capture.sh                  # the owner, once, on a Mac
```

Needs `qemu-system-x86`, `qemu-utils`, `genisoimage`, `zstd`, and Python's `pexpect` and `pyte`
(`scripts/requirements.txt`). States live in `.machine/` (never committed): release `states`, one
asset per step. RELEASE_TOKEN is a fine-grained token for this repo only (Contents: read and write),
set in the environment — never in a file or on a command line.

## The machine and the spine (details in `scripts/machine.py`, `record.py`, `SPIKE.md`)

- Four real VMs on one LAN: `gw` (the provider, never on screen), `web-01` Debian 13, `web-02`
  Rocky Linux 10, `laptop`. A step RESUMES all four from its parent's saved running state and saves
  them after; nothing reboots unless a section does.
- Every command on screen is typed at **Ana's terminal: the laptop's ttyS1**. Her shell and any ssh
  she has open are laptop state, so a section starts where the last one left her.
- `spine/<course>/<NN-id>/step.json` = `from` + `session` (commands; `answer` for prompts —
  `@password` is never echoed; `tty` for a full-screen program). Recorded once: `session.txt`,
  `<name>.tty.json`, `recorded.json` (key, transcript hash, states, the window title).
- Editing a step makes it and every step after it STALE: re-record them in order.
- First login is `ssh ana@192.0.2.10` with the provider's password: a single-label name like
  `web-01` goes to LLMNR, not DNS, on Debian (systemd-resolved).

## Invariants (from the plan)

- Every output is real, from a real VM (`web-01` Debian 13, `web-02` Rocky Linux 10, `laptop`), or
  from the owner's macOS capture. Never a container for a server: it shows the host's kernel.
- What is a stand-in says so on screen (the local ACME CA, "a VM", "macOS, not captured").
- Taught on Debian; the other family appears as a family card, from real output.
- No IDE: console frame (console left, picture right), server map, ◆ full scene.
- Never write `x`/`y`; scenes are declarative.
- Stylesheets in order: graphl-flow, shell, `./theme.css` last.
- Narration: `.tts` → `.wav` via Colab + Chatterbox only. Audio at `public/audio/<course>/<id>.wav`.
