#!/usr/bin/env bash
# net.sh <name> <base image> <lan ip> <mac suffix>
#
# The machine's network: ONE shared LAN (QEMU mcast socket), 192.0.2.0/24.
#   gw (192.0.2.1)  — the hosting provider's gateway, a stand-in: the only VM with a second card
#                     (slirp, to the internet and the control port 127.0.0.1:2200). NAT, DNS
#                     (dnsmasq: ana.example and the machines), and the local ACME CA (Pebble).
#   every other VM  — one card, on the LAN only, so `ip addr` shows what a VPS shows. Reached for
#                     control through gw (ssh -J), never through a card of its own.
set -euo pipefail
cd "$(dirname "$0")"
name=$1 base=$2 ip=$3 mac=$4
rocky=false; [[ $base == *Rocky* ]] && rocky=true
ca=$(sed 's/^/      /' /root/.ccr/ca-bundle.crt)
mkdir -p seed.$name
{
  echo '#cloud-config'
  echo "hostname: $name"
  echo "fqdn: $name"
  echo 'users:'
  echo '  - name: ana'
  echo "    groups: [$($rocky && echo wheel || echo sudo)]"
  echo '    shell: /bin/bash'
  echo '    sudo: "ALL=(ALL) NOPASSWD:ALL"'
  echo "    ssh_authorized_keys: [\"$(cat key.pub)\"]"
  # This environment's egress proxy re-signs TLS. Off screen, in the base layer; see SPIKE.md.
  echo 'ca_certs:'
  echo '  trusted:'
  echo '    - |'
  echo "$ca"
  if [[ $name == gw ]]; then
    cat <<'EOF'
packages: [dnsmasq, nftables, pebble]
write_files:
  - path: /etc/sysctl.d/90-forward.conf
    content: "net.ipv4.ip_forward = 1\n"
  - path: /etc/nftables.conf
    content: |
      #!/usr/sbin/nft -f
      flush ruleset
      table ip nat {
        chain postrouting {
          type nat hook postrouting priority srcnat;
          oifname "wan" masquerade
        }
      }
  - path: /etc/dnsmasq.d/lab.conf
    content: |
      interface=lan
      bind-interfaces
      no-resolv
      server=10.0.2.3
      address=/ana.example/192.0.2.10
      host-record=web-01,192.0.2.10
      host-record=web-02,192.0.2.20
      host-record=laptop,192.0.2.100
      host-record=acme.gw,192.0.2.1
runcmd:
  - [sysctl, --system]
  - [systemctl, enable, --now, nftables]
  - [systemctl, restart, dnsmasq]
EOF
  fi
  echo 'runcmd_done: true' >/dev/null
} > seed.$name/user-data
printf 'instance-id: %s\nlocal-hostname: %s\n' "$name" "$name" > seed.$name/meta-data
if [[ $name == gw ]]; then
  cat > seed.$name/network-config <<EOF
version: 2
ethernets:
  wan:
    match: {macaddress: "52:54:00:00:01:01"}
    set-name: wan
    dhcp4: true
  lan:
    match: {macaddress: "52:54:00:00:02:$mac"}
    set-name: lan
    addresses: [$ip/24]
EOF
else
  cat > seed.$name/network-config <<EOF
version: 2
ethernets:
  lan:
    match: {macaddress: "52:54:00:00:02:$mac"}
    addresses: [$ip/24]
    routes: [{to: default, via: 192.0.2.1}]
    nameservers: {addresses: [192.0.2.1], search: []}
EOF
fi
genisoimage -quiet -output seed-$name.iso -volid cidata -joliet -rock \
  seed.$name/user-data seed.$name/meta-data seed.$name/network-config
rm -f $name.qcow2
qemu-img create -q -f qcow2 -F qcow2 -b "$base" $name.qcow2 10G

wan=()
[[ $name == gw ]] && wan=(-netdev user,id=wan,hostfwd=tcp:127.0.0.1:2200-:22
                         -device virtio-net-pci,netdev=wan,mac=52:54:00:00:01:01)
t0=$(date +%s)
nohup qemu-system-x86_64 -accel tcg,thread=multi -cpu max -smp 2 -m 1536 \
  -drive file=$name.qcow2,if=virtio,discard=unmap -drive file=seed-$name.iso,if=virtio,readonly=on \
  "${wan[@]}" \
  -netdev socket,id=lan,mcast=230.0.2.1:5555,localaddr=127.0.0.1 \
  -device virtio-net-pci,netdev=lan,mac=52:54:00:00:02:$mac \
  -rtc base=2026-11-02T09:00:00,clock=vm -display none -serial file:$name.serial -monitor none \
  > $name.qemu.out 2>&1 &
echo $! > $name.pid

SSH=(ssh -q -i key -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 -o BatchMode=yes)
if [[ $name == gw ]]; then target=(-p 2200 ana@127.0.0.1)
else target=(-o "ProxyCommand=ssh -q -i key -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -p 2200 -W %h:%p ana@127.0.0.1" ana@$ip); fi
until "${SSH[@]}" "${target[@]}" 'cloud-init status --wait >/dev/null 2>&1; true' 2>/dev/null; do
  kill -0 "$(cat $name.pid)" 2>/dev/null || { echo "$name: qemu exited"; cat $name.qemu.out; exit 1; }
  (( $(date +%s) - t0 > 1200 )) && { echo "$name: not up after 1200s"; tail -20 $name.serial; exit 1; }
  sleep 5
done
echo "$name up (cloud-init done) after $(( $(date +%s) - t0 ))s"
