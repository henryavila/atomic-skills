# Phase writer brief — automate-writer-runtime (FULL PLAN F0–F3)

You are a **code-only phase writer**. The orchestrator owns `done` / phase-done / plan state closes.

## HARD fence

MAY: edit product/source paths listed below; run verifiers; microcommit with explicit paths (`rtk git add <paths>` never `git add .` / `-A`).

MUST NOT: invoke project `done` / `phase-done` / finalize; mutate task `status: done` in initiatives; write decision-review PASS; skip tests.

Return a **claim report** at the end (see bottom).

## Repo / branch

- CWD: atomic-skills repo worktree you were given
- Branch: work on current branch (plan/automate-writer-runtime or isolation branch)
- Design: `.atomic-skills/projects/atomic-skills/automate-writer-runtime/design.md` (read for fence algorithm + cursor notes)
- Plan: `.atomic-skills/projects/atomic-skills/automate-writer-runtime/plan.md`

## Implement ALL phases in order

### F0 — Skill recipe (#1)

**T-001** — Grok phase-writer spawn recipe
- Files: `skills/core/implement.md`, `skills/shared/implement-automate-maestro.md`, `skills/shared/implement-phase-writer.md`
- Add concrete Step C / pure-maestro spawn for Grok: `spawn_subagent` with `subagent_type: general-purpose` (NOT explore for coding), isolation or cwd = sibling phase worktree, constructed brief / sealed brief path, sync-wait.
- Explore reserved for heavy reads only.
- Host product coding under `isAutomateActive` forbidden next to spawn recipe.
- Rewrite misleading “coding stays single-threaded either way” so it cannot justify host product coding under automate.
- Keep `{{#if ide.grok}}` / tool template vars.
- Verifier: must contain `general-purpose` and spawn/subagent markers in those files.

**T-002** — Antipatterns + realism honesty
- Files: `skills/shared/implement-antipatterns.md`, `docs/kb/automate-orchestrator-realism.md`
- Document: prose alone does not force spawn; runner + fence are hard path; host product commit on plan branch under automate is red flag.
- Name `scripts/automate-phase-run.js` as Layer 3 CLI.
- Layer 4 remains non-goal.
- Guarantee: fence blocks **close**, not process-forced spawn.

### F1 — Layer 3 runner (A)

**T-003** — Pure modules
- `src/automate-work-order.js` — build work-order from initiative (planSlug, phaseId, tasks with paths/scope/acceptance/verifier, worktree placeholders, writerBranch, baseRef, decisionLogPath). Only pending/active SPEC-admitted tasks. Fail closed if missing SPEC.
- `src/automate-sealed-brief.js` — sealed brief string from work-order + code-only fence + claim-report shape; no host chat history.
- Tests: `tests/automate-work-order.test.js`, `tests/automate-sealed-brief.test.js`
- Verifier: `node --test tests/automate-work-order.test.js tests/automate-sealed-brief.test.js`

**T-004** — CLI
- `scripts/automate-phase-run.js` + `src/automate-phase-run-lib.js`
- Subcommands: `prepare` (work-order, acquire lease via `src/writer-lease.js`, sibling worktree NEVER nested under plan worktree, write sealed brief + claim path, print spawn instructions); `validate` (parse/validate claim-report via `src/claim-report.js`, optional reachability, print merge commands).
- Refuse prepare if lease blocking.
- Tests: `tests/automate-phase-run.test.js` with temp dirs, no network.
- Document CLI in realism Layer 3.
- Verifier: `node --test tests/automate-phase-run.test.js`

**T-005** — Skill Step C → runner
- Maestro Step C order: prepare → spawn → validate (before merge/done).
- Package-root resolution like other scripts in implement.md.
- Grep finds `automate-phase-run` in `skills/shared/implement-automate-maestro.md`.

### F2 — Product fence (B)

**T-006** — Pure fence
- `src/automate-product-fence.js` + `tests/automate-product-fence.test.js`
- Classify product vs state (`.atomic-skills/**` allowlisted).
- `planTreeProductFenceOk({ planBranchDiffPaths, claimPaths })` — product path in plan-branch diff without claim path coverage → `{ ok:false, reason }`. Empty product diff → ok.
- No git inside pure module.
- Verifier: `node --test tests/automate-product-fence.test.js`

**T-007** — Wire into assert done
- Integrate into `canDoneFromAutomateClaims` / `scripts/assert-automate-gate.js --gate done` under automate stamp.
- CLI boundary may collect git path lists and inject.
- Tests: extend `tests/assert-automate-gate.test.js`, `tests/automate-orchestrator-gates.test.js`
- Verifier: those tests + fence tests green.

**T-008** — Skill/docs for fence
- Maestro Step E mentions product fence / assert done failure.
- Antipatterns: host product commit on plan branch under automate.
- Realism updated.

### F3 — Integration

**T-009** — `npm test` green; `scripts/automate-phase-run.js` exists; package.json still includes scripts/ and src/.

**T-010** — Write:
- `docs/kb/automate-writer-runtime-dogfood.md` (prepare→spawn→validate→merge→assert done; fail case Mode-1 plan-tree product commit)
- Update realism link
- Ensure `.ai/memory/reference-automate-writer-runtime.md` exists/updated

## Microcommits

Prefer one microcommit per task or logical group:
`feat(T-00N): …` with explicit path adds only.

## Claim report (return this JSON in your final message AND write to disk)

Write to: `.atomic-skills/status/automate/automate-writer-runtime-claims.json`

```json
{
  "planSlug": "automate-writer-runtime",
  "phaseId": "F0-F3",
  "finishedAt": "<ISO>",
  "tasks": [
    {
      "taskId": "T-001",
      "status": "claimed-pass",
      "commitShas": ["..."],
      "paths": ["..."],
      "verifierCommand": "...",
      "exitCode": 0,
      "transcript": "..."
    }
  ]
}
```

Every task T-001..T-010 must appear. Prefer exclusive `base`+`head` per task if multi-task commits share SHAs.

## Done criteria before exit

1. All task verifiers exit 0 when run from repo root.
2. `npm test` exits 0.
3. Claim report written and summarized in final message.
4. Do not mark tasks done in YAML.
