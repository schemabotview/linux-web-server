#!/usr/bin/env python3
"""Build the chain's first state, `base`: four fresh VMs as the course finds them, then saved.

  python3 scripts/base.py

What the course finds:
- web-01 (Debian 13) and web-02 (Rocky Linux 10): a fresh VPS, as a provider hands one over —
  user `ana` with the provider's password, password logins on, NO key: the course's first login
  types the password, and §2.5–2.6 put a key on and turn passwords off.
- laptop (Debian 13): Ana's laptop. No SSH key yet (§2.5 makes one), an empty known_hosts (§1.3
  meets the host key fingerprint).
- gw: the provider's network, never on screen as a machine.

What the machinery adds OFF SCREEN, all of it named here and in SPIKE.md:
- every VM trusts the cloud session's egress proxy CA (it re-signs TLS; scripts/proxy-ca.crt is its
  public certificate, so a base built elsewhere still works when a cloud session records the next
  step); servers and laptop also trust
  the lab CA (Pebble's listener) and Pebble's root — the role the public trust store plays for
  Let's Encrypt;
- /etc/cloud/cloud-init.disabled on every VM (no VM may re-run cloud-init on a reboot);
- the laptop's sshd takes the recorder's key from /etc/ssh/ctl/ana (never ~/.ssh);
- rsync on the laptop (its own tools are not a lesson).
"""
import os
import socket
import sys
import time
from pathlib import Path

from machine import KEY, TERM, RUN, STATES, VMS, VM, image, save_state, sh, ssh_args, wait_ssh

PASSWORD = 'mango-river-4821'   # the provider's password for ana on web-01 and web-02; never echoed
# The live session's proxy CA when there is one (it may rotate), else the committed copy.
_LIVE_CA = Path('/root/.ccr/agent-proxy-ca.crt')
PROXY_CA = (_LIVE_CA if os.access(_LIVE_CA, os.R_OK) else Path(__file__).with_name('proxy-ca.crt')).read_text()


def indent(text: str, n: int) -> str:
    return ''.join(' ' * n + line + '\n' for line in text.rstrip('\n').split('\n'))


def user_data(name: str, trusted: list[str]) -> str:
    rocky = VMS[name]['image'] == 'rocky'
    out = ['#cloud-config', f'hostname: {name}', f'fqdn: {name}', 'users:', '  - name: ana',
           '    shell: /bin/bash']
    if name in ('web-01', 'web-02'):
        out += [f'    groups: [{"wheel" if rocky else "sudo"}]', '    sudo: "ALL=(ALL) ALL"',
                '    lock_passwd: false', 'ssh_pwauth: true', 'chpasswd:', '  expire: false', '  users:',
                f'    - {{name: ana, password: "{PASSWORD}", type: text}}']
    elif name == 'gw':
        out += ['    sudo: "ALL=(ALL) NOPASSWD:ALL"', f'    ssh_authorized_keys: ["{KEY.with_suffix(".pub").read_text().strip()}"]']
    else:  # laptop: Ana's own machine; she is in sudo, the recorder's key lives outside ~/.ssh
        out += ['    groups: [sudo]', '    sudo: "ALL=(ALL) NOPASSWD:ALL"']
    out += ['ca_certs:', '  trusted:'] + [indent('- |\n' + indent(pem, 2), 4).rstrip('\n') for pem in trusted]
    files, runcmd, packages = [], ['[touch, /etc/cloud/cloud-init.disabled]'], []
    if name == 'gw':
        packages = ['dnsmasq', 'nftables', 'pebble']
        files += [('/etc/sysctl.d/90-forward.conf', 'net.ipv4.ip_forward = 1\n'),
                  ('/etc/nftables.conf', '#!/usr/sbin/nft -f\nflush ruleset\ntable ip nat {\n  chain postrouting {\n'
                   '    type nat hook postrouting priority srcnat;\n    oifname "wan" masquerade\n  }\n}\n'),
                  ('/etc/dnsmasq.d/lab.conf', 'interface=lan\nbind-interfaces\nno-resolv\nserver=10.0.2.3\n'
                   'address=/ana.example/192.0.2.10\n' + ''.join(
                       f'host-record={n},{v["ip"]}\n' for n, v in VMS.items() if n != 'gw') + 'host-record=acme.gw,192.0.2.1\n')]
        runcmd += ['[sysctl, --system]', '[systemctl, enable, --now, nftables]', '[systemctl, restart, dnsmasq]']
    if name == 'laptop':
        packages = ['rsync']
        files += [('/etc/ssh/sshd_config.d/10-ctl.conf', 'AuthorizedKeysFile .ssh/authorized_keys /etc/ssh/ctl/%u\n'),
                  ('/etc/ssh/ctl/ana', KEY.with_suffix('.pub').read_text()),
                  # Ana's terminal window: ttyS1, logged in as ana, 80 × 44 like the frames' console.
                  ('/etc/systemd/system/serial-getty@ttyS1.service.d/terminal.conf',
                   '[Service]\nExecStartPre=/bin/stty -F /dev/%I rows 44 cols 80\nExecStart=\n'
                   'ExecStart=-/sbin/agetty --autologin ana --noclear --keep-baud 115200 %I xterm\n')]
        runcmd += ['[systemctl, reload, ssh]', '[systemctl, daemon-reload]',
                   '[systemctl, enable, --now, serial-getty@ttyS1.service]']
    if packages:
        out += ['packages: [' + ', '.join(packages) + ']']
    if files:
        out += ['write_files:'] + [f'  - path: {p}\n    content: |\n{indent(c, 6)}'.rstrip('\n') for p, c in files]
    out += ['runcmd:'] + [f'  - {c}' for c in runcmd]
    return '\n'.join(out) + '\n'


