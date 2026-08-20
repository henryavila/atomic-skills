# evaluationReport
planSlug: project-flow
phaseId: F0
verdict: pass

Evaluated HEAD claim `1699cb80217fb7dc40e407b9e86cc543f6e335bd` (initiative close + writer claims) against plan F0 goal, `businessIntent`, T-001..T-003 acceptance, and exit gates G-F0-1 / G-F0-2. This eval process has no shell; G-F0-1 `node --test` was not executed here. Predicates of both verifiers were reconstructed from the files the commands read. Writer/claims transcripts record 30/30 pass and both gates exit 0. Durable plan state was not stamped.

## findings
- info / schema / meta/schemas/flow.schema.json:19-21 / `schemaVersion.const` is `"1.0"`. No `"2.0"` token in this file. Root `required` includes `graph` and `machines` (lines 7-16). `$defs.graphNode` type enum is `activity|xor|and|join|subprocess|event|end` (lines 147-150). `$defs.effect` requires `kind` (`email|notify|write|other`) + `label` + `target` and sets `additionalProperties: false` (lines 401-413), so `statusTo` is not a valid effect field.
- info / schema / meta/schemas/flow.schema.json:71-76 / `machines` is an array, `minItems: 1`. Root `additionalProperties: false` (line 6) rejects a sibling `states` object. Node maps do not include `sequence` or `decision`.
- info / validator / scripts/lib/validate-flow.js:4-14 / AJV 2020 (`ajv/dist/2020.js`). Exports `SCHEMA_VERSION = '1.0'` and `SUBGRAPH_MAX_DEPTH = 8`. No import of `IMPLEMENTATION_TOKEN_RE`, `validateProcessMap`, or `process.yaml`.
- info / validator / scripts/lib/validate-flow.js:16-17,52-61 / `neighbors()` walks `activity|join|subprocess|event` via `next` and `xor|and` via `branches[].next`. `end` has no outgoing edge.
- info / validator / scripts/lib/validate-flow.js:105-120,152-174,176-221,239-285,287-353 / Graph rules present: `actorRef` on message `from`/`to`; `join.of` must name an `and` in the same node map; `subprocess.ref` ∈ `graph.subgraphs`; xor/and require ≥2 branches; `xor.when` unique per xor; subgraph nest depth ≤ 8; machine ≥1 node; transition `effects` key required; `via` must be an xor branch id collected from root + subgraphs.
- info / tests / tests/validate-flow.test.js:126-171,246-272,317-420,423-455,458-481 / Suite is on the MODEL: dogfood + `machines[]` + effects arrays; click/modal/screen banned on BPM labels; `minimal-xor.json` has 2 actors / 1 xor / 1 machine and no `statusTo`; rejects `type: sequence`, `type: decision`, root `states`; covers broken `next`, one-branch xor/and, ghost actor, duplicate `when`, `join.of`, `subprocess.ref`, `event.kind`, missing `effects`, empty machine `nodes`, invalid `via`, depth > 8, ancestor cycle accepted, empty `effects[]` accepted. Domain-isolation test forbids PDTI / `statusTo === 10` / `three decisions` / `IMPLEMENTATION_TOKEN_RE` in validator + schema source.
- info / dogfood / docs/design/project-flow/dogfood/fluxo-sugestao.json:1-8,25-343,344-456 / Document is `schemaVersion: "1.0"` with `graph.nodes` of types `activity|xor|end` only, messages carrying click/modal/tela narration, and `machines[0].id = "sugestao"` with transitions that include both non-empty effects (`kind`+`label`+`target`) and one empty `effects` array (`T_skip_edit`, lines 411-418). Cycle `D1.fail → S1e → D1` is encoded as `next` to an ancestor, not a new node type.
- info / dogfood / docs/design/project-flow/dogfood/minimal-xor.json:1-88 / 2 actors, 1 xor (`D1`), 1 machine (`request`), one transition with `effects: []` and one with a `notify` effect. No `statusTo`, no `type: sequence`, no root `states`.
- minor / tests / tests/validate-flow.test.js:246-272 / G-F0-1 *description* and phase goal name `effect.statusTo` as a rejected old shape. The suite asserts sequence / decision / root `states` and that `minimal-xor.json` text has no `statusTo` substring (line 167). There is no case that mutates a valid effect to add `statusTo` and asserts `valid === false`. Rejection is still forced by `additionalProperties: false` on `$defs/effect` (flow.schema.json:402).
- minor / gate / .atomic-skills/projects/atomic-skills/project-flow/plan.md:80-87 / G-F0-1 shell probe builds `type: sequence` and omits `machines`. After F0 that document fails for more than one reason (`type` enum + missing required `machines` + `processLabel` additional properties). The stronger sequence probe is the test at tests/validate-flow.test.js:247-253 (valid MODEL doc, only `type` flipped).
- info / outOfScope / scripts/ / No `scripts/lib/render-flow.js`, `scripts/render-flow.js`, or `scripts/find-missing-flow.js` on this tree. `validate-flow.js` does not copy Arch HTML or encode PDTI status 10/1/11. Historical `docs/design/project-flow/dogfood/fluxo-completo.html` still contains `processLabel` / `statusTo` (T-003 scopeBoundary: do not change that file). Historical `docs/design/project-flow/dogfood/process.yaml` remains a process-map fixture; `validate-flow.js` does not read it.

