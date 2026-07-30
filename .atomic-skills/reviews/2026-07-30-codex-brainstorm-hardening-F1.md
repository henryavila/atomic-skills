# Codex review — brainstorm-hardening F1

**mode:** codex  
**provider:** codex  
**provider_version:** codex-cli-0.146.0  
**ref:** d1b21407 (+ checkpoint 090b5d7)

## Findings

### P2 — Align installed prompts with expanded lint gate
- **File:** scripts/lint-design.js:35-37; skills/core/brainstorm.md:79-85; skills/shared/debate-assets/critic.md:29
- **Claim:** Runtime skill/critic still describe old REQUIRED set while lint-design hard-requires Context/Non-goals/Interview.
- **Impact:** Agents following skill prose can write designs that fail Stage 4 / B3 lint.
- **Disposition:** **accept (residual)** — F1 task paths admit only lint-design.js, tests, docs/catalog; skill/critic body update is follow-up outside T-004/T-005 scopeBoundary (record for dogfood/F2+ skill polish).
- **Confidence:** high

## Counts
open blocker/critical: 0
