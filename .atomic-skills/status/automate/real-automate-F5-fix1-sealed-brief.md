# Phase writer brief — real-automate F5

You are a **code-only phase writer** implementing plan tasks in an isolated sibling worktree.
This sealed brief is self-contained. **No host chat history is included or authorized.**

## Code-only fence (HARD)

You are a **code-only phase writer**. You MAY:
- Orient on the phase work-order (task ids, paths, scopeBoundary, acceptance, verifier).
- Edit product/source paths inside each task's admitted targets (respect scopeBoundary exclusions).
- Run pre-close self-check verifiers for confidence.
- Create **implementation** microcommits with explicit paths only (`rtk git add <paths>` — never `git add .` / `-A`).
- Return a structured **claim report** for every task you attempted.

You **MUST NOT**:
- Invoke `done`, `phase-done`, finalize, archive, or any project-skill state transition.
- Mutate durable `.atomic-skills/` project state (plan.md, phase initiatives, rollups, lessons, review receipts, handoff).
- Mark tasks `status: done` in initiative YAML (orchestrator closes).
- Self-certify: a claim is confidence, not closure.
- Nest a phase worktree under the plan worktree.
- Depend on host chat history (this sealed brief is the full packet).

Never claim Layer 4 shipped. Never commit writer-lease secrets.

## Phase work-order

- **planSlug:** real-automate
- **phaseId:** F5
- **initiativePath:** /home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/status/automate/real-automate-F5-fix1-work-order.md (read-only)
- **worktreePath (cwd):** /home/henry/atomic-skills/.worktrees/real-automate-F5-fix1-writer
- **writerBranch:** impl/real-automate-F5-fix1-writer
- **baseRef:** 8f39b92b75b18557dcd516e3043100583c045f3d
- **decisionLogPath:** /home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/projects/atomic-skills/real-automate/decisions/F5.jsonl (informational — host owns append; do not write)

### Tasks (2)

#### T-002 — Servidor
- status: pending
- paths: ["scripts/serve-flow.js","scripts/lib/serve-flow.js","src/plan-end-review.js","scripts/assert-automate-gate.js","tests/final-page-http.test.js","tests/plan-end-review.test.js","tests/assert-automate-gate.test.js","tests/implement-automate-contract.test.js"]
- scopeBoundary: ["Do not serve the final page as file://.","Do not let a session-written userValidatedAt pass finalize.","Do not stop serving flow.html preview from serve-flow.js."]
- acceptance: ["it - the final view does not open as file://.","it - the button stays off while any phase deliveryAuditGate is not passed.","it - serve-flow.js still serves the flow.html preview.","it - the button is the only writer of userValidatedAt.","it - a session-written timestamp fails userValidationOk and assert-automate-gate --gate finalize."]
- verifier: {"kind":"shell","command":"node --test tests/final-page-http.test.js","expectExitCode":0}
- weight: 1

#### T-003 — Paradas
- status: pending
- paths: ["scripts/automate-run.js","tests/automate-run-stops.test.js"]
- scopeBoundary: ["Do not reinstall a stop per phase after resume.","Do not merge the PR.","Do not archive in the PR command."]
- acceptance: ["it - travei, não avanço, and mudança grande open the same origin.","it - confirmation is recorded in the log.","it - the program resumes without reinstalling a stop per phase."]
- verifier: {"kind":"shell","command":"node --test tests/automate-run-stops.test.js","expectExitCode":0}
- weight: 1

## Claim report (required output)

Write the claim report JSON to: `.atomic-skills/status/automate/real-automate-claims.json`

Envelope shape:
```json
{
  "planSlug": "<planSlug>",
  "phaseId": "<phaseId>",
  "worktreePath": "<cwd>",
  "writerBranch": "<branch>",
  "finishedAt": "<ISO>",
  "tasks": [
    {
      "taskId": "T-00N",
      "status": "claimed-pass|claimed-fail|blocked|skipped",
      "commitShas": ["..."],
      "base": null,
      "head": null,
      "paths": ["..."],
      "verifierCommand": "...",
      "exitCode": 0,
      "transcript": "..."
    }
  ]
}
```

Rules:
- Array key is **`tasks`** (canonical; `claims` is a tolerated alias only).
- Open claims need commit identity: non-empty `commitShas[]` **or** `base`+`head`.
- Open claims need `paths[]` ≥1 non-empty path, `verifierCommand`, `exitCode`, `transcript`.
- `claimed-pass` requires `exitCode === 0`.
- Multi-task exclusivity: do not share bare SHAs across open claims without exclusive `base`+`head` per task.
- Prefer exclusive `base`+`head` per task when multi-task commits share SHAs.
- Do not invent pass for missing work-order tasks.