## businessIntentCheck
value: pass — F0 slice is “shape 1.0 on disk is the MODEL.” Schema + validator + rewritten dogfood implement that (`meta/schemas/flow.schema.json:5`, `scripts/lib/validate-flow.js:403-416`, `docs/design/project-flow/dogfood/fluxo-sugestao.json:1-8,344-346`). The sentence “Implement recusa plano sem flow ratificado” is product-level value owned by F2; it is listed under `outOfScope` for this phase (`phases/f0-modelo-no-disco.md:27-28`) and is not implemented here.

workflow: pass — Delivered order is schema MODEL → `validate-flow` + tests → rewritten dogfood (`phases/f0-modelo-no-disco.md:71-178`). No draft generator from `phases[]` was added (F2 / P5). Dogfood graph is the PDTI operational path (create → validate → notify leader → edit xor → accept/refuse), not a collapse of this plan’s `phases[]`.

rules: pass — `validate-flow.js` has zero `process.yaml` references (no dual-read). PDTI tokens are absent from validator and schema (tests/validate-flow.test.js:458-480; grep on both files empty). `schemaVersion` stays `"1.0"` (`flow.schema.json:20-21`, `validate-flow.js:13`). No `86c1c2d4` render merge (`scripts/` has no `render-flow.js`). Empty `effects[]` is valid (`tests/validate-flow.test.js:238-243`; schema array without `minItems`). Missing `effects` key is invalid (`validate-flow.js:320-326`; `flow.schema.json:387`; `tests/validate-flow.test.js:406-412`).

outOfScope: pass — F0 outputs are only `meta/schemas/flow.schema.json`, `scripts/lib/validate-flow.js`, `tests/validate-flow.test.js`, `docs/design/project-flow/dogfood/fluxo-sugestao.json`, `docs/design/project-flow/dogfood/minimal-xor.json` (`phases/f0-modelo-no-disco.md:93-170`). No project-flow command, detector, implement HARD, visual editor, npm package, or PDTI feature in core.

doneWhen: pass — Suite is the MODEL (30 `it(` cases in `tests/validate-flow.test.js`). Dogfood has `machines.length >= 1` (`fluxo-sugestao.json:344-346`). `type: sequence` is invalid (`flow.schema.json:147-150`; `tests/validate-flow.test.js:247-253`). `schemaVersion` remains `"1.0"` (`flow.schema.json:20-21`).

## exitGates
G-F0-1: pass — Command: `node --test tests/validate-flow.test.js && validateFlow(dogfood)` + `machines.length>=1` + probe `{type:'sequence',...}` must be invalid. This eval did not spawn `node`. File predicates of the command:
  1. `tests/validate-flow.test.js` contains 30 MODEL tests; fixture test requires `validateFlow(dogfood).valid === true` and `machines.length >= 1` (lines 127-137); old-shape tests require sequence/decision/states invalid (lines 247-271).
  2. `fluxo-sugestao.json` is MODEL 1.0 with a non-empty `machines` array (line 344).
  3. G-F0-1 probe node `S1.type = 'sequence'` is outside `$defs.graphNode` enum (`flow.schema.json:147-150`) and the probe omits required `machines` (`flow.schema.json:15`), so `validateFlow(old).valid` cannot be true.
  Writer claim T-002/T-003 and initiative handoff record the same command at 30 pass / 0 fail / exit 0 on `1699cb80`.

G-F0-2: pass — `meta/schemas/flow.schema.json:20-21` has `const: "1.0"`. `rg` equivalent over `scripts/lib/validate-flow.js` for `statusTo === 10|status 10|three decisions` returned no matches. `SCHEMA_VERSION` export is `'1.0'` (`validate-flow.js:13`).

## Counts
blocker: 0
critical: 0
major: 0
minor: 2
info: 9
total: 11
