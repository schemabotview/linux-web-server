#!/bin/zsh
# The macOS capture: run ONCE on a Mac, from this repo's root, in Terminal:
#
#   zsh scripts/macos-capture.sh
#
# It writes spine/macos/capture.txt: each command the course's family cards quote for macOS, and its
# real output. Commit that file. It changes nothing on the Mac: no sudo, nothing installed, and every
# file it makes lives in a temporary folder it deletes. Your user name and computer name are replaced
# with `ana` and `MacBook` in the output (the course's laptop is Ana's); the file's header says so.
set -u
cd "$(dirname "$0")/.." || exit 1
out=spine/macos/capture.txt
mkdir -p spine/macos
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

me=$(id -un)
host=$(scutil --get LocalHostName 2>/dev/null || hostname -s)
hide() { sed -e "s/$me/ana/g" -e "s/$host/MacBook/g" -e "s|$tmp|/tmp/lab|g"; }

# One command: its line as the prompt shows it, then everything it printed (stdout and stderr, in
# order), then its exit status — a family card needs to know a command FAILED, not only what it said.
run() {
  print -r -- "### $*"
  ( cd "$tmp" && eval "$*" ) 2>&1 | hide
  print -r -- "### exit ${pipestatus[1]}"
  print
}

{
  print "# macOS capture — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  print "# user and computer name replaced: $me → ana, $host → MacBook"
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
  run 'ifconfig en0 | head -4'
  run 'ss -tln'
  run 'netstat -an -p tcp | head -4'
  run 'ls --version'
  run 'sed --version'
  run 'printf "hello\n" > f.txt; sed -i "" "s/hello/hi/" f.txt; cat f.txt'
  run 'printf "hello\n" > g.txt; sed -i "s/hello/hi/" g.txt; cat g.txt'
  run 'id -Gn'
  run 'dscl . -read /Groups/admin GroupMembership'
  run 'log show --last 1m --style compact | head -3'
  # The laptop side of the course: SSH, keys, rsync.
  run 'ssh -V'
  run 'ssh-keygen -t ed25519 -N "" -C ana@MacBook -f ./id_ed25519'
  run 'ls -l id_ed25519 id_ed25519.pub'
  run 'command -v ssh-copy-id rsync brew'
  run 'rsync --version | head -2'
  run 'brew --version | head -1'
} > "$out"

print "wrote $out — please look it over, then commit it"
