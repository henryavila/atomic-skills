**Counts:** blocker 1 / critical 3 / major 3 / minor 0 / note 0  
**Verdict:** needs_changes

1. **Blocker — [scripts/automate-run.js](/home/henry/atomic-skills/.worktrees/real-automate/scripts/automate-run.js:427)**  
   **Claim:** The runner launches the host CLI with no prompt, plan path, or usable stdin. The installed CLIs default to interactive sessions; the test substitutes a script that writes a file without instructions.  
   **Impact:** A real writer cannot receive the task, and may exit or time out without doing the planned work.  
   **Recommendation:** Use each host’s noninteractive invocation and pass the plan and writer instructions explicitly; test that invocation. **Confidence:** 0.99.

2. **Critical — [scripts/automate-run.js](/home/henry/atomic-skills/.worktrees/real-automate/scripts/automate-run.js:501)**  
   **Claim:** `pen.lock` records the child PID. Once the child exits, the coordinator still commits and merges, but another run treats the lock as stale and deletes it.  
   **Impact:** A second run can start while the first is merging, removing the write fence during an active session.  
   **Recommendation:** Keep lock ownership tied to the living coordinator through merge and cleanup. Add a concurrency test for the interval after writer exit. **Confidence:** 0.98.

3. **Critical — [scripts/automate-run.js](/home/henry/atomic-skills/.worktrees/real-automate/scripts/automate-run.js:369)**  
   **Claim:** Lock acquisition uses an ordinary overwriting write after a separate existence check. Two runs for different plans can both pass the check, overwrite the same lock, and each later delete it unconditionally.  
   **Impact:** Both writers can run without reliable mutual exclusion.  
   **Recommendation:** Create the lock exclusively and remove it only when its ownership token matches. **Confidence:** 0.98.

4. **Critical — [scripts/automate-run.js](/home/henry/atomic-skills/.worktrees/real-automate/scripts/automate-run.js:515)**  
   **Claim:** A merge conflict throws, but cleanup releases both fences without aborting the merge.  
   **Impact:** The plan checkout remains in a conflicted merge with no active lock protecting it.  
   **Recommendation:** On merge failure, abort or otherwise settle the merge before releasing the fences; test a concurrent change that causes a conflict. **Confidence:** 0.97.

5. **Major — [scripts/automate-run.js](/home/henry/atomic-skills/.worktrees/real-automate/scripts/automate-run.js:525)**  
   **Claim:** Failure or timeout force removes the writer worktree, including uncommitted edits made before the failure.  
   **Impact:** Partial writer work is irrecoverably lost.  
   **Recommendation:** Preserve a failed worktree for recovery, or capture its changes before removal. **Confidence:** 0.97.

6. **Major — [scripts/automate-run.js](/home/henry/atomic-skills/.worktrees/real-automate/scripts/automate-run.js:481)**  
   **Claim:** The writer branch is created with `-b` on every run, but cleanup never deletes or reuses it.  
   **Impact:** A retry of the same plan and phase fails at `git worktree add`, including after a successful run.  
   **Recommendation:** Give attempts unique branch names or implement safe branch reuse and cleanup. **Confidence:** 0.99.

7. **Major — [scripts/automate-run.js](/home/henry/atomic-skills/.worktrees/real-automate/scripts/automate-run.js:519)**  
   **Claim:** Timeout cleanup kills only the direct CLI process, then removes the lock. Tool subprocesses started by that CLI can survive.  
   **Impact:** Descendants may keep writing after the fence is gone or after the worktree is removed.  
   **Recommendation:** Manage the writer as a process group and wait for its termination before releasing the lock. **Confidence:** 0.91.