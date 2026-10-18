# Sensing and Early Warning — Member 1 (oomsense)

## Objective and integration

`oomsense` is a read-only C11 sensor that publishes a schema-version-1 JSON Lines snapshot every 500 ms, feeding `oomdecide` over a Unix pipe. It does not perform victim selection or kill workloads. It accesses Linux's existing `/proc` and cgroup v2 interfaces, requiring no kernel modification.

## Sensor measurements

System memory is parsed from `/proc/meminfo` (in bytes). We use `MemAvailable` rather than merely `MemFree`, because cached data is normally reclaimable; headroom adds available swap to available memory. System PSI from `/proc/pressure/memory` reports the fraction of wall time in which one or all tasks experienced memory stalls, across 10- and 60-second averages.

Process enumeration uses `/proc/<pid>/stat` and `statm` at every tick. To control overhead, we sample the costly `smaps_rollup` only for the N highest-RSS candidate processes on alternating ticks, caching by PID and start ticks. `RSS` double-counts shared pages, `PSS` apportions them, and `USS` includes only private clean and dirty resident pages. These distinctions help the decider avoid killing a large-looking shared-memory process with little individually reclaimable memory. Process runtime, CPU time, children, cgroup association and OOM scores provide additional cost-model features.

For each distinct cgroup containing a reported process, we read `memory.current`, `memory.max`, `memory.high`, `memory.stat`, `memory.pressure`, `memory.swap.current`, `memory.oom.group`, `cgroup.procs` and `cgroup.kill` availability. Refault delta over elapsed time estimates workload thrashing. We cache `systemctl show` restart policy queries for 10 seconds.

## Prediction and assumptions

We keep a sliding window of W monotonic `(timestamp, headroom_bytes)` readings (W=10). A least-squares slope estimates trend in bytes/s. When it is negative, we estimate seconds until `headroom_bytes` reaches a floor of 3% of total RAM. When stable or growing, the prediction is null; during warmup trend fields are null. Per-process RSS changes are estimated using histories keyed by `(pid,start_ticks)` to prevent PID-reuse confusion.

This is **not** an exact countdown to Linux kernel OOM. A sudden 1 GiB allocation cannot be forecast reliably by linear regression; PSI and available-memory triggers in Member 2 complement our slower trend predictor. PSS sampling also trades global completeness for bounded overhead.

## Robustness and performance

We use an absolute monotonic sleep deadline, fixed process/cgroup/history arrays, a cJSON arena allocator, stdout JSON flushing, signal handling and startup OOM protection attempts (`mlockall`, `oom_score_adj=-1000`). Permission failures and disappeared processes are tolerated where possible. Cached `systemctl show` is rate-limited, though libc/systemctl may allocate internally. The strict memory-resident safety target must be validated on Ubuntu 24.04 VM.

## Reproducible evaluation — fill in AFTER running on Ubuntu VM

| Experiment / metric | Contract target | VM measurement (to record) |
|---|---|---|
| Idle one-shot JSON schema | Every field type correct | Not measured yet |
| Tick CPU time, 64 processes | Under 50 ms | Not measured yet |
| Sensor resident RSS | Under 10 MiB | Not measured yet |
| 10-minute soak | No RSS growth | Not measured yet |
| Shared decoy test | USS much smaller than RSS | Not measured yet |
| 20 MiB/s leak | Positive RSS trend / negative headroom trend | Not measured yet |
| Stable system | Null time-to-floor estimate | Not measured yet |
| Five-run prediction error T-60/T-30/T-10 | Report mean error | Not measured yet |
| Fault tests | No crash on EACCES/ESRCH/EPIPE | Not measured yet |

For early-warning accuracy, run five independent controlled leak experiments and record the predicted and actual remaining time to reach the configured headroom floor when the real time left is 60, 30 and 10 seconds; report mean absolute error and spread. Obtain the three real sample files from the actual Ubuntu test VM rather than copying illustrative data from the contract.

## Conclusion (complete after evaluation)

The sensor supplies useful memory-pressure, footprint and trend features for cost-aware victim selection without changing the kernel. Final performance/accuracy claims must come from the VM experiments and comparison run by Member 3.