def network_config(name: str) -> str:
    ip, mac = VMS[name]['ip'], VMS[name]['mac']
    if name == 'gw':
        return (f'version: 2\nethernets:\n  wan:\n    match: {{macaddress: "52:54:00:00:01:01"}}\n    set-name: wan\n'
                f'    dhcp4: true\n  lan:\n    match: {{macaddress: "{mac}"}}\n    set-name: lan\n    addresses: [{ip}/24]\n')
    return (f'version: 2\nethernets:\n  lan:\n    match: {{macaddress: "{mac}"}}\n    addresses: [{ip}/24]\n'
            f'    routes: [{{to: default, via: 192.0.2.1}}]\n    nameservers: {{addresses: [192.0.2.1], search: []}}\n')


def boot(name: str, trusted: list[str]) -> VM:
    seed = RUN / f'seed-{name}'
    seed.mkdir(parents=True, exist_ok=True)
    (seed / 'user-data').write_text(user_data(name, trusted))
    (seed / 'meta-data').write_text(f'instance-id: {name}\nlocal-hostname: {name}\n')
    (seed / 'network-config').write_text(network_config(name))
    iso = RUN / f'seed-{name}.iso'
    sh('genisoimage', '-quiet', '-output', str(iso), '-volid', 'cidata', '-joliet', '-rock',
       str(seed / 'user-data'), str(seed / 'meta-data'), str(seed / 'network-config'))
    vm = VM(name)
    vm.disk.unlink(missing_ok=True)
    sh('qemu-img', 'create', '-q', '-f', 'qcow2', '-F', 'qcow2', '-b', str(image(VMS[name]['image'])), str(vm.disk), '10G')
    # The seed sits LAST, at its own slot, so unplugging it leaves every other device where it was.
    vm.start(['-drive', f'file={iso},if=none,id=seed,readonly=on', '-device', 'virtio-blk-pci,drive=seed,id=seedblk,addr=0x9'])
    return vm


def cloud_init_done(vm: VM) -> bool:
    return 'finished at' in (RUN / f'{vm.name}.serial').read_text(errors='replace')


def unplug_seed(vm: VM) -> None:
    vm.hmp('device_del seedblk')
    for _ in range(60):
        if 'seedblk' not in vm.hmp('info pci') and 'seed' not in vm.hmp('info block'):
            return
        time.sleep(1)
    raise SystemExit(f'{vm.name}: seed did not unplug')


