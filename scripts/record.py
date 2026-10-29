#!/usr/bin/env python3
"""Record the spine: each step runs ONCE, from its parent's saved machine, and is never replayed.

  python3 scripts/record.py first-login/03-ssh     record one step (its parent must be recorded)
  python3 scripts/record.py --check                 every step recorded, current and untouched;
                                                    runs NOTHING (the frames' contract)

A step is spine/<course>/<NN-id>/step.json:

  {"from": "base",                         the parent step ("base", or "<course>/<NN-id>")
   "full": true,                           keep a full RAM copy, not a delta (only if a chain of
                                           deltas ever restores too slowly: ~2 s a VM a step)
   "session": [                            what Ana types at the laptop's console, in order:
     "ls -l",                                a command; done when a shell prompt comes back
     {"type": "ssh web-01",                  a command that asks questions on the way:
      "answer": [["fingerprint\\])\\? $", "yes"],      the answer is TYPED and echoed (on screen)
                 ["password: $", "@password"]]},       @password: the provider's, never echoed
     {"tty": "top -d 1", "after": 4,         a full-screen program: snapshot its screen after N
      "quit": "q", "name": "top"}            seconds into <name>.tty.json, then quit it
   ]}

`[sudo] password for ana:` is always answered with the provider's password (sudo never echoes it).

Outputs beside step.json: session.txt (the transcript, row for row as an 80-column terminal drew it),
<name>.tty.json, and recorded.json (the step's key, the transcript's hash, the states' hashes).
A step's KEY hashes its step.json and its parent's key: edit a step and it, and everything after
it, must be re-recorded. The states themselves live in .machine/states (release assets).
"""
from __future__ import annotations

import hashlib
import json
import re
import socket
import sys
import time
from pathlib import Path

import pyte
from pexpect import TIMEOUT, fdpexpect

sys.path.insert(0, str(Path(__file__).parent))
from base import PASSWORD  # noqa: E402
from machine import REPO, STATES, TERM, cleanup, resume, save_state, sh, ssh_args, wait_ssh  # noqa: E402

SPINE = REPO / 'spine'
COLS, ROWS = 80, 44
# Debian / laptop: ana@web-01:~$   Red Hat: [ana@web-02 ~]$   root: # in both
PROMPT = re.compile(rb'(?:\S+@[\w.-]+:[^\r\n]*|\[\S+@[\w.-]+ [^\]\r\n]*\])[$#] $')
SUDO = re.compile(rb'\[sudo\] password for \w+: $')


def step_json(step: str) -> dict:
    return json.loads((SPINE / step / 'step.json').read_text())


def chain_of(step: str) -> list[str]:
    out = [step]
    while out[-1] != 'base':
        out.append(step_json(out[-1])['from'])
    return out[::-1]


def key_of(step: str) -> str:
    if step == 'base':
        return 'base'
    canon = json.dumps(step_json(step), sort_keys=True, separators=(',', ':'))
    return hashlib.sha256((key_of(step_json(step)['from']) + '\n' + canon).encode()).hexdigest()


