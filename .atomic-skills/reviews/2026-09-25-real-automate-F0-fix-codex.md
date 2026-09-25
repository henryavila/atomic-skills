### Findings

1. **Critical — the startup probe can approve a hook that never runs.**  
   **WHAT/WHY:** [src/automate-host-pen.js:156](/Volumes/External/code/atomic-skills/.worktrees/real-automate/src/automate-host-pen.js:156) accepts `bash -n <path>/automate-pen.sh`, but [scripts/automate-run.js:235](/Volumes/External/code/atomic-skills/.worktrees/real-automate/scripts/automate-run.js:235) probes the script without `-n`. Registration accepts that command, and `bash -n` returns 0 after checking syntax without executing the pen. **Impact:** startup can pass while the host permits writes under a lock. **Recommendation:** reject behavior-changing Bash flags and probe the exact command the host will execute.

2. **Critical — relative write paths can escape the writer worktree.**  
   **WHAT/WHY:** [src/automate-host-pen.js:245](/Volumes/External/code/atomic-skills/.worktrees/real-automate/src/automate-host-pen.js:245) resolves a relative tool path against `writerWorktree`. A patch targeting `src/a.js` therefore passes the check for `/tmp/writer`, even when the host applies it relative to the project’s working directory. I confirmed `decidePen` allows this case. **Impact:** a locked chat session can write to the project outside the writer worktree. **Recommendation:** resolve relative paths against the tool’s actual working directory, then compare the resulting target with the worktree.

3. **Major — symlinks bypass the path boundary.**  
   **WHAT/WHY:** [src/automate-host-pen.js:245](/Volumes/External/code/atomic-skills/.worktrees/real-automate/src/automate-host-pen.js:245) normalizes path text but does not resolve filesystem symlinks. A path under `/tmp/writer/link/` passes even if `link` points outside the worktree. **Impact:** writes through an existing symlink can reach files outside the allowed tree. **Recommendation:** compare canonical filesystem paths and define how nonexistent output paths are checked through their existing parent directories.

4. **Major — a failed external review can still satisfy the receipt gate.**  
   **WHAT/WHY:** [scripts/find-unreviewed-plans.js:60](/Volumes/External/code/atomic-skills/.worktrees/real-automate/scripts/find-unreviewed-plans.js:60) takes the first `exit=` and `verdict=` anywhere on the line. I confirmed it accepts `note=exit=0 verdict=PASS | command=missing | exit=127 verdict=FAIL`. **Impact:** `--require-external` can pass a plan whose recorded review failed. **Recommendation:** parse delimited fields, require exactly one exit and verdict, and reject conflicting or embedded tokens.

These checks were read-only; no files were changed.