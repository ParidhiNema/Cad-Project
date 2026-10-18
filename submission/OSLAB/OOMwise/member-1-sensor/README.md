# OOMwise / Member 1: `oomsense`

User-space, read-only Linux memory sensor and early-warning predictor. Implements **Section 3 (Snapshot Schema)** of the team's OOMwise Shared Integration Contract, `schema_version=1`. A C11 program outputs a UTF-8 JSON object per line (JSON Lines), with the default tick period of 500 ms. This module **never kills** anything.

## Intended operating environment

- **Final validation and all pressure experiments:** disposable Ubuntu 24.04 LTS VM with 2 GiB RAM, 2 vCPU, 1 GiB swap, Linux kernel >= 5.14, cgroup v2 and memory PSI enabled. Run sensor with `sudo` for accurate PSS and per-process memory.
- **Development only:** Ubuntu WSL2 can compile and run the program *if* `cat /proc/pressure/memory` and cgroup v2 are available. WSL2 differs from the VM in cgroup/systemd behavior and must not be used to claim final baseline/OOM performance.

Check environment:

```bash
cat /etc/os-release
uname -r
stat -fc %T /sys/fs/cgroup      # cgroup2fs
cat /proc/pressure/memory        # 'some' and 'full'
free -b
```

## Install, build, run

```bash
sudo apt update
sudo apt install -y build-essential libcjson-dev jq python3
cd member-1-sensor
make
sudo ./oomsense --once --pretty
sudo ./oomsense --interval-ms 500 --top 64 | head -n 5 | jq -c .
sudo ./oomsense | jq -r '.system.time_to_oom_s'
```

The Makefile builds `oomsense` using `gcc -std=c11 -O2 -Wall -Wextra -Wpedantic`, links **`-lcjson -lm`**, and uses `<cjson/cJSON.h>` when installed. The local `include/cjson_api.h` supplies only the matching public declarations for minimal build environments where the runtime library exists but developer headers are absent; Ubuntu installs the official header.

## Options

| Option | Default | Behavior |
|---|---:|---|
| `--interval-ms N` | 500 | Sample rate; >=100 ms |
| `--top N` | 64 | Top-N process candidates (maximum compiled limit 256) |
| `--window N` | 10 | Regression history (2–32 samples) |
| `--floor-pct P` | 3 | Critical headroom floor as % of total RAM |
| `--once` | off | One snapshot, with warmup=true, trend=null |
| `--pretty` | off | Human-readable multi-line JSON; not for pipelines |
| `--verbose` | off | Timing and warnings on stderr |
| `--help` | | Usage |

Stdout is reserved exclusively for JSON Lines in normal mode. Each line is flushed immediately. SIGINT/SIGTERM/SIGPIPE are handled; closed pipes terminate cleanly. Exit codes: 0 success/EOF, 1 runtime error, 2 arguments invalid; version-mismatch code 3 applies to readers (this program has no JSON input).

## Module layout

- `main.c`: CLI, signal handling, monotonic absolute sleep, tick loop and epoch timestamp.
- `system_collector.c`: `/proc/meminfo`, system memory PSI, byte conversions and headroom.
- `process_collector.c`: `/proc/<pid>/{stat,statm,status,cmdline,cgroup,oom_score,oom_score_adj,smaps_rollup}`, child counts, PSS/USS and tiered sampling.
- `cgroup_collector.c`: cgroup v2 memory files, PSI, refault delta rates, restart policy (cached `systemctl show`).
- `predictor.c`: headroom least-squares trend and PID/starttime-keyed process RSS trend.
- `json_writer.c`: JSON v1 serialization with a fixed-size **cJSON arena** (no cJSON heap allocations after initialization).
- `util.c`: bounded procfs reads and startup hardening.
- `tests/`: schema validation, smoke checks, bounded shared-memory and leak workloads.
- `samples/`: genuine VM snapshots to collect in Day 6.
- `report/sensing_and_early_warning.md`: prepared report methodology, with blanks for benchmark results.

## Design and sampling

