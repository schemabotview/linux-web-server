import type { SceneModel } from '@graphlearning/graphl-flow'
import { CONSOLE_W, consoleH, consoleNode, drawnRows, fold, rowsFrom, transcript } from '../console'
import boot from '../../../sections/services/06-boot/output.txt?raw'

// Course 4 — processes and services. The pilot authors only ◆ Boot (4.6); the other sections follow.

// §6 ◆ Boot — a full scene (COURSE-PLAN.md, "Frames" 3): the chain from power-on to multi-user.target,
// each stage named by a line from THIS VM's boot log, with the log beside it. The console folds the
// kernel's echo of /proc/cmdline (shown just above it), the BIOS RAM map's rows, systemd's
// compile-time feature list and the bottom of `blame`. Times are an emulated VM's (NOTES.md):
// the scene says so, and narration never quotes one.
const bootT = transcript(boot)
const bootShow = fold(bootT, ['kernel: Command line:', 'consoleblank=0'], ['BIOS-e820: [mem 0x0000000000000000', '0fffff] reserved'], ['mode (+PAM', 'VE)'],
  ['10.136s cloud-init-local', 'systemd-binfmt.service'])

const bootScene: SceneModel = {
  title: 'Boot: from power-on to a login prompt',
  sub: 'web-01’s own boot, read back from its journal — a VM, so its firmware is the emulator’s',
  nodes: [
    { type: 'group', id: 'chain', dir: 'row', bare: true, children: [
      { type: 'item', id: 'b-fw', title: 'firmware', sub: 'finds the RAM: BIOS-e820', icon: 'cpu', stack: true, tone: 'neutral' },
      { type: 'item', id: 'b-grub', title: 'GRUB', sub: 'the bootloader: /boot/grub', icon: 'disk', stack: true, tone: 'source' },
      { type: 'item', id: 'b-kernel', title: 'Linux 6.12', sub: 'vmlinuz: “Linux version”', icon: 'linux', stack: true, tone: 'infra' },
      { type: 'item', id: 'b-initrd', title: 'initramfs', sub: '“Run /init”: finds the root disk', icon: 'archive', stack: true, tone: 'infra' },
      { type: 'item', id: 'b-systemd', title: 'systemd, PID 1', sub: 'the first process', icon: 'settings', stack: true, tone: 'ingest' },
      { type: 'item', id: 'b-target', title: 'multi-user.target', sub: 'services up, logins open', icon: 'server', stack: true, tone: 'store' },
    ] },
    { type: 'group', id: 'proof', dir: 'row', bare: true, children: [
      consoleNode('boot-console', {
        output: boot, title: 'ana@web-01: ~', show: bootShow,
        highlight: [...rowsFrom(bootT, 'kernel: Linux version'), ...rowsFrom(bootT, 'kernel: Run /init'), ...rowsFrom(bootT, 'systemd 257'), ...rowsFrom(bootT, 'Reached target multi-user.target')],
      }, { w: CONSOLE_W, h: consoleH(drawnRows(bootT, bootShow)) }),
      { type: 'group', id: 'files', bare: true, children: [
        { type: 'table', id: 'boot-dir', title: '/boot — each file names its kernel, 6.12.113+deb13-cloud-amd64', tone: 'infra', columns: ['file', 'stage'], rows: [
          ['grub/', 'the bootloader’s modules and menu'],
          ['vmlinuz-…', 'the kernel, compressed'],
          ['initrd.img-…', 'the initramfs'],
          ['config-…', 'the options it was built with'],
          ['System.map-…', 'its symbol addresses'],
        ] },
        { type: 'table', id: 'cmdline', title: '/proc/cmdline — what GRUB told the kernel', tone: 'source', columns: ['argument', 'means'], rows: [
          ['BOOT_IMAGE=/boot/vmlinuz-…', 'the kernel file GRUB loaded'],
          ['root=PARTUUID=84fd0772-…', 'the disk partition to mount as /'],
          ['ro', 'mount it read-only first; systemd remounts it'],
          ['console=ttyS0,115200', 'also print to the serial port — a VM’s screen'],
        ] },
        { type: 'note', id: 'times', tone: 'neutral', text: 'This VM is emulated, so every second here is slow: read the ORDER, not the times.' },
      ] },
    ] },
  ],
  edges: [
    { from: 'b-fw', to: 'b-grub', label: 'starts' }, { from: 'b-grub', to: 'b-kernel', label: 'loads' },
    { from: 'b-kernel', to: 'b-initrd', label: 'unpacks' }, { from: 'b-initrd', to: 'b-systemd', label: 'runs' },
    { from: 'b-systemd', to: 'b-target', label: 'starts' },
  ],
}

export const servicesScenes: Record<string, SceneModel> = {
  'services-boot': bootScene,
}
