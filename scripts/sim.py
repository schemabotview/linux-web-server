#!/usr/bin/env python3
"""The simulator: one real VM, commands in, real output out.

  python3 scripts/sim.py up [web-01|web-02]        start the VM (the first time: build it, ~5–10 min)
  python3 scripts/sim.py run first-login/04-commands   capture a section's real output
  python3 scripts/sim.py sh web-01 'ls -l /etc'    one command as ana, its real output on stdout
  python3 scripts/sim.py down [web-01|web-02]      stop the VM

web-01 is Debian 13, web-02 Rocky Linux 10, both from the official cloud images pinned below, under
QEMU. The first `up` boots the image, sets it up with cloud-init as a fresh VPS (user `ana` with the
provider's password; sudo through the sudo/wheel group) and saves a snapshot, `fresh`. Every `run` starts from `fresh`,
so a section never depends on what ran before it.

A section is sections/<course>/<NN-id>/section.json:

  {"vm": "web-01",                          which VM (default web-01)
   "with": ["web-01"],                      other VMs the section uses, reset with it (the laptop's servers)
   "setup": ["apt-get install -y nginx",    run first, as root, OFF screen (the guest agent, never a
                                              login): what the section assumes;
             {"on": "web-01", "run": "…",     on another VM; "pipe": true feeds it the previous
              "pipe": true}],                 step's output (a key made on the laptop, put on a server)
   "session": [                             typed in Ana's terminal (80 × 44), ON screen:
     "ls -l",                                 a command; done when the prompt comes back
     {"type": "sudo passwd ana",              a command that asks: answers are typed (echoed)
      "answer": [["password: $", "@password"]]},   @password: the provider's, never echoed
     {"tty": "man ls", "after": 4,            a full-screen program: its screen after N seconds
      "quit": "q", "name": "man-ls"},           into <name>.tty.json, then quit it
     {"window": "second"},                    switch to (or open) another terminal on the same VM;
                                              {"window": "main"} switches back
     {"pause": 90}                            wait, typing nothing (while a server reboots)
   ]}

Output beside it: output.txt (the main terminal, row for row), <window>.txt for any other, and any
<name>.tty.json. `[sudo] password`
is always answered. Nothing here is a container: `uname`, `ip addr`, `lsblk`, the boot log are the VM's.
"""
from __future__ import annotations

import base64
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
    'web-01': {'image': 'debian', 'ip': '192.0.2.10', 'port': 2210},     # host ports 2210–2213: 22 80 443 8080
    'web-02': {'image': 'rocky', 'ip': '192.0.2.20', 'port': 2220},
    'laptop': {'image': 'debian', 'ip': '192.0.2.100', 'port': 2300},   # Ana's laptop: ssh reaches the servers
}
# Debian: ana@web-01:~$   Red Hat: [ana@web-02 ~]$   root: # in both
GUEST_PORTS = (22, 80, 443, 8080)          # a server's ports the laptop reaches
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
    cas = ''.join('    - |\n' + ''.join(f'      {line}\n' for line in pem.splitlines()) for pem in egress_cas())
    return (f'#cloud-config\nhostname: {name}\nfqdn: {name}\n'
            f'users:\n  - name: ana\n    shell: /bin/bash\n    groups: [{"wheel" if rocky else "sudo"}]\n'
            f'    lock_passwd: false\n'
            f'ssh_pwauth: true\nchpasswd:\n  expire: false\n  users:\n    - {{name: ana, password: "{PASSWORD}", type: text}}\n'
            # the provider's guest agent: setup runs through it, never through a login (no root key, no
            # auth log). Red Hat ships it locked down: allow guest-exec, and make the agent's own SELinux
            # domain permissive (SELinux still enforces everything else: nginx's denials stay real).
            'packages: [qemu-guest-agent]\n'
            + (f'ca_certs:\n  trusted:\n{cas}' if cas else '')
            + 'runcmd:\n'
            + ('  - [sh, -c, "sed -i \'s/^FILTER_RPC_ARGS=.*/FILTER_RPC_ARGS=/\' /etc/sysconfig/qemu-ga"]\n'
               '  - [sh, -c, "echo \'(typepermissive virt_qemu_ga_t)\' > /run/qemu_ga_permissive.cil'
               ' && semodule -i /run/qemu_ga_permissive.cil"]\n' if rocky else '')
            + '  - [systemctl, restart, qemu-guest-agent]\n'
            '  - [touch, /etc/cloud/cloud-init.disabled]\n')


