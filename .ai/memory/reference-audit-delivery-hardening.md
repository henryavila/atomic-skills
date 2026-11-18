# reference — audit-delivery hardening (2026-08-04)

Plan `atomic-skills/audit-delivery-hardening` on `develop` (pushed). Skill `audit-delivery` + hard-gate `deliveryAuditGate` on every phase-done.

## Product SSOT

- Body: `skills/core/audit-delivery.md` (medium-thin, lazy assets under `skills/shared/audit-delivery-assets/`)
- EN enums only: status `RESOLVED|PARTIAL|NO|N/A`, verdict `CLOSED|PARTIAL|OPEN`, reaudit `REGRESSION`
- Default RO audit; `audit-and-fix` composition/advanced not identity
- Default axes `product,residual`; residual opt-out caps PARTIAL
- Flags: `--mode`, `--axes`, `--depth=light|full`, `--cross=off|residual|critic|reaudit`, `--out`, `--no-fix`
- Intent Package hard admission; residual-hunt-protocol; verdict-gate Accept Record (CRITICAL never → CLOSED)

## deliveryAuditGate (never skippable under durable automate)

- Helper: `src/phase-delivery-audit-gate.js` — `buildDeliveryAuditGate`, `deliveryAuditGateHonesty`, `deliveryAuditAllowsClose`, content floor + authenticity
- Stamp: `{ status: passed, reportPath, verdict: CLOSED|PARTIAL, verifiedAt? }` — no `operatorSkip`, no `skipped`, OPEN never passed
- Wired in: `canRunPhaseDone`, `assert-automate-gate --gate phase-done` (phase-only resolve, no plan-root spoof; FS authenticity on report), `preflightPhaseDone` code `phase-done-delivery-audit-open`, `validate-state` GATE-R4 `checkDeliveryAuditGate`
- Schema: `meta/schemas/plan.schema.json` → `phaseDescriptor.deliveryAuditGate`
- Prose SSOT: implement HARD-GATE, implement-automate-maestro, project-transitions, implement-phase-writer
- Plan-end `intentVsDelivered` is **not** a substitute

## Review dogfood (post-land)

Local sealed review found 6 issues (schema missing, lifecycle skip, validate-state gap, forge-friendly path, root spoof, Mode-1 SSOT). Fixed in `82e1e5fa`. When landing a new phase gate: schema + lifecycle + validate-state + assert authenticity + docs same PR.

## Implement pure-maestro notes

- `docs/plans/*.md` classifies foreign until inventory exists — entry choice Promote/AS vs Foreign
- Claim exclusivity: prefer exclusive `commitShas[]` only (shared base/head endpoints fail validateClaimReport)
- Ground-truth `fp=` stales on initiative handoff substance; re-stamp before spawn
- `assert --gate phase-done` uses `currentPhase` — stamp gates **before** advancing pointer
- Mid-plan gate adoption: backfill done phases that lack the new stamp before validate-state GATE-R4
- `planEndReview` schema is strict (`additionalProperties: false`): legs only `provider`/`status`/`familyDifferent`; no free `at`/`receiptPath` on legs

## Ops

- Catalog/docs regen after catalog.yaml: `npm run generate-docs` + `validate-skills` + `check-docs`
- User validation still required for plan-end finalize (`userValidatedAt`); intentVsDelivered receipt already on plan