## Exit

1. All listed verifiers green for claimed-pass tasks (self-check).
2. Write claim report to `.atomic-skills/status/automate/real-automate-claims.json`.
3. Final message: summary of files changed, commit SHAs, claim report path, any blockers.
4. Do not mark tasks done in YAML. Do not call done/phase-done.

---
sealed-brief: true
host-chat-history: excluded

## Mandatory scoped review corrections

User explicitly authorizes full automatic implementation and corrections; no intermediate permission questions. Existing F4 accepted phase-driver/first-time selection limitations are out of scope. Code-only writer in the sibling worktree; no canonical state changes or operator validation.

[
  {
    "id": "F-001",
    "severity": "major",
    "file": "scripts/automate-run.js",
    "line": 789,
    "claim": "Non-complete PR/audit resume overwrites saved reviewed inputs before comparing them.",
    "reproduction": "Saved stage=pr/snapshot OLD + source NEW returns pr-open after zero reviews.",
    "recommendation": "Compare every saved stage before updating inputs. Source changes or audit repairs must invalidate earlier whole-plan reviews while preserving cap and durable resume semantics."
  },
  {
    "id": "F-002",
    "severity": "major",
    "file": "scripts/automate-run.js",
    "line": 812,
    "claim": "Default repair receives the original review brief and drops the actual current findings.",
    "reproduction": "Major UNIQUE_CURRENT_FAILURE_TO_REPAIR is absent from captured writer prompt; operation remains review-whole-plan.",
    "recommendation": "Deliver an explicit bounded repair prompt, current findings/evidence and required verification through supported noninteractive writer invocation, including proper stdin."
  },
  {
    "id": "F-003",
    "severity": "major",
    "file": "scripts/lib/serve-flow.js",
    "line": 88,
    "claim": "A fresh page validates changed source using stale completed reviews.",
    "reproduction": "Complete review for v1, change source to v2, GET a fresh final page and POST its authentic form: HTTP200 and final gate true with old review snapshot.",
    "recommendation": "Bind successful plan-end reviews to source/input identity and enforce it in the button plus proof reader/final gate. Missing/stale review identity must fail closed; positive fixtures must have authentic current reviewed evidence."
  },
  {
    "id": "F-004",
    "severity": "major",
    "file": "scripts/automate-run.js",
    "line": 819,
    "claim": "OPEN verdict can advance if findings are medium or lower; combined review discards local verdict.",
    "reproduction": "Plan PASSED; audit OPEN + medium finding + intent missing + coverage nao faz produces succeeded receipt and opens PR.",
    "recommendation": "Require accepted stage-specific verdicts from both legs in addition to severity. An OPEN leg must not be turned into successful receipt. Keep the three-round repair/stop semantics."
  },
  {
    "id": "F-005",
    "severity": "minor",
    "file": "tests/implement-automate-contract.test.js",
    "line": 263,
    "claim": "Shared test still expects an ISO timestamp alone to validate.",
    "reproduction": "Full suite adds one failure beyond the 28 baseline failures; old expectation true vs actual false.",
    "recommendation": "Migrate obsolete expectation to the new authenticated contract without weakening gate; retain positive HTTP evidence checks."
  }
]

### Test list (reproduce before production edits)
1. PR failure then source edit then confirmed resume cannot reuse stale reviews. Unchanged retry preserves reviews and idempotent PR.
2. Audit-stage repair that changes source must rerun the whole-plan review; maintain cap three and avoid unbounded resets.
3. Default real subprocess fixer receives unique current finding and repair operation on stdin; correct CLI argv; it actually changes the intended source, not just a mocked callback.
4. Refresh final page after source mutation cannot validate/finalize against stale reviews. Missing review binding fails closed; genuine current binding works via HTTP.
5. Local or external OPEN with medium/minor findings cannot mint success; accepted verdicts retain normal flow.
6. Fix shared obsolete timestamp expectation and run expanded keep-green including tests/implement-automate-contract.test.js.

T-002 paths explicitly also admit tests/plan-end-review.test.js, tests/assert-automate-gate.test.js, tests/implement-automate-contract.test.js. T-003 also admits tests/automate-run-writer.test.js. Other paths remain fenced.

Write fix-only claims for T-002 and T-003 to HOST /home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/status/automate/real-automate-F5-fix1-claims.json. Exclusive SHAs per task. Avoid huge/minified test additions; readable tests/functions.
