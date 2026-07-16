# Cross-Model Review — Design Principles

## When to use

Use `review-plan` / `review-code` with an **external** mode when:
- Plan/spec is large or architecturally significant
- Code change is in a critical path (auth, data, infra)
- You want a second opinion from a **different model family** than the host (mitigates self-preference bias)

External modes: `--mode=codex`, `--mode=grok`, `--mode=both` (local → host
external default), `--mode=both-codex`, `--mode=both-grok`,
`--mode=external-both` (Codex then Grok, then merge — see below).

Use `--mode=local` (same-model sealed self-loop) when:
- Quick sanity check
- No external CLI available
- Iterating fast

Default (no `--mode=`, interactive TTY): Step 0 host-aware picker defaults to
`both` — local first, then the host's family-different external provider.

Host defaults (design D6): Grok host → Codex; Codex host → Grok; Claude /
Cursor / unknown → Codex. Same-family external requests are **not**
CROSS-MODEL REVIEW: interactive confirm→local; non-interactive HARD ABORT
unless `--accept-same-family-as-local` (records `provider: local`).

Canonical UX + routing: `skills/shared/codex-bridge-assets/review-mode-ux.md`,
`host-default-external.md`, `src/cross-model-host-default.js`.

## Core principles

### 1. Cross-family is the point
- Same-family review has documented self-preference bias (arXiv 2410.21819, 2508.06709, 2509.26464)
- Family-different external providers (Codex ↔ Grok ↔ Claude host pairings) supply an independent bias vector
- Same-model review remains useful but is a complement, not a replacement
- Product cadence label: **CROSS-MODEL REVIEW** (not "CODEX REVIEW"); receipt field `provider: codex|grok|local`

### 2. Briefing is factual, NOT narrative
- Intent narrative poisons the reviewer by up to -93pp detection rate (arXiv 2603.18740)
- Briefing contains: anti-framing directive + externally verifiable constraints + non-goals + out-of-scope
- Briefing does NOT contain: intent steelman, curated memory, authorship

### 3. Two-pass sealed envelope is always on (external legs)
- Pass 1: blind, without constraints
- Pass 2: reveals constraints; provider reconciles
- Delta blind→informed = empirical framing signal
- Cost: ~1.8x tokens, 2x latency — acceptable for cross-model review

### 4. Output is markdown, not JSON
- Findings with code snippets stay readable
- Host agents read markdown natively
- Frontmatter YAML minimum for programmatic parse (`provider`, `provider_version`, verdict, counts, framing_delta)

### 5. Provider resolves its own model
- Skill does NOT pass `--model` by default; each CLI uses its recommended default
- Override via explicit flag or provider debug listing when needed

## external-both merge contract

When `--mode=external-both`, **collect** Codex envelope then Grok envelope on the
**same cleaned artifact** (no re-capture, no triage/edit between legs). One
provider failure records `status: failed` and **continues** the other leg
(single-provider modes still abort). Then **merge**, then **human triage**.

Helper: `src/external-both-merge.js` (`mergeExternalBothFindings`). CLI:
`scripts/merge-external-both.js` (via package-root).

| Rule | Behavior |
|------|----------|
| **Merge key** | `file:line` + normalized claim (collapse whitespace, lowercase, strip trailing `.!?`) |
| **Severity conflict** | Keep the **higher** severity; `providers` lists both; losing severity stored as `otherSeverity` |
| **Equal severity** | Keep Codex body as primary; still dual provenance |
| **Provider status** | Explicit `succeeded \| failed \| skipped` per provider. Absent key = `skipped` (never treat absence as success). Derive `providersSucceeded` / `providersFailed` / `providersSkipped` from that map |
| **Partial failure** | Keep the successful provider's findings; surface the failed provider error; `partial: true`. Never drop the good half silently |
| **Both fail** | Empty findings + both errors; not partial (no successful half) |
| **Both / one skipped** | Skipped legs contribute no findings; not partial unless a sibling failed while another succeeded |
| **Triage** | Only after merge — human only; auto-apply of external findings is a non-goal |

Skill wiring: `skills/core/review-code.md` / `review-plan.md` Flow D;
`skills/shared/codex-bridge-assets/envelope-orchestration.md` § external-both;
`skills/shared/codex-bridge-assets/review-mode-ux.md`. Unit tests:
`tests/external-both-merge.test.js`.

## Anti-patterns

- Adding "## Why we chose this approach" to the briefing
- Injecting curated project memory to "help" the external reviewer
- Passing large files without need (context rot)
- Skipping pre-flight because "the CLI is installed"
- Accepting external verdict without triaging findings
- Treating same-family headless CLI as CROSS-MODEL REVIEW
- Silently remapping same-family to local in CI without `--accept-same-family-as-local`
- Dropping one external-both provider's findings when the other leg fails

## References

- Spec: `docs/superpowers/specs/2026-05-16-cross-model-review-design.md`
- Plan: `docs/superpowers/plans/2026-05-17-cross-model-review.md`
- Plan design (host matrix / D6–D8): `.atomic-skills/projects/atomic-skills/grok-build-integration/design.md`
- Memory: `.ai/memory/feedback-framing-llm-judge.md`
- Memory: `.ai/memory/feedback-formato-retorno.md`
