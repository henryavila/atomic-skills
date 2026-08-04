# Dogfood checklist — audit-delivery hardening

Manual checks after F4 (and optionally after F1 for teeth-only). Tick only with observed skill text / assets — not intent.

## Four original failure modes (SM note-pipeline dogfood 2026-08-01)

| # | Failure | Skill must block | Observed? |
|---|---------|------------------|-----------|
| 1 | Half-migration (MCP/skills/docs/client dual paths) | Residual protocol mandatory; teaching/storage hits are findings | ☐ |
| 2 | Skip residual because product “mostly yes” | Residual default on; opt-out caps PARTIAL | ☐ |
| 3 | Skip reaudit after fixes | Composition: re-run / reaudit-entry; dual reaudit in F4 | ☐ |
| 4 | Green suite ⇒ CLOSED | Verdict gate forbids suite-only upgrade | ☐ |

## Craft

| Check | Observed? |
|-------|-----------|
| Every asset reachable from body (test green) | ☐ |
| EN status/verdict enums in source | ☐ |
| Templates loaded via READ_TOOL / ASSETS_PATH | ☐ |
| validate-skills green | ☐ |

## Ecosystem + implement hard-gate (D11)

| Check | Observed? |
|-------|-----------|
| Catalog disambiguates vs plan-end intentVsDelivered | ☐ |
| review-code when_not points here for delivery residual | ☐ |
| implement hard-requires `audit-delivery` before every phase-done (`deliveryAuditGate`) | ☐ |
| Skip path does **not** exist (`operatorSkip` / soft-suggest / optional waiver rejected) | ☐ |
| `canRunPhaseDone` / `assert-automate-gate --gate phase-done` fail closed without valid gate | ☐ |
| OPEN blocks; CLOSED allows; PARTIAL only with Accept Records (zero CRITICAL) | ☐ |

## Optional power (F4)

| Check | Observed? |
|-------|-----------|
| prosecution cannot emit RESOLVED | ☐ |
| residual-blind reaudit documented | ☐ |
| fix-composition-recipe references parallel-dispatch/fix | ☐ |
| --cross default off | ☐ |
