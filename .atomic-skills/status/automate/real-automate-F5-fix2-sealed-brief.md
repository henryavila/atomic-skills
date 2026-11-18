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
- **initiativePath:** /home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/status/automate/real-automate-F5-fix2-work-order.md (read-only)
- **worktreePath (cwd):** /home/henry/atomic-skills/.worktrees/real-automate-F5-fix2-writer
- **writerBranch:** impl/real-automate-F5-fix2-writer
- **baseRef:** a12145cc32a06d8b3fcac8f0a4b7ff182123baea
- **decisionLogPath:** /home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/projects/atomic-skills/real-automate/decisions/F5.jsonl (informational — host owns append; do not write)

### Tasks (2)

#### T-002 — Servidor
- status: pending
- paths: ["scripts/serve-flow.js","scripts/lib/serve-flow.js","src/plan-end-review.js","scripts/assert-automate-gate.js","tests/final-page-http.test.js","tests/plan-end-review.test.js","tests/assert-automate-gate.test.js","tests/implement-automate-contract.test.js","skills/shared/project-assets/project-finalize.md","skills/shared/project-assets/project-transitions.md"]
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

## Scoped second-review repairs

The operator authorizes fully automatic completion and these routine fixes. No approval questions. Code-only writer; no canonical state, real validation, publication, PR merge, or archive. F4 previously accepted phase-driver/first-time selection limitations stay out of scope.

[
  {
    "id": "R2-1",
    "taskId": "T-003",
    "severity": "major",
    "file": "scripts/automate-run.js",
    "line": 777,
    "claim": "Reviewed working-tree bytes can differ from pushed HEAD.",
    "repro": "Edit tracked source after PR failure; renewed review passes dirty bytes but defaultPr pushes unchanged committed HEAD.",
    "fix": "Stop on uncommitted product changes before publication (prefer before actual reviews/repair clones); allow owned operational files only. Real git/bare-remote regression must verify uploaded source."
  },
  {
    "id": "R2-2",
    "taskId": "T-002",
    "severity": "major",
    "file": "src/plan-end-review.js",
    "line": 425,
    "claim": "Normal finalize PR tracking invalidates current review and HTTP proof.",
    "repro": "After genuine button validation, append the documented references[] {kind:url,path:PR URL,label:PR #N}; archive/finalize guard rejects with unchanged delivered bytes.",
    "fix": "Normalize only proven lifecycle metadata/PR tracking in both review and presentation identity; preserve substantive delivered/reference changes. Update coupled finalize/archive instructions to use real sidecar/authenticated loader, never manually stamp timestamp."
  },
  {
    "id": "R2-3",
    "taskId": "T-002",
    "severity": "major",
    "file": "src/plan-end-review.js",
    "line": 496,
    "claim": "Nested tracked operational JSON outside .atomic-skills enters product identity; root prefix exclusion also omits legitimate root automate-*.js product.",
    "repro": "Tracked docs/demo/automate-plan-end-review.json or final-validation.json changes its own expected snapshot when written.",
    "fix": "Use exact owned operational artifacts relative to this plan directory plus existing state tree, not broad basename/prefix exemptions. Keep real source named automate-* hashed."
  },
  {
    "id": "R2-4",
    "taskId": "T-002",
    "severity": "major",
    "file": "scripts/lib/serve-flow.js",
    "line": 202,
    "claim": "Regex-only timestamp replacement corrupts quoted/folded YAML and body examples.",
    "repro": "Existing userValidatedAt: |- with indented ISO is removed only on first line, leaving invalid YAML after the real button writes. Quoted key may become duplicate.",
    "fix": "Handle the actual YAML field structurally/surgically while preserving body, other metadata, and sidecar separation. Use normalized timestamp omission in snapshots; genuine button remains sole writer."
  },
  {
    "id": "R2-5",
    "taskId": "T-003",
    "severity": "major",
    "file": "scripts/automate-run.js",
    "line": 713,
    "claim": "Native review CLI transport differs from direct JSON.parse stdout.",
    "repro": "Real Grok --json-schema review (exit0) returned {text:JSON-string,structuredOutput:object,stopReason:end_turn,...}; plain stdout also carried progress messages.",
    "fix": "Use native structured-output flags and strictly unwrap only known final provider messages (Grok structuredOutput/text, Claude structured_output/result, Codex completed agent-message NDJSON). Reject error/truncated/non-final transport and malformed report; preserve original process evidence. Actual example is in HOST /tmp/real-automate-scoped-review-tcu0w9xr/authority.out.json; consume only public response fields, never propagate thought."
  },
  {
    "id": "R2-6",
    "taskId": "T-003",
    "severity": "minor",
    "file": "scripts/automate-run.js",
    "line": 898,
    "claim": "Null intent rows throw outside controlled stop path.",
    "repro": "Audit intentVsDelivered=[{status:matched},null] throws rather than recording nao avanço on same origin.",
    "fix": "Validate row object/status and route malformed review data to the controlled HTTP stop; tests before production edit."
  },
  {
    "id": "R2-7",
    "taskId": "T-003",
    "severity": "minor",
    "file": "scripts/automate-run.js",
    "line": 872,
    "claim": "Brief JSON input construction and snapshot errors can throw outside the runtime stop contract.",
    "repro": "Malformed/missing architecture or flow JSON during saved workflow exits1 outside review catch.",
    "fix": "Guard runtime input/snapshot construction and return controlled nao avanço when preview can still serve; do not weaken the startup six detectors."
  }
]

