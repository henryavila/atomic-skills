# Cross-model review — host-aware picker + Claude session limit

**Date:** 2026-08-07  
**Area:** `review-plan` / `review-code` Step 0 + Claude external envelope

## Host-aware picker (not static Grok+Codex)

Routing already had three externals (`codex` → `grok` → `claude`) via
`externalBothLegs(host)` in `src/cross-model-host-default.js`. The interactive
picker in `review-mode-ux.md` was still a hardcoded Grok+Codex list and even
aliased `both-claude` as “force Grok”.

**Product rule:** primary picker options = **family-different** legs only.

| Host | Primary external options | external-both label |
|------|--------------------------|---------------------|
| grok | codex, **claude** | Codex then Claude |
| codex | grok, claude | Grok then Claude |
| claude | codex, grok | Codex then Grok |

Same-family external is **not** a default option (only via explicit `--mode=`).

Canonical UX: `skills/shared/codex-bridge-assets/review-mode-ux.md` +
`host-default-external.md`. Audit test:
`tests/cross-model-three-provider-audit.test.js`.

## Claude session limit exits 0

Dogfood: headless Claude prints only

```text
You've hit your session limit · resets 5:10pm (America/Sao_Paulo)
```

to **stdout** with **exit code 0** and non-empty output. Old envelope treated
that as a successful review and could burn a validation **retry**.

**Fix:**

- Pure: `src/provider-limit-failure.js` (`classifyProviderLimitFailure`)
- CLI: `scripts/classify-provider-limit.js` (exit 2 = limit)
- Envelope step **5b** before validation; `doNotRetry` on limit
- `external-both`: mark Claude leg `failed`, continue Codex/Grok
- single-provider: abort + suggest `--mode=codex`
- Optional preflight probe: `ATOMIC_SKILLS_CLAUDE_CAPACITY_PROBE=1`

While Claude is limited, prefer `--mode=codex` / `both-codex` (Grok host default
external is already Codex).
