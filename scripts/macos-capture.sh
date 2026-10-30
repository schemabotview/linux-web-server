#!/bin/zsh
# The macOS capture: run ONCE on a Mac, from this repo's root, in Terminal:
#
#   zsh scripts/macos-capture.sh
#
# It writes sections/macos/capture.txt: each command the course's family cards quote for macOS, and
# its real output. Look it over, then commit it.
#
# It changes nothing on the Mac: no sudo, nothing installed, no setting touched. Its only writes are
# that one file in this repo and a temporary folder (two small text files and a throwaway SSH key —
# never ~/.ssh) that it deletes on exit, even on failure.
#
# Nothing identifying reaches the file. All output passes through `hide` at the end:
#   - your user name → ana, and your computer's names (local host name, short host name, computer
#     name) → MacBook — whole words only, so a short name cannot corrupt other text;
#   - any MAC address → xx:xx:xx:xx:xx:xx, any IPv4 address other than 127.x and 0.0.0.0 → x.x.x.x;
#   - the temporary folder → /tmp/lab.
# And the commands themselves are cut to what a family card needs, so they print no addresses in the
# first place: ifconfig and netstat show only their header lines, the admin group is asked "is ana in
# it?" rather than listed (no other accounts' names), and the unified log is shown to exist without
# printing any of its entries.
set -u
cd "$(dirname "$0")/.." || exit 1
out=sections/macos/capture.txt
mkdir -p sections/macos
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

me=$(id -un)
lhost=$(scutil --get LocalHostName 2>/dev/null || true)
shost=$(hostname -s 2>/dev/null || true)
cname=$(scutil --get ComputerName 2>/dev/null || true)

hide() {
  H_ME=$me H_L=$lhost H_S=$shost H_C=$cname H_T=$tmp perl -pe '
    BEGIN {
      @hosts = sort { length $b <=> length $a } grep { length } @ENV{qw(H_L H_S H_C)};
      $me = $ENV{H_ME}; $tmp = $ENV{H_T};
    }
    s/\Q$tmp\E/\/tmp\/lab/g;
    for my $h (@hosts) { s/(?<![\w-])\Q$h\E(?![\w-])/MacBook/g }
    s/(?<![\w-])\Q$me\E(?![\w-])/ana/g;
    s/\b(?:[0-9a-f]{2}:){5}[0-9a-f]{2}\b/xx:xx:xx:xx:xx:xx/gi;
    s/\b(?!127\.|0\.0\.0\.0\b)(?:\d{1,3}\.){3}\d{1,3}\b/x.x.x.x/g;
  '
}

# One command: its line, then everything it printed (stdout and stderr, in order), then its exit
# status — a family card needs to know a command FAILED, not only what it said.
run() {
  print -r -- "### $*"
  ( cd "$tmp" && eval "$*" ) 2>&1
  print -r -- "### exit $?"
  print
}

{
  print "# macOS capture — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  print "# masked: user name → ana, computer names → MacBook, MAC → xx:xx:xx:xx:xx:xx, IPv4 → x.x.x.x"
  print
  # The prompt as zsh draws it by default, in the home folder as a new Terminal window opens (the
  # course's console needs its exact shape).
  run 'cd ~ && print -rP "%n@%m %1~ %# "'
  run 'echo $SHELL; zsh --version'
  run 'sw_vers'
  run 'uname -sr'
  # macOS is Unix-like, not Linux: no /proc, no os-release, no ip/ss, BSD tools.
  run 'ls /proc'
  run 'cat /etc/os-release'
  run 'ip addr'
  run 'ifconfig en0 | head -1'
  run 'ss -tln'
  run 'netstat -an -p tcp | head -2'
  run 'ls --version'
  run 'sed --version'
  run 'printf "hello\n" > f.txt; sed -i "" "s/hello/hi/" f.txt; cat f.txt'
  run 'printf "hello\n" > g.txt; sed -i "s/hello/hi/" g.txt; cat g.txt'
  run 'id -Gn'
  run 'dsmemberutil checkmembership -U "$(id -un)" -G admin'
  run 'command -v log && log help 2>&1 | head -1'
  # The laptop side of the course: SSH, keys, rsync.
  run 'ssh -V'
  run 'ssh-keygen -t ed25519 -N "" -C ana@MacBook -f ./id_ed25519'
  run 'ls -l id_ed25519 id_ed25519.pub'
  run 'command -v ssh-copy-id rsync brew'
  run 'rsync --version | head -2'
  run 'brew --version | head -1'
} 2>&1 | hide > "$out"

print "wrote $out — please look it over, then commit it"
