#!/usr/bin/env bash
# vm.sh <name> <mac suffix> [-loadvm tag] — run an existing disk on the LAN with an HMP monitor socket
cd "$(dirname "$0")"
name=$1 mac=$2; shift 2
nohup qemu-system-x86_64 -accel tcg,thread=multi -cpu max -smp 2 -m 1536 \
  -drive file=$name.qcow2,if=virtio,discard=unmap -drive file=seed-$name.iso,if=virtio,readonly=on \
  -netdev socket,id=lan,mcast=230.0.2.1:5555,localaddr=127.0.0.1 \
  -device virtio-net-pci,netdev=lan,mac=52:54:00:00:02:$mac \
  -rtc base=2026-11-02T09:00:00,clock=vm -display none -serial file:$name.serial \
  -monitor unix:$name.mon,server,nowait "$@" > $name.qemu.out 2>&1 &
echo $! > $name.pid
