#!/usr/bin/env python3
"""The simulator: one real VM, commands in, real output out.

  python3 scripts/sim.py up [web-01|web-02]        start the VM (the first time: build it, ~5–10 min)
  python3 scripts/sim.py run first-login/04-commands   capture a section's real output
  python3 scripts/sim.py sh web-01 'ls -l /etc'    one command as ana, its real output on stdout
  python3 scripts/sim.py down [web-01|web-02]      stop the VM

web-01 is Debian 13, web-02 Rocky Linux 10, both from the official cloud images pinned below, under
QEMU. The first `up` boots the image, sets it up with cloud-init as a fresh VPS (user `ana` with the
provider's password, in sudo/wheel) and saves a snapshot, `fresh`. Every `run` starts from `fresh`,
so a section never depends on what ran before it.

A section is sections/<course>/<NN-id>/section.json:

  {"vm": "web-01",                          which VM (default web-01)
   "setup": ["apt-get install -y nginx"],   run first, as root, OFF screen: what the section assumes
   "session": [                             typed in Ana's terminal (80 × 44), ON screen:
     "ls -l",                                 a command; done when the prompt comes back
     {"type": "sudo passwd ana",              a command that asks: answers are typed (echoed)
      "answer": [["password: $", "@password"]]},   @password: the provider's, never echoed
     {"tty": "man ls", "after": 4,            a full-screen program: its screen after N seconds
      "quit": "q", "name": "man-ls"}            into <name>.tty.json, then quit it
   ]}

Output beside it: output.txt (the terminal, row for row) and any <name>.tty.json. `[sudo] password`
is always answered. Nothing here is a container: `uname`, `ip addr`, `lsblk`, the boot log are the VM's.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shlex
import socket
import subprocess
import sys
import time
from pathlib import Path

import pexpect
import pyte

REPO = Path(__file__).resolve().parent.parent
MACHINE = REPO / '.machine'              # images, disks, keys — never committed
SECTIONS = REPO / 'sections'
KEY = MACHINE / 'sim_key'                # root's key: setup only, never on screen
PASSWORD = 'mango-river-4821'            # the provider's password for ana; never echoed
CLOCK = '2026-11-02T09:00:00'            # every VM's clock starts here: dates in output are stable
COLS, ROWS = 80, 44

IMAGE = {
    'debian': ('https://cloud.debian.org/images/cloud/trixie/20261026-2643/'
               'debian-13-genericcloud-amd64-20261026-2643.qcow2', 'sha512',
               '3ace18e33bdd036edb49d1f79342bd01d2ab980e35194edb0b410435cd543538'
               'd286a0bd13bbb0835f7862306e3d385ce2f6a70d8ecf0bd961111166adbc1b8e'),
    'rocky': ('https://dl.rockylinux.org/pub/rocky/10/images/x86_64/'
              'Rocky-10-GenericCloud-Base-10.2-20260525.0.x86_64.qcow2', 'sha256',
              '9fc9e9ff16888bb68ac39b0392e25c9c92684d50c85f1cce6ab549363bbc4b48'),
}
VMS = {
    'web-01': {'image': 'debian', 'ip': '192.0.2.10', 'port': 2210},
    'web-02': {'image': 'rocky', 'ip': '192.0.2.20', 'port': 2220},
}
# Debian: ana@web-01:~$   Red Hat: [ana@web-02 ~]$   root: # in both
PROMPT = re.compile(rb'(?:\S+@[\w.-]+:[^\r\n]*|\[\S+@[\w.-]+ [^\]\r\n]*\])[$#] $')
SUDO = re.compile(rb'\[sudo\] password for \w+: $')


def sh(*cmd: str, **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, text=True, capture_output=True, **kw)


# ---------------------------------------------------------------- the VM

def image(kind: str) -> Path:
    url, algo, want = IMAGE[kind]
    path = MACHINE / 'images' / url.rsplit('/', 1)[1]
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        part = path.with_suffix('.part')
        for attempt in range(5):  # a proxy may cut a long transfer; curl resumes
            if subprocess.run(['curl', '-sSfL', '-C', '-', '-o', str(part), url]).returncode == 0:
                break
            time.sleep(2 ** attempt)
        part.rename(path)
    h = hashlib.new(algo)
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    if h.hexdigest() != want:
        path.unlink()
        raise SystemExit(f'{path.name}: {algo} mismatch — deleted, run again')
    return path


def egress_cas() -> list[str]:
    """In a Claude cloud session HTTPS is re-signed by Anthropic's egress CAs: the VM must trust them
    to install packages. Anywhere else there are none."""
    bundle = Path('/root/.ccr/ca-bundle.crt')
    if not os.access(bundle, os.R_OK):
        return []
    pems = dict.fromkeys(re.findall(r'-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----',
                                    bundle.read_text(), re.S))
    return [p for p in pems if 'O = Anthropic' in sh('openssl', 'x509', '-noout', '-subject', input=p).stdout]


def user_data(name: str) -> str:
    rocky = VMS[name]['image'] == 'rocky'
    pub = KEY.with_suffix('.pub').read_text().strip()
    cas = ''.join('    - |\n' + ''.join(f'      {line}\n' for line in pem.splitlines()) for pem in egress_cas())
    return (f'#cloud-config\nhostname: {name}\nfqdn: {name}\n'
            f'users:\n  - name: ana\n    shell: /bin/bash\n    groups: [{"wheel" if rocky else "sudo"}]\n'
            f'    sudo: "ALL=(ALL) ALL"\n    lock_passwd: false\n'
            f'ssh_pwauth: true\nchpasswd:\n  expire: false\n  users:\n    - {{name: ana, password: "{PASSWORD}", type: text}}\n'
            f'disable_root: false\nssh_authorized_keys: ["{pub}"]\n'
            + (f'ca_certs:\n  trusted:\n{cas}' if cas else '')
            + 'runcmd:\n  - [touch, /etc/cloud/cloud-init.disabled]\n')


class VM:
    def __init__(self, name: str):
        if name not in VMS:
            raise SystemExit(f'no VM {name!r}: one of {", ".join(VMS)}')
        self.name, self.spec = name, VMS[name]
        self.dir = MACHINE / name
        self.disk, self.mon = self.dir / 'disk.qcow2', self.dir / 'monitor'

    def running(self) -> bool:
        try:
            self.hmp('info status')
            return True
        except OSError:
            return False

    def start(self, extra: list[str]) -> None:
        net = (f'user,id=net,net=192.0.2.0/24,host=192.0.2.1,dhcpstart={self.spec["ip"]},'
               f'hostfwd=tcp:127.0.0.1:{self.spec["port"]}-:22')
        self.mon.unlink(missing_ok=True)
        subprocess.Popen(
            ['qemu-system-x86_64', '-nodefaults', '-vga', 'std', '-accel', 'tcg,thread=multi', '-cpu', 'max',
             '-smp', '2', '-m', '1536', '-name', self.name,
             '-drive', f'file={self.disk},if=none,id=disk,discard=unmap',
             '-device', 'virtio-blk-pci,drive=disk,addr=0x4',
             '-netdev', net, '-device', 'virtio-net-pci,netdev=net,mac=52:54:00:00:02:10,addr=0x3',
             '-rtc', f'base={CLOCK},clock=vm', '-display', 'none',
             '-serial', f'file:{self.dir / "serial.log"}', '-monitor', f'unix:{self.mon},server,nowait', *extra],
            stdout=open(self.dir / 'qemu.log', 'w'), stderr=subprocess.STDOUT, start_new_session=True)
        for _ in range(100):
            if self.mon.exists():
                return
            time.sleep(0.1)
        raise SystemExit(f'{self.name}: qemu did not start: {(self.dir / "qemu.log").read_text()}')

    def hmp(self, cmd: str, timeout: float = 600) -> str:
        s = socket.socket(socket.AF_UNIX)
        s.connect(str(self.mon))
        s.settimeout(timeout)
        out = b''
        while b'(qemu) ' not in out:
            out += s.recv(65536)
        s.sendall(cmd.encode() + b'\n')
        out = b''
        while not out.rstrip().endswith(b'(qemu)'):
            chunk = s.recv(65536)
            if not chunk:
                break
            out += chunk
        s.close()
        return out.decode(errors='replace')

    def ssh(self, user: str = 'root') -> list[str]:
        return ['ssh', '-q', '-i', str(KEY), '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                '-o', 'ConnectTimeout=10', '-p', str(self.spec['port']), f'{user}@127.0.0.1']

    def wait_ssh(self, timeout: int = 1200) -> None:
        t0 = time.time()
        while subprocess.run(self.ssh() + ['-o', 'BatchMode=yes', 'true'], capture_output=True).returncode:
            if time.time() - t0 > timeout:
                raise SystemExit(f'{self.name}: no ssh after {timeout}s (see {self.dir / "serial.log"})')
            time.sleep(3)

    def build(self) -> None:
        """First boot from the pinned image with a cloud-init seed; then the snapshot `fresh`."""
        self.dir.mkdir(parents=True, exist_ok=True)
        if not KEY.exists():
            sh('ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', 'sim', '-f', str(KEY))
        seed = self.dir / 'seed'
        seed.mkdir(exist_ok=True)
        (seed / 'user-data').write_text(user_data(self.name))
        (seed / 'meta-data').write_text(f'instance-id: {self.name}\nlocal-hostname: {self.name}\n')
        iso = self.dir / 'seed.iso'
        sh('genisoimage', '-quiet', '-output', str(iso), '-volid', 'cidata', '-joliet', '-rock',
           str(seed / 'user-data'), str(seed / 'meta-data'))
        self.disk.unlink(missing_ok=True)
        sh('qemu-img', 'create', '-q', '-f', 'qcow2', '-F', 'qcow2', '-b', str(image(self.spec['image'])),
           str(self.disk), '10G')
        t0 = time.time()
        self.start(['-drive', f'file={iso},if=none,id=seed,readonly=on,format=raw',
                    '-device', 'virtio-blk-pci,drive=seed,id=seedblk,addr=0x9'])
        log = self.dir / 'serial.log'
        while 'finished at' not in (log.read_text(errors='replace') if log.exists() else ''):
            if time.time() - t0 > 1800:
                raise SystemExit(f'{self.name}: cloud-init did not finish (see {log})')
            time.sleep(5)
        self.wait_ssh()
        # The seed goes before the snapshot: a snapshot needs every disk writable, and a VPS has one disk.
        self.hmp('device_del seedblk')
        while 'seedblk' in self.hmp('info pci') or 'seed' in self.hmp('info block'):
            time.sleep(1)
        self.hmp('savevm fresh')
        print(f'{self.name}: built and saved as `fresh` ({time.time() - t0:.0f}s)', flush=True)

    def up(self) -> None:
        if self.running():
            return
        if not self.disk.exists() or 'fresh' not in sh('qemu-img', 'snapshot', '-l', str(self.disk)).stdout:
            return self.build()
        self.start(['-loadvm', 'fresh'])
        self.wait_ssh(300)

    def reset(self) -> None:
        self.hmp('loadvm fresh')
        self.wait_ssh(300)

    def down(self) -> None:
        if self.running():
            self.hmp('quit', timeout=30)


# ---------------------------------------------------------------- Ana's terminal

class Terminal:
    """An 80 × 44 terminal logged in as ana, drawn by a VT100 emulator, as Ana's window shows it."""

    def __init__(self, vm: VM):
        # ana logs in with her password, as on a fresh VPS (she has no key until the course gives her one)
        args = vm.ssh('ana')[1:] + ['-tt', '-o', 'PubkeyAuthentication=no', '-o', 'PreferredAuthentications=password']
        self.child = pexpect.spawn('ssh', args, dimensions=(ROWS, COLS), env={**os.environ, 'TERM': 'xterm'},
                                   timeout=1800)
        self.stream = bytearray()
        self.wait([(re.compile(rb'password: $'), '@password')], keep=False)   # the login is not the section's
        self.stream = bytearray(self.tail)

    def read(self, timeout: float) -> bytes:
        try:
            return self.child.read_nonblocking(65536, timeout=timeout)
        except pexpect.TIMEOUT:
            return b''

    def wait(self, answers: list[tuple[re.Pattern, str]], keep: bool = True) -> None:
        buf, deadline = bytearray(), time.time() + 1800
        while time.time() < deadline:
            chunk = self.read(1)
            if not chunk:
                continue
            buf += chunk
            if keep:
                self.stream += chunk
            tail = bytes(buf[-300:])
            if m := PROMPT.search(tail):
                self.tail = tail[m.start():]
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
        """A full-screen program: its own screen, kept out of output.txt (the alternate screen)."""
        self.child.send(item['tty'] + '\r')
        echo = bytearray()
        while b'\n' not in echo:
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
        self.wait([], keep=False)
        self.stream += self.tail

    def output(self) -> str:
        screen = pyte.HistoryScreen(COLS, ROWS, history=100000, ratio=1)
        screen.set_mode(pyte.modes.LNM)
        pyte.ByteStream(screen).feed(bytes(self.stream))
        rows = [''.join(r[x].data for x in range(COLS)) for r in screen.history.top] + list(screen.display)
        # a row that filled all 80 columns wrapped: keep its width, strip every other row
        rows = [r if len(r.rstrip()) == COLS else r.rstrip() for r in rows]
        while rows and not rows[-1]:
            rows.pop()
        return '\n'.join(rows) + '\n'


