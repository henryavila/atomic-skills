# Phase writer brief — release-consistency F2

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

- **planSlug:** release-consistency
- **phaseId:** F2
- **initiativePath:** /Volumes/External/code/atomic-skills/.worktrees/release-consistency/.atomic-skills/projects/atomic-skills/release-consistency/phases/f2-fixture-dogfood-as-stage-migration-catal.md (read-only)
- **worktreePath (cwd):** /Volumes/External/code/atomic-skills/.worktrees/release-consistency-F2-writer
- **writerBranch:** impl/release-consistency-F2-writer
- **baseRef:** f42dfb9b89df62123bceb9219e153db3cd76ade8
- **decisionLogPath:** /Volumes/External/code/atomic-skills/.worktrees/release-consistency/.atomic-skills/projects/atomic-skills/release-consistency/decisions/F2.jsonl (informational — host owns append; do not write)

### Tasks (3)

#### T-006 — Consumer fixture proves release contract
- status: pending
- paths: ["tests/fixtures/release-hygiene-consumer/","tests/release-fixture.test.js"]
- scopeBoundary: ["do not migrate .github/workflows/publish.yml yet; do not publish real packages to npm registry; do not weaken PR-only gate"]
- acceptance: ["fixture at tests/fixtures/release-hygiene-consumer/ includes sample package.json changelog and adopted stage workflow; tests assert chooser plan on fixture, refuse ship when Action missing without explicit GH-only opt-out, and save-and-push contract still refuses default push language; no network publish required"]
- verifier: {"kind":"shell","command":"node --test tests/release-fixture.test.js"}

#### T-007 — Migrate Atomic Skills publish.yml to npm stage
- status: pending
- paths: [".github/workflows/publish.yml","docs/kb/release-npm-stage.md","CHANGELOG.md"]
- scopeBoundary: ["do not reintroduce Bypass 2FA tokens; do not change installer journal effects; do not skip fixture gate — this task assumes T-006 green"]
- acceptance: ["publish.yml stages with npm stage publish under OIDC (no NODE_AUTH_TOKEN publish happy path); docs/kb/release-npm-stage.md documents Trusted Publisher stage-only and human stage approve; CHANGELOG notes the process change under Unreleased or the release section being cut"]
- verifier: {"kind":"shell","command":"rg -q 'stage publish' .github/workflows/publish.yml && ! rg -q '^\\\\s+- run: npm publish' .github/workflows/publish.yml && test -f docs/kb/release-npm-stage.md && rg -q 'stage approve|Trusted Publisher' docs/kb/release-npm-stage.md"}

#### T-008 — Catalog what_is_not reframe + skill docs sync
- status: pending
- paths: ["meta/catalog.yaml","README.md","docs/skills/save-and-push.md","docs/skills/release.md","tests/catalog-product-boundary.test.js"]
- scopeBoundary: ["do not claim AS replaces git workflow; do not remove host-tier honesty lines; do not change install primary command"]
- acceptance: ["product.what_is_not still says AS is not a git workflow replacement AND clarifies persistence/release skills impose agent gates (PR-only, stage+2FA, chooser); release and save-and-push docs mention the shared contract; catalog-product-boundary test asserts both clauses; generate/check docs path stays green if required by repo scripts"]
- verifier: {"kind":"shell","command":"node --test tests/catalog-product-boundary.test.js && npm run validate-skills"}

## Claim report (required output)

Write the claim report JSON to: `.atomic-skills/status/automate/release-consistency-claims.json`

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
2. Write claim report to `.atomic-skills/status/automate/release-consistency-claims.json`.
3. Final message: summary of files changed, commit SHAs, claim report path, any blockers.
4. Do not mark tasks done in YAML. Do not call done/phase-done.

---
sealed-brief: true
host-chat-history: excluded
