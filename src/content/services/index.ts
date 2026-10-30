import type { Course, Section } from '../types'

// Course 4 — processes and services. The pilot authors only ◆ Boot (4.6); sections 1–5 follow, and
// this course's other sections are added before it, in COURSE-PLAN.md's order.
const s = (id: string, title: string, scene: string, narration: string): Section => ({ id, title, scene, narration })

export const services: Course = {
  id: 'services',
  title: 'Processes and services',
  sections: [
    s('boot', 'Boot', 'services-boot',
      "Between pressing the power button and a login prompt, a Linux server hands control along a short chain, and every link in it left a trace that web-01 can show us. The top row is that chain. First comes the firmware, built into the machine; here it is the virtual machine's own. It finds the memory, which the kernel later reports as the BIOS RAM map, and starts a bootloader from the disk. On Debian the bootloader is GRUB, which lives in slash boot slash grub. GRUB loads two files from slash boot, listed in the table: vmlinuz, the compressed kernel, and initrd, the initial RAM disk. It also passes the kernel a command line, which slash proc slash cmdline still shows: which kernel image, which partition holds the root filesystem, and to mount it read only at first. The kernel starts, and the journal's first line is its own announcement, Linux version six point twelve. It unpacks the initial RAM disk and runs slash init from it: a tiny system whose one job is to find and mount the real root disk. Then it hands over to systemd, which becomes process number one, the ancestor of every other process. systemd starts the services, in dependency order, until it reaches the multi-user target: networking and SSH are up, and logins are open. This virtual machine is emulated, so its timings are slow and say nothing about real hardware. What matters is the order, and that every step of it is written down."),
  ],
}
