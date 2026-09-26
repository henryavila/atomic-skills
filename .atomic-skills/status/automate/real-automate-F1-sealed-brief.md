# Phase writer brief — real-automate F1

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
- **phaseId:** F1
- **initiativePath:** /Volumes/External/code/atomic-skills/.worktrees/real-automate/.atomic-skills/projects/atomic-skills/real-automate/phases/f1-cartao-de-bloco.md (read-only)
- **worktreePath (cwd):** /Volumes/External/code/atomic-skills/.worktrees/real-automate-F1-fix1
- **writerBranch:** impl/real-automate-F1-fix1
- **baseRef:** 2ddbc40613b530259c5330943f2a0ad349ce49ea
- **decisionLogPath:** /Volumes/External/code/atomic-skills/.worktrees/real-automate/.atomic-skills/projects/atomic-skills/real-automate/decisions/F1.jsonl (informational — host owns append; do not write)

### Tasks (3)

#### T-001 — Formato do cartão
- status: active
- paths: ["scripts/find-missing-architecture.js","tests/find-missing-architecture.test.js"]
- scopeBoundary: ["Do not treat find-missing-design-process.js or userApproved as this card.","Do not implement UI prototype or find-missing-ui.js (F2).","Do not spawn a writer."]
- acceptance: ["it - architecture/decisions.json schema has delimiter, outside list, mix line, second sketch, chosen sketch.","it - chat ok does not stamp ratifiedAt.","it - node scripts/find-missing-architecture.js --strict on a fixture without a card exits 1."]
- verifier: {"kind":"shell","command":"node --test tests/find-missing-architecture.test.js","expectExitCode":0}

#### T-002 — Detector
- status: active
- paths: ["scripts/find-missing-architecture.js","tests/find-missing-architecture.test.js"]
- scopeBoundary: ["Do not accept userApproved or find-missing-design-process.js as this detector.","Do not implement F2 UI stamp."]
- acceptance: ["it - exit 0 only with sha and ratifiedAt.","it - vague phrases without the drawing fail.","it - node --test tests/find-missing-architecture.test.js exits 0."]
- verifier: {"kind":"shell","command":"node --test tests/find-missing-architecture.test.js","expectExitCode":0}

#### T-003 — A partida passa a exigir o detector
- status: active
- paths: ["scripts/automate-run.js","tests/automate-host-pen.test.js"]
- scopeBoundary: ["Do not spawn a writer.","Do not only existsSync the detector file."]
- acceptance: ["it - automate-run.js invokes find-missing-architecture.js.","it - fixture without a card exits 1 with the detector reason."]
- verifier: {"kind":"shell","command":"node --test tests/find-missing-architecture.test.js","expectExitCode":0}

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