# ---------------------------------------------------------------- commands

def run(section: str) -> None:
    out = SECTIONS / section
    spec = json.loads((out / 'section.json').read_text())
    if 'session' not in spec:
        raise SystemExit(f'{section}: nothing to run — {spec.get("captured", "no session")}')
    vm = VM(spec.get('vm', 'web-01'))
    vm.up()
    vm.reset()
    t0 = time.time()
    for line in spec.get('setup', []):
        r = subprocess.run(vm.ssh() + [line], capture_output=True, text=True)
        if r.returncode:
            raise SystemExit(f'setup failed: {line}\n{r.stdout}{r.stderr}')
    term = Terminal(vm)
    for item in spec['session']:
        term.run(item, out)
    term.child.close()
    (out / 'output.txt').write_text(term.output())
    print(f'{section}: {out / "output.txt"} ({time.time() - t0:.0f}s)')


if __name__ == '__main__':
    cmd, args = (sys.argv[1], sys.argv[2:]) if len(sys.argv) > 1 else ('', [])
    if cmd == 'up':
        for name in args or ['web-01']:
            VM(name).up()
    elif cmd == 'down':
        for name in args or list(VMS):
            VM(name).down()
    elif cmd == 'run' and args:
        for s in args:
            run(s)
    elif cmd == 'sh' and len(args) == 2:
        vm = VM(args[0])
        vm.up()
        sys.exit(subprocess.run(vm.ssh() + [f'su - ana -c {shlex.quote(args[1])}']).returncode)
    else:
        raise SystemExit(__doc__)