class Console:
    """Ana's terminal on the laptop (its ttyS1), drawn by a VT100 emulator at 80 × 44."""

    def __init__(self) -> None:
        # The laptop's ttyS1: Ana's shell is already there, where the last step left it (on web-01,
        # perhaps). One Enter draws a fresh prompt, and the step's transcript starts at it.
        # The terminal emulator owns the window size: a serial line has none of its own (agetty
        # resets it to 24 × 80), so set 44 × 80 on attach, as a terminal window does. The kernel then
        # sends SIGWINCH to whatever runs there — Ana's ssh passes the size on to the server.
        wait_ssh('laptop', 300)
        sh(*ssh_args('laptop'), f'sudo stty -F /dev/ttyS1 rows {ROWS} cols {COLS}')
        self.sock = socket.socket(socket.AF_UNIX)
        self.sock.connect(str(TERM))
        self.child = fdpexpect.fdspawn(self.sock.fileno(), timeout=1800)
        self.stream = bytearray()          # what the transcript is drawn from
        self.child.send('\r')
        self.wait([], keep=False)
        self.stream = bytearray(self.tail)

    def read(self, timeout: float) -> bytes:
        try:
            return self.child.read_nonblocking(65536, timeout=timeout)
        except TIMEOUT:
            return b''

    def wait(self, answers: list[tuple[re.Pattern, str]], keep: bool = True) -> None:
        """Read until the shell's prompt returns, answering questions on the way."""
        buf = bytearray()
        deadline = time.time() + 1800
        while time.time() < deadline:
            chunk = self.read(1)
            if not chunk:
                continue
            buf += chunk
            if keep:
                self.stream += chunk
            tail = bytes(buf[-300:])
            if PROMPT.search(tail):
                self.tail = tail[PROMPT.search(tail).start():]
                return
            if SUDO.search(tail):
                self.child.send(PASSWORD + '\r'); buf.clear(); continue
            for pat, reply in answers:
                if pat.search(tail):
                    self.child.send((PASSWORD if reply == '@password' else reply) + '\r')
                    buf.clear()
                    answers = [a for a in answers if a[0] is not pat]
                    break
        raise SystemExit('no prompt after 30 minutes')

    def run(self, item: str | dict, out: Path) -> None:
        if isinstance(item, str):
            item = {'type': item}
        if 'tty' in item:
            return self.tty(item, out)
        self.child.send(item['type'] + '\r')
        self.wait([(re.compile(p.encode()), r) for p, r in item.get('answer', [])])

    def tty(self, item: dict, out: Path) -> None:
        """A full-screen program: its own screen, kept out of the transcript (as a terminal's
        alternate screen keeps it out of the scrollback)."""
        self.child.send(item['tty'] + '\r')
        echo = bytearray()
        while b'\n' not in echo:          # the typed command's echo belongs to the transcript
            echo += self.read(1)
        cut = echo.index(b'\n') + 1
        self.stream += echo[:cut]
        screen = pyte.Screen(COLS, ROWS)
        feed = pyte.ByteStream(screen)
        feed.feed(bytes(echo[cut:]))
        end = time.time() + item.get('after', 3)
        while time.time() < end:
            feed.feed(self.read(0.2))
        rows, inverse, bold = [], [], []
        for y in range(ROWS):
            line = screen.buffer[y]
            rows.append(''.join(line[x].data for x in range(COLS)).rstrip())
            for attr, runs in (('reverse', inverse), ('bold', bold)):
                x = 0
                while x < COLS:
                    if getattr(line[x], attr):
                        start = x
                        while x < COLS and getattr(line[x], attr):
                            x += 1
                        runs.append([y, start, x])
                    x += 1
        while rows and not rows[-1]:
            rows.pop()
        (out / f'{item["name"]}.tty.json').write_text(json.dumps(
            {'screen': rows, 'inverse': inverse, 'bold': bold}, indent=1) + '\n')
        self.child.send(item.get('quit', 'q'))
        self.wait([], keep=False)          # the program's own teardown is not transcript
        self.stream += self.tail

    def title(self) -> str:
        """The terminal's window title as bash last set it (`ana@web-01: ~`): the frame's title bar."""
        titles = re.findall(rb'\x1b\][02];([^\x07\x1b]*)(?:\x07|\x1b\\\\)', bytes(self.stream))
        return titles[-1].decode(errors='replace') if titles else ''

    def transcript(self) -> str:
        screen = pyte.HistoryScreen(COLS, ROWS, history=100000, ratio=1)
        screen.set_mode(pyte.modes.LNM)
        pyte.ByteStream(screen).feed(bytes(self.stream))
        rows = [''.join(r[x].data for x in range(COLS)) for r in screen.history.top] + list(screen.display)
        # A command row that filled all 80 columns WRAPPED: keep its width (the engine continues the
        # command on the next row because the row is exactly 80 wide). Strip every other row.
        rows = [r if len(r.rstrip()) == COLS else r.rstrip() for r in rows]
        while rows and not rows[-1]:
            rows.pop()
        return '\n'.join(rows) + '\n'


def record(step: str) -> None:
    spec = step_json(step)
    parent = spec['from']
    chain = chain_of(step)
    if parent != 'base':
        rec = SPINE / parent / 'recorded.json'
        if not rec.exists() or json.loads(rec.read_text())['key'] != key_of(parent):
            raise SystemExit(f'{parent} is not recorded (or changed since): record it first')
    if not (STATES / parent / 'state.json').exists():
        raise SystemExit(f'no saved machine for {parent}: fetch its release asset or record it')
    out = SPINE / step
    t0 = time.time()
    vms = resume(parent, chain)
    try:
        con = Console()
        for item in spec['session']:
            con.run(item, out)
        text, title = con.transcript(), con.title()
        con.sock.close()
        meta = save_state(step, parent, vms, full=bool(spec.get('full')), chain=chain)
    except BaseException:
        for vm in vms.values():
            vm.quit()
        raise
    finally:
        cleanup()
    (out / 'session.txt').write_text(text)
    (out / 'recorded.json').write_text(json.dumps({
        'key': key_of(step), 'from': parent, 'title': title,
        'session_sha': hashlib.sha256(text.encode()).hexdigest(), 'states': meta,
    }, indent=1) + '\n')
    print(f'{step}: recorded in {time.time() - t0:.0f}s')


def check() -> int:
    bad = 0
    steps = sorted(str(p.parent.relative_to(SPINE)) for p in SPINE.glob('*/*/step.json'))
    for step in steps:
        rec = SPINE / step / 'recorded.json'
        if not rec.exists():
            print(f'NOT RECORDED  {step}'); bad += 1; continue
        r = json.loads(rec.read_text())
        if r['key'] != key_of(step):
            print(f'STALE         {step}: it or a step before it changed — re-record it and what follows'); bad += 1
        text = (SPINE / step / 'session.txt').read_text()
        if hashlib.sha256(text.encode()).hexdigest() != r['session_sha']:
            print(f'EDITED        {step}: session.txt is not the recording'); bad += 1
    print(f'{len(steps) - bad} of {len(steps)} steps recorded and current' if steps else 'no steps')
    return 1 if bad else 0


if __name__ == '__main__':
    if sys.argv[1:] == ['--check']:
        sys.exit(check())
    for s in sys.argv[1:]:
        record(s)
