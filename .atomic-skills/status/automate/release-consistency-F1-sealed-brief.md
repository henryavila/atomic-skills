# Phase writer brief — release-consistency F1

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
- **phaseId:** F1
- **initiativePath:** /Volumes/External/code/atomic-skills/.worktrees/release-consistency/.atomic-skills/projects/atomic-skills/release-consistency/phases/f1-skill-release-chooser-templates.md (read-only)
- **worktreePath (cwd):** /Volumes/External/code/atomic-skills/.worktrees/release-consistency-F1-writer
- **writerBranch:** impl/release-consistency-F1-writer
- **baseRef:** a065041e5914290f9e81019a3509cd292ef1af33
- **decisionLogPath:** /Volumes/External/code/atomic-skills/.worktrees/release-consistency/.atomic-skills/projects/atomic-skills/release-consistency/decisions/F1.jsonl (informational — host owns append; do not write)

### Tasks (3)

#### T-003 — Chooser scripts plan/apply/ship
- status: pending
- paths: ["scripts/release/semver-bump.js","scripts/release/release.js","tests/semver-bump.test.js","tests/release-cli.test.js"]
- scopeBoundary: ["do not edit skills/core/save-and-push.md; do not migrate .github/workflows/publish.yml; do not write into consumer repos from installer; do not auto bump to 1.0.0 on 0.x breaking"]
- acceptance: ["classifyBump maps feat/Added/Changed to minor, fix/Fixed-only to patch, 0.x breaking to minor; plan prints next version; apply rewrites package.json version and CHANGELOG Unreleased when present; ship refuses when kind is none or when npm version already published; tests cover feature-forbids-patch gate"]
- verifier: {"kind":"shell","command":"node --test tests/semver-bump.test.js tests/release-cli.test.js"}

#### T-004 — Release skill body + catalog entry
- status: pending
- paths: ["skills/core/release.md","meta/catalog.yaml","docs/skills/release.md","scripts/validate-skills.js"]
- scopeBoundary: ["do not migrate AS publish.yml; do not weaken save-and-push PR-only; do not add installer scaffolding of consumer .github"]
- acceptance: ["release.md Iron Law forbids inventing bump; documents plan/apply/ship via scripts/release; documents dual-mode npm scope and stage-only Action; catalog lists release under core with iron_law; validate-skills exits 0; docs/skills/release.md generated or authored in sync"]
- verifier: {"kind":"shell","command":"rg -q 'NO.*BUMP|não invent|never invent|chooser|semver-bump' skills/core/release.md && rg -q '^  release:' meta/catalog.yaml && npm run validate-skills"}

#### T-005 — Templates stage + GH-only and adopt/init flow
- status: pending
- paths: ["skills/shared/release-assets/templates/publish-stage.yml","skills/shared/release-assets/templates/publish-gh-only.yml","skills/shared/release-assets/adopt.md","skills/core/release.md","tests/release-adopt.test.js"]
- scopeBoundary: ["do not have installer reconcileFileSet write consumer workflows; do not remove uninstall parity tests; do not migrate live AS publish.yml in this task"]
- acceptance: ["publish-stage.yml uses release published trigger, id-token write, and npm stage publish (not bare npm publish); adopt.md requires dry-run/--check with template pin, show diff, write only after consent; release.md points at adopt; test asserts stage template has stage publish and lacks unprotected npm publish as happy path"]
- verifier: {"kind":"shell","command":"node --test tests/release-adopt.test.js"}

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
