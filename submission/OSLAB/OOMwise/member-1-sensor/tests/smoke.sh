#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./oomsense --help | grep -q -- '--once'
if ./oomsense --interval-ms 99 >/dev/null 2>&1; then echo 'FAIL: accepted invalid interval'; exit 1; fi
psi_file=""
if [[ ! -r /proc/pressure/memory ]]; then
  psi_file="$(mktemp)"; trap 'rm -f "$psi_file"' EXIT
  printf 'some avg10=0.00 avg60=0.00 avg300=0.00 total=0\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0\n' > "$psi_file"
  export OOMSENSE_TEST_PSI_FILE="$psi_file"
  echo 'WARNING: kernel PSI not available here; using TEST-ONLY PSI fixture.' >&2
fi
./oomsense --once | python3 tests/validate_json.py
# Ten samples test that warmup ends; may take >= 1 second.
./oomsense --interval-ms 100 --window 3 | head -n 6 | python3 tests/validate_json.py
printf 'PASS: CLI, stream, JSON v1 schema and closed pipe\n'
