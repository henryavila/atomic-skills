# brainstorm-hardening — dogfood checklist (F3 / T-011)

Manual checklist for a **multi-phase** `project new plan` (or standalone `atomic-skills:brainstorm` → handoff) after F0–F2 shipped. Use this when dogfooding; tick only after the named artifact or exit code is observed.

Exempt lanes (do **not** force this path): ad-hoc / single-task / `adopt` (R-ORCH-03).

## Brainstorm spine (Stage 2 / B0–B5)

| # | Step | What to verify | Pass when |
|---|------|----------------|-----------|
| 1 | **Interview** | B0 HALT spine (problem, in-scope, out-of-scope, done-when, stakes, sources); echo + explicit ratify | `## Interview` in `design.md`; bare `ok`/`yes` rejected without spine |
| 2 | **research-digest** | B0b repo-only research | `projects/<id>/<slug>/research-digest.md` has ≥1 repo path and ≥3 useful bullets (not filler) |
| 3 | **debate** | Always `atomic-skills:debate --gate` (no skip ladder) | Panel ran; contrarian present; Synthesis is ACTOR-only |
| 4 | **critic** | Fresh independent critic per `debate-assets/critic.md` | Binary **Approved** (or ceiling 3 then escalate — never silent advance) |
| 5 | **lint** | Section lint on design | `node scripts/lint-design.js projects/.../design.md` exit **0** |
| 6 | **design-gates** | Process receipt | `.atomic-skills/status/design-gates/<projectId>-<slug>.json` with `interviewAccepted`, `debateGate`, `researchDigest`, `criticVerdict`, `userApproved`, `status: ready` |

## Create-plan fidelity (router + stages)

| # | Step | What to verify | Pass when |
|---|------|----------------|-----------|
| 7 | **stage-N router** | Thin `project-create-plan.md` | Agent loads **only** `skills/shared/project-assets/new-plan/stage-N.md` for current N; does not preload 1–9 |
| 8 | **Stage 4** | PLAN precondition HARD-BLOCK | Before decompose: `lint-design` → `find-missing-design-process` → `find-weak-design` → `lint-source` all exit 0 |
| 9 | **assert-creation-stage** | Monotonic creation stage | After each stage close: `node scripts/assert-creation-stage.js <gate> --advance <stage> --write` exit 0; illegal skip / early `--ready` exit **1** |
| 10 | **draft-and-ratify** | F0 businessIntent (Stage 6) | Agent **drafts** value/workflow/rules/outOfScope/doneWhen; user ratifies Drafted via AskUserQuestion — not blank “must not pre-fill” |

## Detector smoke (optional local)

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
DESIGN="projects/<id>/<slug>/design.md"
DIGEST="projects/<id>/<slug>/research-digest.md"
DGATE=".atomic-skills/status/design-gates/<id>-<slug>.json"
CGATE=".atomic-skills/status/creation-gates/<id>-<slug>.json"

node "$PKG_ROOT/scripts/lint-design.js" "$DESIGN"
node "$PKG_ROOT/scripts/find-missing-design-process.js" "$DGATE"
node "$PKG_ROOT/scripts/find-weak-design.js" "$DESIGN" "$DIGEST"
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$CGATE" --advance design --write   # example; use next legal stage
```

## Pressure-test cross-link

Skip escapes mapped in `projects/atomic-skills/brainstorm-hardening/pressure-tests.md` (PT-1..PT-6): skip interview, skip debate, empty digest, assert-creation-stage skip, monólito ignore, Stage 4 detector skip.

## Out of scope for this checklist

- Stage 8 `review-plan` behavior changes (non-goal of brainstorm-hardening).
- Web research; BMAD technique CSV; ad-hoc/adopt debate force.
