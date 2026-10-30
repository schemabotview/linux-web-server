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
output out. All 7 courses are captured (`first-login` 01 comes last); open questions for the owner
are in `sections/NOTES.md`.

App scaffolded 2026-10-30 (graphl-flow ^0.7.0, shell ^1.0.4). **Pilot rendered, awaiting the
owner's review** (COURSE-PLAN.md, Build order 4): Course 2 `access` (6 console frames) and ◆ Boot
(`services-boot`, a full scene), narrated, checked at 4K and looked at. No audio yet; the server
map (`first-login/01`) is not built.

## Commands

```sh
npm run dev                                      # the app, :5173 — #/access-root-sudo, ?capture=1
npm run build && npx tsc --noEmit                # build + typecheck
npm run check                                    # check-content + check-render (every section at 4K)
npm run check:captures                           # every console IS a capture; lists captures not drawn yet
npm run shots -- access                          # 4K PNGs in out/shots/ — then LOOK
```

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
  (nginx installed, a user added) goes in its `setup`, run as root OFF screen through the QEMU guest
  agent — never a login, so no root key and nothing in the auth log. The agent is the one trace:
  `qemu-ga` in `ps`/`pstree` (a provider's agent; on Rocky its own SELinux domain is permissive,
  everything else enforcing). On Debian a setup
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
- `{"pause": N}` waits N seconds typing nothing (a reboot); a server's ports 22, 80, 443 and 8080
  are reachable from the laptop. Test a CLOSED port on the server itself (from the laptop it reads
  as a dropped connection, not "refused").
- Every section's VMs share one clock, set to 09:30 at the start.
- Ana's terminal logs in with her password; a section whose setup turns passwords off (after §2.6)
  runs on the laptop and `ssh`es in with her key.
- A command that does not return in 15 minutes fails with the screen it is stuck on (a pager:
  `journalctl` needs `--no-pager`, or a `tty` item).
- `first-login/03-ssh` was captured by the earlier recorder (ssh from a laptop VM); it has no
  session to run.

## The app (details in `src/scenes/console.ts`)

- `src/content/<course>/index.ts` holds the sections and their narration; `src/scenes/<course>/` the
  scenes, which import captures with `?raw` (`sections/…/output.txt`, `second.txt`). A console is
  NEVER typed: `check:captures` fails a console whose text is not a capture, byte for byte.
- `consoleFrame({ left, picture, edges })`: the console (760 × 1090, 43 rows of 80) | the picture
  (fixed width, `spread`). Sizes are graphl-flow 0.7's console-frame study. Every frame shares one
  fit (check-render). Edges only inside the picture; the picture must hold an edge or a table and
  fill ≥ 2/3 of its column — a few cards at the top was the first draft of three frames.
- Rows are found by TEXT (`rowOf`, `rowsFrom`), never typed numbers. A needle can match the COMMAND
  that searched for it: `grep -g 'Run /init|…'` contains `Run /init`, and Boot's first highlights lit
  the command row with every check green. Use a needle only the output row has (`kernel: Run /init`).
- `fold(text, [first, last], …)` folds runs to `··· N lines`: long output into 43 rows, and any row a
  scene must not quote (the `Last login … from` row in `access/06`).
- `familyCard(id, 'rocky', console)`: the Red Hat family's real output inside the picture.
- A ◆ full scene has no fixed fit: it is height-bound around a console, so a console of ~40 rows
  drops body text under 24px. Fold rows the picture already shows (Boot folds the journal's echo of
  `/proc/cmdline`).

## Invariants (from the plan)

- Every output is real, from a real VM (`web-01` Debian 13, `web-02` Rocky Linux 10), or
  from the owner's macOS capture. Never a container for a server: it shows the host's kernel.
- What is a stand-in says so on screen (the local ACME CA, "a VM", "macOS, not captured").
- Taught on Debian; the other family appears as a family card, from real output.
- No IDE: console frame (console left, picture right), server map, ◆ full scene.
- Never write `x`/`y`; scenes are declarative.
- Stylesheets in order: graphl-flow, shell, `./theme.css` last.
- Narration: `.tts` → `.wav` via Colab + Chatterbox only. Audio at `public/audio/<course>/<id>.wav`.