class VM:
    def __init__(self, name: str):
        if name not in VMS:
            raise SystemExit(f'no VM {name!r}: one of {", ".join(VMS)}')
        self.name, self.spec = name, VMS[name]
        self.dir = MACHINE / name
        self.disk, self.mon, self.qga = self.dir / 'disk.qcow2', self.dir / 'monitor', self.dir / 'agent'

    def running(self) -> bool:
        try:
            self.hmp('info status')
            return True
        except OSError:
            return False

    def start(self, extra: list[str]) -> None:
        net = f'user,id=net,net=192.0.2.0/24,host=192.0.2.1,dhcpstart={self.spec["ip"]}'
        if self.name == 'laptop':
            net += f',hostfwd=tcp:127.0.0.1:{self.spec["port"]}-:22'
            # Each VM has its own network; from the laptop, a server's address:port is that server's port.
            net += ''.join(f',guestfwd=tcp:{v["ip"]}:{gp}-cmd:socat - TCP:127.0.0.1:{v["port"] + i}'
                           for n, v in VMS.items() if n != 'laptop' for i, gp in enumerate(GUEST_PORTS))
        else:
            net += ''.join(f',hostfwd=tcp:127.0.0.1:{self.spec["port"] + i}-:{gp}' for i, gp in enumerate(GUEST_PORTS))
        self.mon.unlink(missing_ok=True)
        subprocess.Popen(
            ['qemu-system-x86_64', '-nodefaults', '-vga', 'std', '-accel', 'tcg,thread=multi', '-cpu', 'max',
             '-smp', '2', '-m', '1536', '-name', self.name,
             '-drive', f'file={self.disk},if=none,id=disk,discard=unmap',
             '-device', 'virtio-blk-pci,drive=disk,addr=0x4',
             '-netdev', net, '-device', 'virtio-net-pci,netdev=net,mac=52:54:00:00:02:10,addr=0x3',
             '-chardev', f'socket,id=qga,path={self.qga},server=on,wait=off',
             '-device', 'virtio-serial-pci,addr=0x6', '-device', 'virtserialport,chardev=qga,name=org.qemu.guest_agent.0',
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

    def ssh(self, user: str = 'ana') -> list[str]:
        """A login from the host: Ana's password, as on a fresh VPS (she has no key until the course
        gives her one)."""
        return ['ssh', '-q', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
                '-o', 'PubkeyAuthentication=no', '-o', 'PreferredAuthentications=password',
                '-o', 'ConnectTimeout=10', '-p', str(self.spec['port']), f'{user}@127.0.0.1']

    def agent(self, cmd: str, stdin: str = '', timeout: float = 1800) -> tuple[int, str, str]:
        """Run `cmd` as root through the guest agent: no login, nothing in the auth log."""
        s = socket.socket(socket.AF_UNIX)
        s.connect(str(self.qga))
        s.settimeout(10)
        f = s.makefile('rwb')

        def call(execute: str, **args) -> dict:
            f.write(json.dumps({'execute': execute, 'arguments': args}).encode() + b'\n')
            f.flush()
            while True:
                msg = json.loads(f.readline())
                if 'error' in msg:
                    raise SystemExit(f'{self.name}: guest agent: {msg["error"]}')
                if execute != 'guest-sync' or msg.get('return') == args['id']:
                    return msg['return']

        try:
            call('guest-sync', id=int(time.time() * 1000) % 2**31)   # skip anything stale on the channel
            exe = {'path': '/bin/sh', 'arg': ['-c', cmd], 'capture-output': True}
            if stdin:
                exe['input-data'] = base64.b64encode(stdin.encode()).decode()
            pid, end = call('guest-exec', **exe)['pid'], time.time() + timeout
            while not (st := call('guest-exec-status', pid=pid))['exited']:
                if time.time() > end:
                    raise SystemExit(f'{self.name}: {cmd!r} still running after {timeout}s')
                time.sleep(0.5)
        finally:
            s.close()
        dec = lambda k: base64.b64decode(st.get(k, '')).decode(errors='replace')
        return st.get('exitcode', 0), dec('out-data'), dec('err-data')

    def ready(self, timeout: int = 1200) -> None:
        """The agent answers and sshd is up (Ana's terminal logs in through it)."""
        t0 = time.time()
        while True:
            try:
                if self.agent('systemctl is-active --quiet ssh || systemctl is-active --quiet sshd', timeout=30)[0] == 0:
                    return
            except (OSError, ValueError, SystemExit):
                pass
            if time.time() - t0 > timeout:
                raise SystemExit(f'{self.name}: not ready after {timeout}s (see {self.dir / "serial.log"})')
            time.sleep(3)

    def build(self) -> None:
        """First boot from the pinned image with a cloud-init seed; then the snapshot `fresh`."""
        self.dir.mkdir(parents=True, exist_ok=True)
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
        self.ready()
        self.settle()
        # The seed goes before the snapshot: a snapshot needs every disk writable, and a VPS has one disk.
        self.hmp('device_del seedblk')
        while 'seedblk' in self.hmp('info pci') or 'seed' in self.hmp('info block'):
            time.sleep(1)
        self.hmp('savevm fresh')
        print(f'{self.name}: built and saved as `fresh` ({time.time() - t0:.0f}s)', flush=True)

    def settle(self) -> None:
        """What a fresh VPS has that the build leaves different: no ~/.ssh until something makes one, and
        no package lists or caches (installing the agent fetched them)."""
        self.agent('rm -rf /home/ana/.ssh; if command -v apt-get >/dev/null; then apt-get clean; '
                   'rm -rf /var/lib/apt/lists/*; else dnf -q clean all; fi; sync')

    def up(self) -> None:
        if self.running():
            return
        if not self.disk.exists() or 'fresh' not in sh('qemu-img', 'snapshot', '-l', str(self.disk)).stdout:
            return self.build()
        self.start(['-loadvm', 'fresh'])
        self.ready(300)

    def reset(self) -> None:
        self.hmp('loadvm fresh')
        self.ready(300)

    def down(self) -> None:
        if self.running():
            self.hmp('quit', timeout=30)


# ---------------------------------------------------------------- Ana's terminal

class Terminal:
    """An 80 × 44 terminal logged in as ana, drawn by a VT100 emulator, as Ana's window shows it."""

    def __init__(self, vm: VM):
        # ana logs in with her password, as on a fresh VPS (she has no key until the course gives her one)
        args = vm.ssh()[1:] + ['-tt']
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

    def idle(self, seconds: float) -> None:
        """Type nothing; what arrives meanwhile is on screen (a connection closing, a prompt)."""
        end = time.time() + seconds
        while time.time() < end:
            self.stream += self.read(1)

    def wait(self, answers: list[tuple[re.Pattern, str]], keep: bool = True) -> None:
        buf, deadline = bytearray(), time.time() + 900
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
        raise SystemExit(f'no prompt after 15 minutes; the screen ends with:\n{bytes(buf[-400:]).decode(errors="replace")}')

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
        # systemd writes 256-colour SGR with ':' separators (ESC[38:5:245m); pyte reads only ';'
        stream = re.sub(rb'\x1b\[[0-9;:]*m', lambda m: m.group().replace(b':', b';'), bytes(self.stream))
        pyte.ByteStream(screen).feed(stream)
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
    vms = {vm.name: vm, **{n: VM(n) for n in spec.get('with', [])}}
    for v in vms.values():
        v.up()
        v.reset()
    t0 = time.time()
    prev = ''
    for step in spec.get('setup', []):
        step = {'run': step} if isinstance(step, str) else step
        code, stdout, stderr = vms[step.get('on', vm.name)].agent(step['run'], prev if step.get('pipe') else '')
        if code:
            raise SystemExit(f'setup failed: {step["run"]}\n{stdout}{stderr}')
        prev = stdout
    windows = {'main': Terminal(vm)}
    term = windows['main']
    for item in spec['session']:
        if isinstance(item, dict) and 'pause' in item:     # time passes, nothing typed (a reboot)
            term.idle(item['pause'])
            continue
        if isinstance(item, dict) and 'window' in item:
            if item['window'] not in windows:
                windows[item['window']] = Terminal(vm)
            term = windows[item['window']]
            continue
        term.run(item, out)
    for name, t in windows.items():
        t.child.close()
        (out / ('output.txt' if name == 'main' else f'{name}.txt')).write_text(t.output())
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
        code, stdout, stderr = vm.agent(f'su - ana -c {shlex.quote(args[1])}')
        sys.stdout.write(stdout)
        sys.stderr.write(stderr)
        sys.exit(code)
    else:
        raise SystemExit(__doc__)
