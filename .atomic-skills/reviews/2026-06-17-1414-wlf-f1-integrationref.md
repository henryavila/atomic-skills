---
date: 2026-06-17T14:14:34Z
topic: wlf-f1-integrationref
artifact: b50a6dd..HEAD (phase F1 — integrationRef configurável)
skill: review-code
reviewer: gpt-5-codex
codex_version: codex-cli 0.139.0
final_verdict: approve
counts_final: {blocker: 0, critical: 0, major: 0, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 1, minor: 1, nit: 0}
framing_delta: {dropped: 2, maintained: 0, emerged: 0}
schema_version: "1.0"
---

# Cross-Model Review — wlf-f1-integrationref (phase-done gate, --mode=both)

Phase F1 diff `b50a6dd..HEAD`: `meta/schemas/routing.schema.json` (+ optional
`integrationRef`), `scripts/integration-ref.js` (pure resolver), and their tests.
4 `.atomic-skills/` state files in range are project-tracking (out of scope).

## Local phase (sealed-envelope agent, clean context)

verdict: findings_exist · counts: major=1 minor=3 · passes: 2

| # | Severity | File:line | Summary | Triage |
|---|----------|-----------|---------|--------|
| 1 | major | scripts/integration-ref.js:19-23 | Resolver silently coerces a schema-invalid (non-string OWN) `integrationRef` to the `develop` default; doc line 5 "never assumes silently" over-broad | **FIXED** — clarified doc-string (schema is the validation gate; not-configured is what is never assumed; non-string tolerated as `default`, never `declared`) + added test pinning non-string→default |
| 2 | minor | scripts/integration-ref.js:1,14 | Resolver has zero non-test callers | **By design** — consumed by `project finalize` (F3), per plan goal; recorded, no action |
| 3 | minor | routing.schema.json:16 / integration-ref.js:19 | whitespace-only ref passes `minLength:1` and is honored as `declared` | **Deferred to F3** (see codex F-002 reconciliation — ref-format validity belongs to the git consumer) |
| 4 | minor | tests/routing-schema.test.js | No test pins the `"default":"develop"` keyword as documentation-only (Ajv without useDefaults) | **FIXED** — added regression test asserting `validate({})` injects nothing |

## Pass 1 (blind) — gpt-5-codex

verdict: needs_changes · counts: major=1 minor=1

- **F-001 [major] security** — scripts/integration-ref.js:19-20: `resolveIntegrationRef({})` would return an INHERITED `integrationRef` (prototype chain) as `declared` instead of falling to `develop`. Recommendation: guard with `Object.hasOwn`. Confidence: high.
- **F-002 [minor] correctness** — routing.schema.json:14-18: whitespace/control refs pass `minLength:1` and are returned unchanged. Recommendation: ref-safe pattern + negative tests. Confidence: medium.
- Question (non-finding): semantics of `configured` (file-exists vs explicitly-configured).

(Disjoint from local: F-001 prototype-chain read is a finding the local pass did NOT surface — the cross-model value of --mode=both.)

## Pass 2 (informed) — gpt-5-codex

verdict: approve · counts_final: 0/0/0/0/0

### Reconciliation
- **F-001-blind [major] → DROPPED**: constraints 1+3 (resolver runs on already-schema-validated `JSON.parse` output; JSON.parse creates no inherited props) make the inherited-property path unreachable in-scope.
- **F-002-blind [minor] → DROPPED**: constraint 4 (git ref-format validity + actual branch/PR use live in the downstream consumer, the `project finalize` command, outside this diff) — impact cannot be established within the reviewed scope.
- Maintained: none. Emerged: none.

### External constraints supplied to the informed pass (verifiable)
1. Resolver is called on routing.json content already validated vs routing.schema.json (verify: scripts/validate-state.js:281).
2. Ajv built `{ allErrors:true, strict:false }`, no useDefaults (verify: scripts/validate-state.js:48) → `default:develop` is documentation-only.
3. routing.json is `JSON.parse` output (Object.prototype proto, own-keys only; `__proto__` key becomes an own prop, not a prototype mutation).
4. Actual git use of the ref (branch existence, PR base, `git check-ref-format`) is in the F3 consumer, outside this diff.

## Disposition (operator)

The informed cross-model verdict is `approve` (no standing findings). Notably, the
contract codex used to drop F-001/F-002 — "the resolver operates on schema-valid
content; ref-format validity belongs to F3" — is exactly what the local fix #1
made EXPLICIT in the resolver doc-string. Alignment, not conflict.

Discretionary hardening applied beyond the standing findings:
- **`Object.hasOwn` guard** (codex F-001): a one-token idiomatic guard, zero
  behavior change for valid inputs, removes the latent prototype-chain read for
  ANY caller (not just JSON.parse). Not a new abstraction (G7 ok). + regression
  test using `Object.create({ integrationRef: 'main' })`.

Deferred (recorded follow-up for F3):
- **F-002 / local #3 — ref-format validity** (whitespace, control chars,
  `git check-ref-format`): belongs to `project finalize` (F3), where the ref is
  actually created/used against git. The additive F1 schema field stays
  shape-only (`type:string, minLength:1`) per the reconciled scope.

## Fixes applied in this session

1. `scripts/integration-ref.js` — doc-string clarified (validation-gate contract; not-configured never assumed; non-string tolerated as default, never declared). [local #1]
2. `scripts/integration-ref.js:24-33` — `Object.hasOwn(routingConfig, 'integrationRef')` guard added so only OWN props are honored. [codex F-001, discretionary hardening]
3. `tests/integration-ref.test.js` — +test: present-but-non-string OWN value → default (never declared). [local #1]
4. `tests/integration-ref.test.js` — +test: INHERITED integrationRef (Object.create) → default, ignored. [codex F-001]
5. `tests/routing-schema.test.js` — +test: `validate({})` does not inject integrationRef (doc-only default pinned). [local #4]

Verification after fixes: `node --test tests/integration-ref.test.js` 8/8 exit 0;
`node --test tests/routing-schema.test.js` 5/5 exit 0; `npm run validate-skills`
15 valid. Full suite: 900 tests, 10 pre-existing failures (detect/install/serve —
unbuilt dashboard + install-count/detect drift), confirmed present at baseline
with these fixes stashed → zero regression from F1.

## Self-review against code-quality gates

- **G1 read-before-claim**: each fix pasted the source lines before editing (resolver guard at integration-ref.js:29, test files read fresh before append).
- **G2 soft-language**: fix descriptions state what the fix does (added guard / added test / clarified contract); no should/probably/may.
- **G3 anti-tautology**: each new assertion has a killing mutation — non-string test dies if the `typeof==='string'` guard is removed; inherited test dies if `Object.hasOwn` is removed; doc-only-default test dies if the test's Ajv flips `useDefaults:true`.
- **G4 fixture realism**: N/A — inputs are plain JS objects/primitives, no external data fixture.
- **G7 anti-premature-abstraction**: no new helper introduced; `Object.hasOwn` is a language builtin guard, not an abstraction.
