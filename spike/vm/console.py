#!/usr/bin/env python3
"""Spike: capture a real console session from a VM, as an 80-column terminal shows it.

  console.py <port> <cmd> [<cmd> ...]          type each command at a real interactive bash
  console.py <port> --tty '<cmd>' <keys> <s>   start a full-screen program, wait s seconds, snapshot

The raw byte stream goes through pyte (a VT100 emulator), so wrapping, carriage returns and
backspaces come out the way a real 80-column terminal draws them. A command is done when the shell's
real prompt (user@host:cwd$ or #) comes back.
"""
import re
import sys
import time

import pexpect
import pyte

COLS, ROWS = 80, 44
# Debian: ana@web-01:~$   Red Hat: [ana@web-02 ~]$   (root: # in both)
PROMPT = re.compile(rb'(\S+@[\w.-]+:[^\r\n]*|\[\S+@[\w.-]+ [^\]\r\n]*\])[$#] $')


def ssh(target: str) -> pexpect.spawn:
    """A port on 127.0.0.1 (a VM with its own forwarded port), or a LAN address reached through gw."""
    opts = ['-tt', '-q', '-i', 'key', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null']
    if target.startswith('192.0.2.'):
        opts += ['-o', 'ProxyCommand=ssh -q -i key -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null'
                       ' -p 2200 -W %h:%p ana@127.0.0.1', f'ana@{target}']
    else:
        opts += ['-p', target, 'ana@127.0.0.1']
    child = pexpect.spawn(
        'ssh', opts,
        dimensions=(ROWS, COLS), env={'TERM': 'xterm', 'LANG': 'C.UTF-8', 'PATH': '/usr/bin:/bin'},
        timeout=600)
    return child


def wait_prompt(child: pexpect.spawn, buf: bytearray) -> None:
    while True:
        try:
            buf += child.read_nonblocking(65536, timeout=600)
        except pexpect.TIMEOUT:
            raise SystemExit('no prompt after 600s')
        if PROMPT.search(bytes(buf[-200:])):
            return


def transcript(stream: bytes) -> list[str]:
    screen = pyte.HistoryScreen(COLS, ROWS, history=100000, ratio=1)
    screen.set_mode(pyte.modes.LNM)
    pyte.ByteStream(screen).feed(stream)
    lines = [''.join(ch.data for ch in (row[x] for x in range(COLS))) for row in screen.history.top]
    lines += screen.display
    lines = [l.rstrip() for l in lines]
    while lines and not lines[-1]:
        lines.pop()
    return lines


def session(port: str, cmds: list[str]) -> list[str]:
    child = ssh(port)
    buf = bytearray()
    wait_prompt(child, buf)
    start = len(buf)
    # The login banner (motd) is real but not every frame's; keep only from the last prompt on.
    last = [m.start() for m in PROMPT.finditer(bytes(buf))][-1]
    buf = buf[last:]
    for cmd in cmds:
        child.send(cmd + '\r')
        wait_prompt(child, buf)
    child.sendline('exit')
    return transcript(bytes(buf))


def tty(port: str, cmd: str, keys: str, secs: float) -> list[str]:
    child = ssh(port)
    buf = bytearray()
    wait_prompt(child, buf)
    screen = pyte.Screen(COLS, ROWS)
    stream = pyte.ByteStream(screen)
    child.send('clear; ' + cmd + '\r')
    end = time.time() + secs
    while time.time() < end:
        try:
            stream.feed(child.read_nonblocking(65536, timeout=0.5))
        except pexpect.TIMEOUT:
            pass
    rows = [l.rstrip() for l in screen.display]
    if keys:
        child.send(keys)
    child.sendcontrol('c')
    return rows


if __name__ == '__main__':
    port = sys.argv[1]
    if sys.argv[2] == '--tty':
        out = tty(port, sys.argv[3], sys.argv[4], float(sys.argv[5]))
    else:
        out = session(port, sys.argv[2:])
    print('\n'.join(out))
