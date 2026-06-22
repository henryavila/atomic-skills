# Rationalization tables — parallel-dispatch family (lazy)

Read on demand when a dispatch/audit decision tempts a shortcut. The one-liner
**Red Flags** stay resident in each skill body; these tables carry the refutation
detail (the load-bearing numbers and the "why") so the resident body stays lean.

## parallel-dispatch

| Temptation | Reality |
|------------|---------|
| "User gave vague input, I'll decompose myself" | Decomposition is input, not output. Redirect to brainstorming |
| "These tasks are clearly independent" | Clearly to whom? Show the grep output |
| "User asked for 7 agents, so 7 it is" | Cap at 5; past that, coordination cost > parallelism gain |
| "`git add .` is fine, agents have small scopes" | Sibling sessions share the working tree; broad stage contaminates |
| "Disjoint source paths = isolated agents" | Lockfiles, build artifacts, root config collide indirectly |
| "I'll paraphrase the user's task for the prompt" | Paraphrase loses intent. Copy user verbatim |
| "Limited to 5 ops so I'm done" | Convergence is the criterion, not count. Did you stop because you converged or because you capped? |
| "Confidence LOW but I'll send it anyway" | LOW is a refusal signal. Sequential is safer |
| "Audit is optional if agents are careful" | Careful ≠ correct. Every PR gets reviewed for a reason |
| "10 agents because I'm in a hurry" | 1 − 0.9¹⁰ ≈ 65% chance of ≥1 bug. Diminishing returns past 3-4 |
| "Batch id is overkill" | `git log --grep` earns its cost the first time you need rollback |

## parallel-dispatch-audit

| Temptation | Reality |
|------------|---------|
| "The commit exists, the work is done" | Empty commits and wrong content also commit fine. Open the file |
| "I can fix this architectural issue quickly" | You are the auditor, not the implementer. Escalate |
| "Pushing saves the user time" | The user decides when to propagate — don't preempt |
| "I'll revert the failed agent" | Reverts without user confirmation destroy recoverable work |
| "Minor issues — I can keep going past 5" | 5+ issues means the dispatch plan was wrong; piecemeal fixes hide the root cause |
| "Contradiction between docs? Pick one quietly" | Record the resolution — silent picks erase evidence |
| "Scope drift is fine if the code is better" | The user did not approve that change. Escalate |
| "Latest commit is recent but probably done" | <2 min is the HARD-GATE line. Confirm with user |
| "Plan file missing, I'll invent expected scopes" | That's degraded mode — announce it, don't pretend |
