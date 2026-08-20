# review-code --mode=local — project-flow F0 phase

- **mode:** local
- **overrideReason:** operator requested review-code --mode=local for this implement session
- **range:** 206fb3fa2ecb55ca32305c8638c63ab0ed3c8759..adea1fea (product 820357f5..c556e642 + merge 1699cb80)
- **at:** adea1fea
- **verifiedAt:** 2026-08-13T21:42:00Z
- **maxSeverity:** minor
- **verdict:** pass

## Scope

Product: `meta/schemas/flow.schema.json`, `scripts/lib/validate-flow.js`, `tests/validate-flow.test.js`, `docs/design/project-flow/dogfood/fluxo-sugestao.json`, `docs/design/project-flow/dogfood/minimal-xor.json`.

## Findings

### minor — G-F0-1 probe vs suite

G-F0-1 shell probe omits `machines` so it fails for more than `type: sequence`. Suite has a stronger type-only flip (`tests/validate-flow.test.js` old-shape cases). Does not block phase close.

### note — no dedicated statusTo mutation test

`additionalProperties: false` on `$defs.effect` rejects `statusTo`. Evaluator already recorded this.

## Blocker / critical / major

None.

## Verifiers on merged tree

`node --test tests/validate-flow.test.js` → 30 pass 0 fail exit 0.
G-F0-1 exit 0. G-F0-2 exit 0.
