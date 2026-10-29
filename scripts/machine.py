"""The course's machine: four real VMs on one private LAN, saved and resumed step by step.

  gw      192.0.2.1    the hosting provider's gateway (a stand-in, never on screen as a machine):
                       NAT to the internet, DNS for ana.example, the local ACME CA (Pebble). The only
                       VM with a second card (slirp: the internet, and the recorder's way in).
  web-01  192.0.2.10   Debian 13 — Ana's server, the course's subject.
  web-02  192.0.2.20   Rocky Linux 10 — the other family, for family cards and its own sections.
  laptop  192.0.2.100  Debian 13 — Ana's laptop: every command on screen is typed here.

Why it is built this way is in SPIKE.md. The rules that matter when changing it:

- A step RESUMES every VM from its parent's saved running state; nothing reboots unless a section
  reboots it. A state is a compressed qcow2 disk overlay on the parent's disk plus the VM's RAM as a
  zstd delta against the parent's RAM (~5 MB a step; a course's first step keeps a full copy).
- Every device has an explicit PCI address, and the command line never changes after the base:
  a saved state only resumes on the device set that saved it. The cloud-init seed is hot-unplugged
  before the base is saved, which is also why `lsblk` on a server shows only `vda`.
- The servers have NO control access after the base: everything on them is typed in the laptop's
  console. That console is the laptop's ttyS1 (an auto-login getty, 80 × 44), so Ana's shell and any
  ssh session she has open are part of the laptop's saved state: a section starts where the last
  one left her. The recorder also reaches the laptop through gw with a key in /etc/ssh/ctl/ (never
  ~/.ssh), for diagnosis only.
- Every VM runs in every step, so their clocks (`clock=vm`, frozen while saved) stay together.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import socket
import subprocess
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MACHINE = REPO / '.machine'            # images, states, raw RAM, logs — never committed
IMAGES = MACHINE / 'images'
STATES = MACHINE / 'states'            # <step>/<vm>.qcow2 + <vm>.ram.zst — release assets
RAW = MACHINE / 'raw'                  # <step>/<vm>.ram — the uncompressed RAM a delta is taken against
RUN = MACHINE / 'run'                  # monitors, serial logs, the live overlays
KEY = MACHINE / 'ctl_key'              # the recorder's key: gw, and the laptop through gw
TERM = RUN / 'laptop.term'             # Ana's terminal (the laptop's ttyS1)

CLOCK = '2026-11-02T09:00:00'

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
    'gw': {'image': 'debian', 'ram': 768, 'ip': '192.0.2.1', 'mac': '52:54:00:00:02:01'},
    'web-01': {'image': 'debian', 'ram': 1536, 'ip': '192.0.2.10', 'mac': '52:54:00:00:02:10'},
    'web-02': {'image': 'rocky', 'ram': 1536, 'ip': '192.0.2.20', 'mac': '52:54:00:00:02:20'},
    'laptop': {'image': 'debian', 'ram': 1024, 'ip': '192.0.2.100', 'mac': '52:54:00:00:02:64'},
}
ORDER = ['gw', 'web-01', 'web-02', 'laptop']
GW_PORT = 2200
LAN = 'socket,id=lan,mcast=230.0.2.1:5555,localaddr=127.0.0.1'


def sh(*cmd: str, **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, text=True, capture_output=True, **kw)


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


# ---------------------------------------------------------------- images

def image(name: str) -> Path:
    url, algo, want = IMAGE[name]
    path = IMAGES / url.rsplit('/', 1)[1]
    if not path.exists():
        IMAGES.mkdir(parents=True, exist_ok=True)
        part = path.with_suffix('.part')
        for attempt in range(5):  # the proxy cuts long transfers; curl resumes
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


# ---------------------------------------------------------------- a running VM

class VM:
    def __init__(self, name: str):
        self.name, self.spec = name, VMS[name]
        RUN.mkdir(parents=True, exist_ok=True)
        self.mon = RUN / f'{name}.mon'
        self.disk = RUN / f'{name}.qcow2'
        self.proc: subprocess.Popen | None = None

    def args(self) -> list[str]:
        s = self.spec
        a = ['qemu-system-x86_64', '-nodefaults', '-vga', 'std', '-accel', 'tcg,thread=multi',
             '-cpu', 'max', '-smp', '2', '-m', str(s['ram']),
             '-drive', f'file={self.disk},if=none,id=disk,discard=unmap',
             '-device', 'virtio-blk-pci,drive=disk,id=vda,addr=0x4',
             '-netdev', LAN, '-device', f'virtio-net-pci,netdev=lan,mac={s["mac"]},addr=0x3']
        if self.name == 'gw':
            a += ['-netdev', f'user,id=wan,hostfwd=tcp:127.0.0.1:{GW_PORT}-:22',
                  '-device', 'virtio-net-pci,netdev=wan,mac=52:54:00:00:01:01,addr=0x5']
        a += ['-rtc', f'base={CLOCK},clock=vm', '-display', 'none',
              '-serial', f'file:{RUN / (self.name + ".serial")}',
              '-monitor', f'unix:{self.mon},server,nowait']
        if self.name == 'laptop':
            # Ana's terminal: ttyS1, a serial line with an auto-login getty, on a host socket. Her
            # shell — and any ssh she is in — is the laptop's own state, so it survives save/resume.
            a += ['-chardev', f'socket,id=term,path={TERM},server=on,wait=off',
                  '-device', 'isa-serial,chardev=term,index=1']
        return a

    def start(self, extra: list[str] = ()) -> None:
        self.mon.unlink(missing_ok=True)
        log = open(RUN / f'{self.name}.qemu.log', 'w')
        self.proc = subprocess.Popen(self.args() + list(extra), stdout=log, stderr=subprocess.STDOUT)
        for _ in range(100):
            if self.mon.exists():
                return
            if self.proc.poll() is not None:
                raise SystemExit(f'{self.name}: qemu exited: {(RUN / (self.name + ".qemu.log")).read_text()}')
            time.sleep(0.1)
        raise SystemExit(f'{self.name}: no monitor socket')

    def hmp(self, cmd: str) -> str:
        s = socket.socket(socket.AF_UNIX)
        s.connect(str(self.mon))
        s.settimeout(30)
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

    def save_ram(self, raw: Path) -> None:
        """Stop the VM and write its whole running state (RAM and devices) to `raw`."""
        raw.parent.mkdir(parents=True, exist_ok=True)
        self.hmp('stop')
        self.hmp(f'migrate "exec:cat > {raw}"')
        while True:
            info = self.hmp('info migrate')
            if 'Migration status: completed' in info:
                return
            if 'failed' in info or 'cancelled' in info:
                raise SystemExit(f'{self.name}: migration {info}')
            time.sleep(0.5)

    def quit(self) -> None:
        if self.proc and self.proc.poll() is None:
            try:
                self.hmp('quit')
            except OSError:
                pass
            self.proc.wait(timeout=60)


# ---------------------------------------------------------------- states

def state_files(step: str, vm: str) -> tuple[Path, Path]:
    d = STATES / step
    return d / f'{vm}.qcow2', d / f'{vm}.ram.zst'


def raw_of(step: str, vm: str, chain: list[str]) -> Path:
    """The uncompressed RAM of `vm` at `step`, rebuilt along `chain` (base first) if it is not cached."""
    raw = RAW / step / f'{vm}.ram'
    if raw.exists():
        return raw
    i = chain.index(step)
    _, z = state_files(step, vm)
    raw.parent.mkdir(parents=True, exist_ok=True)
    meta = json.loads((STATES / step / 'state.json').read_text())
    if meta[vm]['ram'] == 'full':
        sh('zstd', '-q', '-d', '--long=31', str(z), '-o', str(raw))
    else:
        parent = raw_of(chain[i - 1], vm, chain)
        sh('zstd', '-q', '-d', '--long=31', f'--patch-from={parent}', str(z), '-o', str(raw))
    return raw


def save_state(step: str, parent: str | None, vms: dict[str, VM], full: bool, chain: list[str]) -> dict:
    """Freeze every VM: RAM to a raw file, then compress RAM (delta or full) and the disk overlay."""
    d = STATES / step
    d.mkdir(parents=True, exist_ok=True)
    meta: dict = {}
    for name, vm in vms.items():
        raw = RAW / step / f'{name}.ram'
        vm.save_ram(raw)
    for vm in vms.values():
        vm.quit()
    for name, vm in vms.items():
        disk, z = state_files(step, name)
        raw = RAW / step / f'{name}.ram'
        if full or parent is None:
            sh('zstd', '-q', '-f', '-9', '--long=31', str(raw), '-o', str(z))
            kind = 'full'
        else:
            sh('zstd', '-q', '-f', '-9', '--long=31', f'--patch-from={raw_of(parent, name, chain)}', str(raw), '-o', str(z))
            kind = 'delta'
        backing = disk_of(parent, name) if parent else image(VMS[name]['image'])
        sh('qemu-img', 'convert', '-O', 'qcow2', '-c', '-o', 'compression_type=zstd',
           '-B', os.path.relpath(backing, d), '-F', 'qcow2', str(vm.disk), str(disk), cwd=d)
        vm.disk.unlink()
        meta[name] = {'ram': kind, 'ram_sha': sha(z), 'disk_sha': sha(disk)}
    (d / 'state.json').write_text(json.dumps(meta, indent=1) + '\n')
    return meta


def disk_of(step: str, vm: str) -> Path:
    return state_files(step, vm)[0]


def resume(step: str, chain: list[str]) -> dict[str, VM]:
    """Start every VM where `step` left it: a fresh overlay on its disk, its RAM migrated in."""
    vms = {}
    for name in ORDER:
        vm = VM(name)
        vm.disk.unlink(missing_ok=True)
        sh('qemu-img', 'create', '-q', '-f', 'qcow2', '-F', 'qcow2', '-b', str(disk_of(step, name)), str(vm.disk))
        vm.start(['-incoming', f'exec:cat {raw_of(step, name, chain)}'])
        vms[name] = vm
    for vm in vms.values():
        while 'Migration status: completed' not in vm.hmp('info migrate'):
            time.sleep(0.5)
        if 'running' not in vm.hmp('info status'):
            vm.hmp('cont')
    return vms


def ssh_args(target: str) -> list[str]:
    """The recorder's way in: gw directly, anything else on the LAN through gw."""
    base = ['ssh', '-q', '-i', str(KEY), '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null',
            '-o', 'ConnectTimeout=10', '-o', 'BatchMode=yes']
    if target == 'gw':
        return base + ['-p', str(GW_PORT), 'ana@127.0.0.1']
    jump = (f'ssh -q -i {KEY} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null '
            f'-p {GW_PORT} -W %h:%p ana@127.0.0.1')
    return base + ['-o', f'ProxyCommand={jump}', f'ana@{VMS[target]["ip"]}']


def wait_ssh(target: str, timeout: int = 1200) -> None:
    t0 = time.time()
    while subprocess.run(ssh_args(target) + ['true'], capture_output=True).returncode != 0:
        if time.time() - t0 > timeout:
            raise SystemExit(f'{target}: no ssh after {timeout}s')
        time.sleep(3)


def cleanup() -> None:
    shutil.rmtree(RUN, ignore_errors=True)
