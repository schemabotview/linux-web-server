#!/usr/bin/env bash
# boot.sh <name> <base image> <ssh port> [extra qemu args…]
# Fresh overlay + cloud-init seed, boots under TCG in the background, prints seconds to first SSH.
set -euo pipefail
cd "$(dirname "$0")"
name=$1 base=$2 port=$3; shift 3
cat > user-data.$name <<EOF
#cloud-config
hostname: $name
fqdn: $name
users:
  - name: ana
    groups: [$( [[ $base == *Rocky* ]] && echo wheel || echo sudo )]
    shell: /bin/bash
    sudo: "ALL=(ALL) NOPASSWD:ALL"
    ssh_authorized_keys: ["$(cat key.pub)"]
EOF
printf 'instance-id: %s\nlocal-hostname: %s\n' "$name" "$name" > meta-data.$name
mkdir -p seed.$name && cp user-data.$name seed.$name/user-data && cp meta-data.$name seed.$name/meta-data
genisoimage -quiet -output seed-$name.iso -volid cidata -joliet -rock seed.$name/user-data seed.$name/meta-data
rm -f $name.qcow2
qemu-img create -q -f qcow2 -F qcow2 -b "$base" $name.qcow2 10G
t0=$(date +%s)
nohup qemu-system-x86_64 -accel tcg,thread=multi -cpu max -smp 4 -m 2048 \
  -drive file=$name.qcow2,if=virtio -drive file=seed-$name.iso,if=virtio,media=cdrom \
  -netdev user,id=n0,hostfwd=tcp:127.0.0.1:$port-:22 -device virtio-net-pci,netdev=n0 \
  -rtc base=2026-11-02T09:00:00,clock=vm -display none -serial file:$name.serial -monitor none \
  "$@" > $name.qemu.out 2>&1 &
echo $! > $name.pid
for _ in $(seq 1 180); do
  if ssh -q -i key -p $port -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 \
       -o BatchMode=yes ana@127.0.0.1 true 2>/dev/null; then
    echo "$name: ssh after $(( $(date +%s) - t0 ))s"; exit 0
  fi
  sleep 5
done
echo "$name: no ssh after $(( $(date +%s) - t0 ))s"; tail -20 $name.serial; exit 1