1. System values are bytes. `headroom_bytes = mem_available + swap_free`. PSI percentages remain 0–100; cumulative PSI stall times use microseconds.
2. Each tick, scan numeric `/proc` entries and cheaply measure RSS; skip vanished processes and kernel threads. Rank candidate processes by RSS, use `smaps_rollup` for the top N only on every other tick, reuse valid `(pid,start_ticks)` cache values on alternating ticks, then sort sampled processes by PSS. Process totals count pre-cut eligible entries. **This is an approximation to global top-N PSS**, because PSS isn't calculated for every process; this deliberate trade-off follows Member 1 instructions.
3. RSS includes shared pages; PSS apportions them; USS = Private_Clean + Private_Dirty. If `smaps_rollup` is inaccessible, `pss=rss` and `uss=0` are **fallback placeholders, not accurate PSS/USS**. Use root and verify availability before experiments. Process cmdline is truncated to 128 bytes.
4. Cgroup entries are generated from unique paths of the reported processes. Unit restart policy is queried at most twice per tick and cached for 10 seconds, to avoid a burst of `systemctl show` calls. Unknown optional data uses JSON null.
5. Regression runs when `--window` measurements exist. The system uses a ring buffer of `(CLOCK_MONOTONIC time, headroom)`, least-squares slope `s` in bytes/s, and `time_to_oom_s = max(0, (headroom-floor)/(-s))` only for `s<0`; otherwise null. This predicts **crossing a configured floor**, not the precise moment of kernel OOM. Rapid bursts cannot be predicted by a straight-line model; Member 2 uses PSI and low MemAvailable for those.
6. Startup attempts `mlockall(MCL_CURRENT|MCL_FUTURE)` and `oom_score_adj=-1000`. Failures warn to stderr rather than terminate. The JSON serializer uses a static arena and preallocated output. Note: libc and `popen()` for cached service restart metadata may allocate internally; the strict zero-allocation requirement should be confirmed with allocator tracing in final evaluation.

## Tests and validation

```bash
make test
sudo ./oomsense --once | python3 tests/validate_json.py
sudo ./oomsense --verbose --interval-ms 500 > /dev/null
# Stop after 10 minutes; observe RSS in /proc/<sensor-pid>/status.
# In disposable project VM only:
sudo bash tests/vm_eval.sh
```

`tests/vm_eval.sh` creates **genuine** JSONL files under `samples/`, using a bounded leaker (200 MiB cap) and a shared-memory process pair (64 MiB). It is a **sensor checkout**, not the full evaluation (S1–S4 / baseline systems) owned by Member 3. Do not run unbounded OOM workloads on your main machine.

If the host lacks PSI, `make test` uses a **test-only synthetic PSI text fixture** to check the other collectors and schema. The actual sensor rejects unavailable PSI rather than silently producing fake production readings. `OOMSENSE_TEST_PSI_FILE` exists *only for that smoke test* and must never be enabled during experiments.

Target metrics (to record in the target VM): per-tick time under 50 ms for 64 processes, sensor RSS under 10 MiB, stable 10-minute soak, correct shared memory PSS/USS, time-to-floor prediction error at T-60/T-30/T-10 measured across five runs. These targets are **not yet verified**.

## Repo integration

The shared repo layout is `shared-schema/`, `member-1-sensor/`, `member-2-decider/`, `member-3-enforcer-eval/`. Push changes **only in `member-1-sensor/`**. The decider can consume `./oomsense --once | ./oomdecide` using the shared contract. Full VM pipeline:

```bash
sudo ./oomsense | ./oomdecide --policy cost | sudo ./oomenforce --events events.jsonl
```

Pipe a sample into `oomdecide` before enabling enforcement; Member 3 should run the final pipeline with `--dry-run` before real kills. Any schema change must be agreed with all three members; additive optional fields only after the Day 1 freeze.

## Caveats / limitations

- Requires an available PSI file for live operation, and a cgroup v2 system for full metrics.
- Kernel procfs security may prevent smaps access even with some elevated container credentials.
- `popen(systemctl show)` may be unavailable for WSL services; restart data is null in that case.
- `mlockall` and OOM adjustment can be denied by the environment; these safeguards must be checked inside the VM.
- Fixed caps: at most 8192 scanned processes, 256 reported, 256 cgroups and a 32-point history; warnings/caps exist to keep memory bounded. If caps are reached, results may be incomplete.
- Some values (especially estimated reclaimable memory, PSS top-N cut, and headroom trends) are estimates, not guarantees.