def terminal_ready() -> None:
    """Ana's terminal (the laptop's ttyS1) shows her prompt. Nothing is typed: an Enter only."""
    s = socket.socket(socket.AF_UNIX)
    s.connect(str(TERM))
    s.settimeout(5)
    seen, t0 = b'', time.time()
    while b'ana@laptop:~$ ' not in seen:
        if time.time() - t0 > 300:
            raise SystemExit(f'laptop terminal: no prompt; saw {seen[-200:]!r}')
        s.sendall(b'\r')
        try:
            seen += s.recv(65536)
        except socket.timeout:
            pass
    s.close()


def main() -> None:
    if (STATES / 'base' / 'state.json').exists():
        raise SystemExit('base exists: delete .machine/states/base to rebuild (and every state after it)')
    if not KEY.exists():
        KEY.parent.mkdir(parents=True, exist_ok=True)
        sh('ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', 'recorder', '-f', str(KEY))
    t0 = time.time()
    gw = boot('gw', [PROXY_CA])
    wait_ssh('gw')
    while not cloud_init_done(gw):
        time.sleep(3)
    gw_setup = r'''set -e
sudo mkdir -p /etc/pebble && cd /etc/pebble
sudo openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -days 3650 -subj "/CN=Lab ACME listener CA" -keyout ca.key -out ca.pem 2>/dev/null
sudo openssl req -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes -subj "/CN=acme.gw" -keyout key.pem -out req.csr 2>/dev/null
printf "subjectAltName=DNS:acme.gw,IP:192.0.2.1\n" | sudo tee ext.cnf >/dev/null
sudo openssl x509 -req -in req.csr -CA ca.pem -CAkey ca.key -CAcreateserial -days 3650 -extfile ext.cnf -out cert.pem 2>/dev/null
echo '{"pebble":{"listenAddress":"0.0.0.0:14000","managementListenAddress":"0.0.0.0:15000","certificate":"/etc/pebble/cert.pem","privateKey":"/etc/pebble/key.pem","httpPort":80,"tlsPort":443,"ocspResponderURL":"","externalAccountBindingRequired":false,"certificateValidityPeriod":7776000}}' | sudo tee config.json >/dev/null
printf '[Unit]\nDescription=Pebble, a local ACME CA (stands in for Let'"'"'s Encrypt)\nAfter=network-online.target dnsmasq.service\n[Service]\nEnvironment=PEBBLE_VA_NOSLEEP=1\nExecStart=/usr/bin/pebble -config /etc/pebble/config.json -dnsserver 192.0.2.1:53\n[Install]\nWantedBy=multi-user.target\n' | sudo tee /etc/systemd/system/pebble.service >/dev/null
sudo systemctl daemon-reload && sudo systemctl enable --now pebble >/dev/null 2>&1
for i in $(seq 30); do curl -sf --cacert ca.pem --resolve acme.gw:15000:127.0.0.1 https://acme.gw:15000/roots/0 >/dev/null && break; sleep 1; done
'''
    sh(*ssh_args('gw'), gw_setup)
    lab_ca = sh(*ssh_args('gw'), 'sudo cat /etc/pebble/ca.pem').stdout
    root = sh(*ssh_args('gw'), 'curl -sf --cacert /etc/pebble/ca.pem --resolve acme.gw:15000:127.0.0.1 '
              'https://acme.gw:15000/roots/0').stdout
    print(f'gw ready ({time.time() - t0:.0f}s)', flush=True)

    others = {n: boot(n, [PROXY_CA, lab_ca, root]) for n in ('web-01', 'web-02', 'laptop')}
    pending = set(others)
    while pending:
        for n in sorted(pending):
            if cloud_init_done(others[n]):
                print(f'{n}: cloud-init finished ({time.time() - t0:.0f}s)', flush=True)
                pending.discard(n)
        time.sleep(5)
    wait_ssh('laptop')
    terminal_ready()
    vms = {'gw': gw, **others}
    for vm in vms.values():
        unplug_seed(vm)
    save_state('base', None, vms, full=True, chain=['base'])
    print(f'base saved ({time.time() - t0:.0f}s)')


if __name__ == '__main__':
    sys.exit(main())
