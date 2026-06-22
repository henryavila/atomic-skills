# Work-order — `project-review-dedup` (Layer B of Decisão 8)

**Status:** open · **For:** the author of `skills/shared/project-assets/project-review.md`
(the `project review` composer) · **Origin:** worktree-lifecycle-finalization / F7 / T-004.

This is a **cross-branch work-order**, not an edit. `project-review.md` lives on the
skills-authoring branch (the `F4-skills` lane), NOT on `plan/worktree-lifecycle-finalization`.
This document DESCRIBES the change so its author applies it on that branch; do **not**
edit `project-review.md` from this plan branch.

It is the **Layer B** complement to the already-landed **Layer A** (the code legs:
`review-code` + `review-due`, which dedup via the surface-review ledger
`scripts/review-ledger.js` over `.atomic-skills/status/last-review.json` — anchor
`review-dedup`). Layer B adds a per-leg **run-record** for the `project review` composer
so a parallel-worktree composer run does not re-audit an already-audited surface.

## What to change (anchor: `project-review-dedup`)

1. **Per-leg run-record in the SAME `last-review.json` ledger.** When a composer leg
   completes, append one run-record:
   `{ auditedHead, auditedPlanSha, treeClean, verdict, fingerprint, mode, reviewedAt }`
   where `fingerprint` is the surface fingerprint (commit SHA + `git patch-id --stable`,
   same as Layer A). Use the Layer A module (`scripts/review-ledger.js`) `recordReview`
   — do not invent a second store. `auditedPlanSha` + `treeClean` capture the composer's
   extra inputs (the plan state it audited + whether the tree was clean), so a reuse is
   only honored when those match too.

2. **APPEND-ONLY carve-out to the composer's READ-ONLY policy — make it EXPLICIT.** The
   `project review` composer is otherwise read-only (it audits, it does not mutate project
   state). Writing this run-record is the ONE sanctioned write, and it is **append-only**:
   it appends an NDJSON line to the ledger (prior lines preserved byte-for-byte →
   `merge=union`-safe per F5), never rewrites or deletes prior records, never touches plan
   files / phases / gates. State this carve-out in the composer's mutation-policy section
   verbatim so the read-only contract and the one append are never confused.

3. **Per-leg reuse ONLY with proof of identical input.** A composer leg may skip its
   audit only when a prior run-record proves the SAME surface AND the same composer inputs
   were audited in the same mode: `fingerprint` matches (commit SHA or stable patch-id)
   AND `auditedPlanSha` matches AND `treeClean` matches. The **code leg defers to the
   Layer A ledger** (`alreadyReviewed`) and never re-implements the match. Reuse is
   per-leg: the composer leg's proof never discharges the code legs and vice-versa.

4. **Absent / non-set-shape guard → fail-para-RE-rodar.** Read the ledger with
   `readLedger`: a legacy pointer, an absent/empty/malformed `last-review.json`, or any
   content that is not the NDJSON set-shape reads as **"nothing audited"** → the leg
   RE-runs. Indeterminacy never skips an audit. This guard is what makes issuing this
   order across branches **mechanical**: the author wires the same fail-safe the code legs
   already use, so the two branches converge on one ledger contract without coordination.

## Skill-authoring guardrails (carry into the edit)

- Use the tool-abstraction variables, never hardcoded tool names: `{{BASH_TOOL}}`,
  `{{READ_TOOL}}`, `{{WRITE_TOOL}}`, etc. (see `docs/kb/gemini-cli-compatibility.md`).
- Keep cross-agent compatibility (`{{#if ide.*}}` where host-specific).
- `npm run validate-skills` MUST pass after the edit (schema_version 0.2).
- Add a deterministic grep anchor `project-review-dedup` in `project-review.md` so a
  future verifier can assert the wiring landed (mirrors Layer A's `review-dedup` anchor).
- Do not bump the Task schema for the run-record — it is a sidecar ledger record, like the
  Mode-2 `dispatch-log.json` telemetry (proven-first principle).

## Acceptance (for the author, on the skills branch)

- `project-review.md` documents the per-leg run-record
  (`{auditedHead, auditedPlanSha, treeClean, verdict, fingerprint}` in the same
  `last-review.json` ledger), the EXPLICIT append-only carve-out to its READ-ONLY policy,
  per-leg reuse only on proof of identical input (code leg defers to Layer A), and the
  absent-set-shape fail-para-RE-rodar guard — with the anchor `project-review-dedup`.
- `npm run validate-skills` passes.
