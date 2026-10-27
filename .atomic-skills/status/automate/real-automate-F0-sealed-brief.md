# Phase writer brief — real-automate F0

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
- **phaseId:** F0
- **initiativePath:** /Volumes/External/code/atomic-skills/.worktrees/real-automate/.atomic-skills/projects/atomic-skills/real-automate/phases/f0-partida-que-recusa.md (read-only)
- **worktreePath (cwd):** /Volumes/External/code/atomic-skills/.worktrees/real-automate-F0-fix3
- **writerBranch:** impl/real-automate-F0-fix3
- **baseRef:** f94cea27471fb3450cc10c99d7156b7011a7e9e6
- **decisionLogPath:** /Volumes/External/code/atomic-skills/.worktrees/real-automate/.atomic-skills/projects/atomic-skills/real-automate/decisions/F0.jsonl (informational — host owns append; do not write)

### Tasks (3)

#### T-001 — Caneta dos três hosts
- status: active
- paths: ["src/automate-host-pen.js","scripts/automate-pen-hook.js","skills/shared/project-assets/hooks/automate-pen.sh","tests/automate-host-pen.test.js"]
- scopeBoundary: ["Do not delete or replace skills/shared/project-assets/hooks/pre-write.sh.","Do not change the pre-write.sh matcher.","Do not change stop.sh.","Do not spawn a writer, merge, run review both, audit flow, or open the next phase.","Do not implement F1–F5 product (architecture card, UI stamp, writer spawn, page).","Do not treat the operational pen.lock as the startup probe.lock."]
- acceptance: ["it - without a lock, automate-pen.sh exits 0 on a write payload.","it - an isolated probe.lock (not pen.lock) makes a write payload exit 2.","it - the pen matcher covers Write/Edit/MultiEdit/Bash, apply_patch/shell, and write/search_replace/run_terminal_command.","it - assessHostWrite is ok only when invokedHook and refused are true and no sentinel file was created.","it - node --test tests/automate-host-pen.test.js exits 0."]
- verifier: {"kind":"shell","command":"node --test tests/automate-host-pen.test.js","expectExitCode":0}

#### T-002 — Registro no plugin Grok e no setup
- status: active
- paths: ["src/providers/skills-file-set.js","skills/shared/project-assets/project-setup.md"]
- scopeBoundary: ["Do not delete or replace skills/shared/project-assets/hooks/pre-write.sh.","Do not change the pre-write.sh matcher.","Do not change stop.sh.","Do not spawn a writer, merge, run review both, audit flow, or open the next phase.","Do not implement F1–F5 product (architecture card, UI stamp, writer spawn, page).","Do not unregister or delete the existing pre-write.sh PreToolUse entry."]
- acceptance: ["it - src/providers/skills-file-set.js registers automate-pen.sh beside pre-write.sh.","it - the pen matcher includes apply_patch, Bash, shell, and run_terminal_command plus file tools.","it - skills/shared/project-assets/project-setup.md documents the same registration.","it - the pre-write.sh matcher is unchanged.","it - node --test tests/automate-host-pen.test.js exits 0."]
- verifier: {"kind":"shell","command":"node --test tests/automate-host-pen.test.js","expectExitCode":0}

#### T-003 — Partida que lista o que falta
- status: active
- paths: ["scripts/automate-run.js","scripts/find-unreviewed-plans.js","tests/automate-host-pen.test.js"]
- scopeBoundary: ["Do not delete or replace skills/shared/project-assets/hooks/pre-write.sh.","Do not change the pre-write.sh matcher.","Do not change stop.sh.","Do not spawn a writer, merge, run review both, audit flow, or open the next phase.","Do not implement F1–F5 product (architecture card, UI stamp, writer spawn, page).","Do not create pen.lock at startup.","Do not call scripts/automate-phase-run.js.","Do not count assessHostWrite with the host-write proof disabled.","Do not treat a session-written - internal: review line as an external receipt."]
- acceptance: ["it - find-unreviewed-plans.js --require-external exits 1 when the only review line is - internal: or there is no external CLI receipt.","it - automate-run.js startup calls find-unreviewed-plans.js --require-external.","it - startup creates and deletes an isolated probe.lock, requires hook exit 2 then 0, and never leaves pen.lock.","it - a real host write must be refused with no sentinel; assessHostWrite with the proof disabled does not count.","it - node scripts/automate-run.js --host codex --plan <fixture plan.md without flow> exits 1 citing automate-pen.sh and find-missing-architecture.js."]
- verifier: {"kind":"shell","command":"node --test tests/automate-host-pen.test.js","expectExitCode":0}

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
