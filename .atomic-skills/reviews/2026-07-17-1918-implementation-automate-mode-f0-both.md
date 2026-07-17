# Review — implementation-automate-mode F0 (phase)

**Ref:** e5fba8a..031dac9
**Mode:** both (local + codex; host=grok → external=codex)
**Date:** 2026-07-17

## Counts
- Local: 0B / 2C / 4M / 2m
- Codex: 0B / 1C / 4M / 0m

## Merged findings (orchestrator triage)

| # | Severity | Providers | File | Disposition |
|---|----------|-----------|------|-------------|
| 1 | critical | local+codex | plan-end-review familyDifferent fail-open | FIX |
| 2 | critical | local+codex | userValidationOk non-ISO | FIX |
| 3 | major | local | T-003 verifier smoke vs suite | FIX (state/spec) |
| 4 | major | local | userValidationOk omit automateActive | FIX (fail-closed doc or explicit) |
| 5 | major | local | weight string fail-open | FIX |
| 6 | major | codex | empty --mode= | FIX |
| 7 | major | codex | --mode=1 vs stamp | FIX (CLI non-automate overrides stamp for session) |
| 8 | major | codex | mode2 accepted | ACCEPT (known Mode 2 tokens reserved; not automate) |
| 9 | major | local | residual argv strip | DEFER F1 (maestro loop) |
| 10 | minor | local | clear boolean-ish / mode pin tests | FIX if cheap |

## Local raw
(see session transcript)

## Codex raw
(see /tmp/iam-f0-review/codex-out.md)
