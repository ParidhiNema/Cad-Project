#!/usr/bin/env bash
# Safe bounded sensor exercise in a disposable test VM, NOT the full Member-3 benchmark.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -r /proc/pressure/memory ]] || { echo 'PSI unavailable: run in project Ubuntu VM' >&2; exit 1; }
[[ $(stat -fc %T /sys/fs/cgroup) == cgroup2fs ]] || { echo 'Requires cgroup v2' >&2; exit 1; }
mkdir -p samples
cc -std=c11 -O2 -Wall -Wextra -o tests/leaker tests/leaker.c
cc -std=c11 -O2 -Wall -Wextra -o tests/shared_decoy tests/shared_decoy.c
./oomsense --once > samples/01_idle.jsonl
./tests/leaker & workload=$!
trap 'kill "$workload" 2>/dev/null || true; wait "$workload" 2>/dev/null || true' EXIT
sleep 6
./oomsense --interval-ms 500 --window 4 | head -n 12 > samples/02_leaker.jsonl
wait "$workload" || true
trap - EXIT
./tests/shared_decoy & decoy=$!
trap 'kill "$decoy" 2>/dev/null || true' EXIT
sleep 2
./oomsense --once > samples/03_shared.jsonl
wait "$decoy" || true
trap - EXIT
for f in samples/*.jsonl; do python3 tests/validate_json.py < "$f"; done
printf 'Captured 3 genuine snapshots. Confirm PSS/USS and sensor trends manually.\n'
