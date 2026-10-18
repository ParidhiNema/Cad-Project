# Genuine snapshots (required after VM execution)

Run `sudo bash tests/vm_eval.sh` in the agreed disposable Ubuntu 24.04 VM to create:

- `01_idle.jsonl` — an idle snapshot
- `02_leaker.jsonl` — a live series during the bounded allocation workload
- `03_shared.jsonl` — a snapshot of the shared-memory decoy

These files **are not supplied/generated beforehand** because they must be real measurements from the team's test VM. Commit the recorded files after reviewing them, along with measured tick cost, resident size, and prediction errors. This directory contains no fabricated readings.