Dismissed findings (do NOT implement):
[
  {
    "claim": "YAML unquoted ISO parsed as Date",
    "reason": "Actual yaml.parse in installed dependency returned string, isDate=false; no type conversion needed."
  },
  {
    "claim": "external-both requires two family-different legs in this new runner",
    "reason": "Existing planEndReviewOk requires >=1 succeeded known family-different provider; default review actually invokes separate local + selected external and checks both verdicts. Preserve actual provenance; do not invent another provider."
  },
  {
    "claim": "Audit repair does not advance cap and loops forever",
    "reason": "Actual code sets state.reviewRounds[stage]=state.round+1 before invalidation; entering audit reads this budget. Existing real repair/cap regressions pass. Do separately check no fourth plan review after successful third plan round and audit source repair."
  },
  {
    "claim": "Hyphenated graph IDs rejected",
    "reason": "Actual flow.schema id excludes hyphens and shared coverage parser matches the same grammar; not a defect."
  }
]

Additional bounded caller compatibility: readFinalPlan currently uses sidecar only when inline receipt absent. A current program-owned sidecar must be consumable even with a legacy inline receipt; test genuine final workflow/HTTP recovery, never silently trust stale inline state.

Native producer defaults must use supported structured flags (Grok actual --json-schema envelope shown; Claude supports --json-schema + --output-format json; Codex supports --json + --output-schema). Keep injected direct JSON fixtures compatible. Never regex-search arbitrary PASS text. Useful formal schema can be saved as an owned operational artifact; use exact exclusions/dirty-file classification.

Coupled T-002 docs explicitly admitted: skills/shared/project-assets/project-finalize.md and project-transitions.md. Update authenticated gate loader/sidecar guidance and replace session-written userValidatedAt instructions with the HTTP button. Respect template tool variables in skill .md files; EN bodies; do not increase core byte budgets. Read actual old docs and preserve unrelated flows.

T-003 also admits tests/automate-run-writer.test.js. T-002 shared fixtures already admitted. Use exclusive microcommits/SHAs by task. Add meaningful real HTTP/git/subprocess reproductions, watch RED, then fix. Plan-round budget test must include a third successful plan review followed by audit source repair; do not silently run a fourth plan review or overwrite reports.

Write fix-only claims T-002/T-003 to HOST /home/henry/atomic-skills/.worktrees/real-automate/.atomic-skills/status/automate/real-automate-F5-fix2-claims.json with actual transcripts. Root retains lease secret.
