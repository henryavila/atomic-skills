# Code-quality gates

Single source of truth for the seven rules that defend against "claims without trace" — the failure pattern that produced every blocker/critical found in recent Codex cross-model reviews of this repo.

Skills inject the rules they care about by reference (e.g. `See G3 + G4 in docs/kb/code-quality-gates.md`). Update this file once and the propagation is automatic.

## Why these rules exist

Phase D and Phase E Codex reviews found 1 critical + 6 majors. Every single one fit the same shape: the AI **deduced** a fact from a name/signature/test instead of **verifying** it against the actual source, file, or runtime. The rules below name the inference path explicitly so it can be refused at the point it would happen.

When you find a new failure mode that doesn't fit one of G1-G7, add G8 here, then propagate the reference into the affected skill bodies.

## How to apply (Self-review checkpoint)

At the end of every task, before declaring the work done, the skill body MUST require a self-review block of the form:

```
## Self-review against code-quality gates
- G1 (read-before-claim): applied — <how> / not-applicable — <why> / violated — <reason + fix>
- G3 (anti-tautology): ...
- ...
```

This forces the AI to mention each gate by name. Silent application is forbidden; the gates are passive rules in the body, the checkpoint makes them explicit in the output.

---

## G1 — Read before claim

**Rule.** Before stating what a function does, what an endpoint returns, what a config field means, or what a file contains, you MUST paste the relevant source lines into your output. Inferring from the name or signature is forbidden.

**Failure it catches.** Phase D's `D.T-004` documented "use `aideck_mark_task_done` instead of file writes" without reading `aideck/src/mcp/tools/mutate.ts:64-95`, which literally said *"aiDeck never edits the file; a consumer skill applies."* Reading would have refused the entire pattern.

**Bad — inference:**

> aiDeck's `mark_task_done` tool mutates the initiative file directly, so the skill can call it in place of `Read → modify → Write`.

**Good — read-evidence:**

> `aideck/src/mcp/tools/mutate.ts:64-95` shows `mark_task_done` calls `appendIntent(...)` and returns `{accepted: true, note: 'Intent recorded; consumer skill applies.'}` — it does NOT mutate the file. The skill must still do `Read → modify → Write`; the MCP tool is observational.

**Applies to:** `project-plan`, `project-status`, `review-plan-internal`, `review-code-with-codex`, every skill body that documents external behavior.

---

## G2 — Soft-language ban

**Rule.** The following words signal unverified claims and are forbidden in plans, specs, skill bodies, and PR descriptions: `should`, `probably`, `may`, `typically`, `usually`, `I think`, `it seems`, `in theory`, `tends to`. If you write one, you have two options: (a) convert to a verified statement with evidence, or (b) prefix the entire claim with `unverified: <why I can't verify right now>`.

**Failure it catches.** Phase D's hook README said *"the watcher fires within 200ms"* — nobody measured. The contract review found aiDeck's chokidar `awaitWriteFinishMs` is configurable and the actual latency on cold disk is closer to 500ms.

**Bad:**

> The matcher should return zero duplicates after this fix.

**Good (verified):**

> Running `npm test -- matcher.dup-tenant` against the canary dataset returns 0 duplicate rows in the matcher output (commit a3f1c2d, output pasted below).

**Good (explicitly unverified):**

> unverified (no test exists yet for the cross-landlord case): the matcher likely returns zero duplicates after this fix; T-002 will add the test that verifies this.

**Applies to:** every output the AI produces — plans, commit messages, doc lines, PR bodies, review findings.

---

## G3 — Anti-tautology in tests

**Rule.** For each assertion you write, answer in a comment or on the spot: *"What mutation in the implementation would make this test fail?"* If the answer is "none", "I'd have to change the test too", or "the mock would just match the new shape", the assertion is tautological. Rewrite it to assert observable behavior.

**Failure it catches.** Phase E's `parsePort` had 100% test coverage (Codex F-002). The tests passed valid/invalid inputs and asserted the helper's output. But `serve()` never called `parsePort` — the helper was unused in production. The tests confirmed the helper's correctness *in isolation*, not its integration. A mutation test on `serve()` ("set port to `'abc'` and see if anything refuses it") would have failed immediately.

**Bad — tests the mock, not the code:**

```js
test('calls fetch with the right URL', async () => {
  const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  global.fetch = mockFetch
  await getPlan('foo')
  expect(mockFetch).toHaveBeenCalledWith('/api/state/project-status/foo')
})
// → mutation: change fetch URL in source to '/api/wrong/path' — test passes
// because we ALSO change the assertion to match. Tautological.
```

**Good — tests behavior:**

```js
test('getPlan returns the entity field from a 200 response', async () => {
  global.fetch = async () => ({ ok: true, json: async () => ({ schemaVersion: '0.1', entity: { slug: 'foo', title: 'Foo', phases: [] } }) })
  const plan = await getPlan('foo')
  assert.equal(plan.slug, 'foo')
  assert.equal(plan.title, 'Foo')
})
// → mutation: change `.entity` to `.state` in source — test fails because
// plan.slug is undefined. Asserts real behavior.
```

**The mutation test discipline:** before declaring a test suite complete, pick 3 lines of production code and imagine swapping them for `return null`, `return []`, or removing them. If fewer than 3 tests fail per mutation, the coverage is shallow.

**Applies to:** `hunt`, `fix`, any test the AI writes during implementation.

---

## G4 — Fixture realism

**Rule.** Before writing a test fixture, you MUST sample a real example of the data shape — read an actual file from the codebase, run an actual query, or sample a real transcript/log. Synthesizing what you "think" the shape is, is forbidden.

**Failure it catches.** Phase D's `stop.sh` was tested against a synthetic transcript with `{"role": "user", ...}` and top-level `.tool_use`. The real Claude Code transcript uses `{"type": "user", "message": {"content": [...]}}` and nests `tool_use` under `.message.content[]`. The tests passed, the hook never fired in production. Codex F-001 critical. Sampling `~/.claude/projects/<repo>/*.jsonl` once would have exposed the divergence in 5 minutes.

**Bad:**

```js
const transcript = `
{"role":"user","timestamp":"2026-05-20T00:00:00Z","content":"go"}
{"role":"assistant","timestamp":"2026-05-20T00:00:11Z","tool_use":{"name":"Edit","input":{"file_path":"/tmp/a.js"}}}
`
// synthesized from intuition about what Claude Code probably writes
```

**Good:**

```js
// Sampled from ~/.claude/projects/-Volumes-External-code-sda-v2/<session>.jsonl
// (head -3 lines, then constructed a minimal version matching the same shape):
const transcript = `
{"type":"user","timestamp":"2026-05-20T00:00:00Z","message":{"content":"go"}}
{"type":"assistant","timestamp":"2026-05-20T00:00:11Z","message":{"content":[{"type":"tool_use","name":"Edit","input":{"file_path":"/tmp/a.js"}}]}}
`
```

**The 60-second sample rule:** if the data comes from a real producer (HTTP API, file format, log line, external command), sampling takes under 60 seconds. There is no excuse for synthesizing it.

**Applies to:** `hunt`, `fix`, integration tests, any code that parses external input.

---

## G5 — Red phase mandatory in fix

**Rule.** When fixing a bug, you MUST first write a test that fails with the current code and paste the failing output into your work record. Only then write the fix. The output of `npm test` (or equivalent) showing the failing assertion is the entry token for the green phase.

**Failure it catches.** "Fixes" that nobody exercised before claiming green. A `try { … } catch { /* maybe handles it now */ }` added without ever running the reproducer is the canonical version.

**Bad:**

> Fixed the dup-tenant bug by changing the join key in `src/matcher/join.sql:42`. Tests still pass.

**Good:**

> Wrote `tests/matcher/dup-tenant.test.js:42` which constructs a synthetic landlord-tenant fixture with deliberate cross-landlord duplicates. With the current code, the test fails:
> ```
> ✗ matcher → dup-tenant
>   Expected: 4 rows (2 distinct landlord_id × 2 tenant_id)
>   Actual:   2 rows
>   at tests/matcher/dup-tenant.test.js:42
> ```
> Then changed the join key in `src/matcher/join.sql:42` from `(tenant_id)` to `(landlord_id, tenant_id)`. Re-running the test now passes.

**Exception:** the bug is in the test setup itself (test was wrong, code was right). In that case, the entry token is whatever evidence shows the original assumption was wrong (e.g. running the prod code path manually).

**Applies to:** `fix`, every bug closure.

---

## G6 — Reference-or-strike in plans/specs

**Rule.** Every assertion in a plan, spec, design doc, or skill body must carry one of:

- `verified_by: <file:line>` — citation against existing code
- `verified_by: <command>` — reproducible command that proves the claim
- `unverified: <why>` — explicit acknowledgement, and what would verify it

A bare assertion with no `verified_by` / `unverified` marker is deleted on review.

**Failure it catches.** Every finding of the post-Phase-D contract review (F-A path drift, F-B MCP intent model, F-C evidence schema, F-D narrative contract). All four were assertions in plan documents that nobody had checked against the aideck side until Codex did.

**Bad:**

> The aiDeck dashboard reads `.atomic-skills/plans/` and renders them as Plan cards.

**Good:**

> The aiDeck dashboard reads `.atomic-skills/<consumer>/plans/` (verified_by: `aideck/src/server/writers/paths.ts:64` `classifyFile` requires the consumer-id segment) and renders Plan entries via `aideck/src/server/projections/state.ts:18` `buildAllForConsumer`. **Open issue:** atomic-skills writes the flat layout `.atomic-skills/plans/` without consumer-id; the projections layer drops these files (verified_by: smoke `curl /api/state/project-status` returns `plans=0`).

**Applies to:** `project-plan`, `review-plan-internal`, `review-plan-with-codex`, `review-plan-vs-artifacts`, every doc that makes claims.

---

## G7 — Premature-abstraction ban

**Rule.** Three is the abstraction floor. With three or more similar call sites, you MAY introduce a helper. With two, you duplicate. With one (i.e. zero current callers), you wait.

Generic helpers, configurable thresholds, plugin systems, and "future-proofing" hooks added for one or zero current callers are forbidden.

**Failure it catches.** Phase D's `mcp-mode.js` (Codex F-B, dropped because it was fundamentally wrong) and the `__testing` export of `serve.js` (Codex F-004 emerged). Both shipped abstraction surface ("here's the canonical command → tool map", "here are testing helpers") with zero real callers — they existed only to be tested or be referenced by documentation. Both turned out to expose footguns.

**Bad — abstracts for one caller:**

```ts
// src/lib/threshold-helpers.ts (only caller: src/lib/cache.ts)
export function applyThreshold<T>(items: T[], cfg: ThresholdConfig<T>): T[] { ... }

// src/lib/cache.ts
import { applyThreshold } from './threshold-helpers'
const visible = applyThreshold(items, { fn: x => x.size, max: 50 })
```

**Good — inline:**

```ts
// src/lib/cache.ts
const visible = items.filter((x) => x.size <= 50)
```

When a fourth caller shows up, you have grounds to extract a helper. Until then, every "this might be useful elsewhere" is speculation.

**The three-strike rule for "what if":** if you're about to write "this could be reused" or "we might want to swap this out", count the current callers. If it's < 3, delete the abstraction.

**Applies to:** `simplify`, `fix`, any module/helper introduced during implementation.

---

## G8 — React hook safety (dashboard components)

**Rule.** Every React function component must satisfy two invariants:

1. **Hooks before early returns.** ALL hook calls (`useState`, `useMemo`, `useEffect`, `useCallback`, `useRef`, `useQuery`, custom hooks) must appear BEFORE the first conditional `return` statement. React requires the same hooks to be called in the same order on every render. An early return that skips a hook causes error #310 in production.

2. **Stable references for hook deps.** When a component parameter defaults to `[]` or `{}` in the destructuring signature, each render creates a **new object reference**. If that parameter is used as a dependency of `useEffect`, `useMemo`, or `useCallback`, the hook fires every render, causing an infinite loop. Extract the default to a **module-level constant**.

**Failure it catches.** Two production crashes in the aiDeck dashboard (2026-05-25):

- `PlanPage.tsx`: `useMemo` was called after `if (isLoading) return <Frame>...` early returns. During the loading render, React saw 10 hooks; after data arrived, it saw 11. React threw error #310 ("Minified React error") in production.
- `FeedbackDrawer.tsx`: `items = []` inline default created a new `[]` on every render. `useEffect(() => { setLocalItems(items) }, [items])` detected a "change" (new reference), called `setState`, triggered re-render, new `[]`, infinite loop. Console flooded with "Maximum update depth exceeded".

**Bad — hook after early return:**

```tsx
function PlanPage() {
  const { data, isLoading } = usePlan(slug)
  const [show, setShow] = useState(false)         // hook #3
  if (isLoading) return <Loading />                // early return — skips useMemo
  if (!data) return <NotFound />
  const phases = useMemo(() => adapt(data), [data]) // hook #4 — ONLY on data renders
  return <View phases={phases} />
}
// Loading render: 3 hooks. Data render: 4 hooks. React crashes.
```

**Good — hooks before returns:**

```tsx
function PlanPage() {
  const { data, isLoading } = usePlan(slug)
  const [show, setShow] = useState(false)
  const phases = useMemo(                           // hook #4 — ALWAYS called
    () => data ? adapt(data) : [],
    [data]
  )
  if (isLoading) return <Loading />                 // early returns AFTER all hooks
  if (!data) return <NotFound />
  return <View phases={phases} />
}
```

**Bad — inline default causes infinite loop:**

```tsx
function Drawer({ items = [], onClose }: Props) {   // new [] every render
  const [local, setLocal] = useState(items)
  useEffect(() => { setLocal(items) }, [items])      // fires every render
  // ...
}
```

**Good — module-level constant:**

```tsx
const EMPTY_ITEMS: Item[] = []                        // stable reference

function Drawer({ items = EMPTY_ITEMS, onClose }: Props) {
  const [local, setLocal] = useState(items)
  useEffect(() => { setLocal(items) }, [items])       // fires only when items actually changes
  // ...
}
```

**Verification checklist (for self-review):**

1. For every function component: list all hook calls and all early returns. Confirm every hook line number < every early return line number.
2. For every destructured parameter with `= []` or `= {}`: check if it flows into any hook dependency array. If yes, extract to module-level constant.

**References:**
- React Rules of Hooks: https://react.dev/reference/rules/rules-of-hooks
- React error #310 decoder: https://react.dev/errors/310
- React docs on referential equality: https://react.dev/reference/react/useMemo#every-time-my-component-renders-the-calculation-in-usememo-re-runs

**Applies to:** every React component in `src/dashboard/`, the `review-code` skill (checklist item for React diffs), the `fix` skill (when fixing dashboard bugs).

---

## G9 — Mutation-kill (test verifiers prove they bite)

**Rule.** A `kind: test` verifier MAY carry an optional `mutation` block in its `evidence` that proves the test actually *kills* a behavioral mutation, not just that it passes. The proof is a single transcript: inject a behavioral mutation at the target, watch the named test go **RED**, revert, watch it go **GREEN**. A test that stays green under the mutation is tautological (G3) and provides no protection — the kill is the evidence that it bites.

This is the canonical mirror of the inline definition in `skills/shared/project-assets/project-transitions.md` (the `evidence.mutation` shape). The fields:

```yaml
mutation:                    # test only, OPTIONAL
  target: "<file:line>"
  change: "<behavioral mutation applied at target>"
  killedBy: ["<test(s) that went RED on the mutation>"]
  killTranscript: "<≤500-char inject → RED → revert → GREEN excerpt>"
```

**Failure it catches.** A test asserted as a deterministic verifier that passes whether or not the code under test is correct — the test never exercised the behavior it claims to guard, so `done` rests on a green that a broken implementation would also produce.

**Bad — green proves nothing:**

```
verifier passes ✓  →  marked done
(but flipping the comparison operator at the target leaves the test green)
```

**Good — the kill is recorded:**

```
inject `>=` → `>` at parser.js:42  →  test_boundary RED ✓
revert                              →  test_boundary GREEN ✓
evidence.mutation.killedBy: [test_boundary]
```

**Applies to:** any `kind: test` exit-gate / task verifier, recorded in the criterion's `evidence.mutation`. **Magnitude floor (E2#3):** on a **decision-logic / critical-path** criterion (the test IS the load-bearing proof the phase is correct) the mutation-kill is **expected** — its absence must be justified in the self-review, not silently skipped; elsewhere it stays optional. It is not GATE-R2-machine-enforced (validate-state cannot know which paths are critical), so this floor is a self-review discipline — but "optional everywhere" undersells the one non-fakeable TDD oracle the design calls load-bearing. When present it upgrades a green to a proven kill.

---

## G10 — Gate-must-be-able-to-fail (the meta-gate)

**Rule.** Every gate — including a new exit-criterion, a verifier, or a rule added to *this* file — must be **falsifiable**: you can state the concrete defect it rejects. Encode that as a one-line **failure-proof** next to the gate:

```
FAILS when ⟨concrete defect that makes it red⟩; cheapest pass ⟨the minimum a correct impl does⟩; foreclosed by ⟨what stops a vacuous/green-always pass⟩.
```

If you cannot fill the `FAILS when` clause, the gate measures nothing (it is green for every input, correct or not) — that is the vanity-gate the anti-tautology rule (G3) forbids, lifted from tests to gates in general. Delete it or sharpen it until it can fail.

**Failure it catches.** A gate/criterion phrased so it always passes — e.g. an exit-criterion "the code is well-structured" (no input makes it red), or a verifier whose command exits 0 regardless of the code. Such a gate gives false assurance: `phase-done` rests on a green that a broken phase would also produce.

**Bad — cannot fail:**
```
exit-criterion: "error handling is robust"        # what input makes this RED? none stated → vanity
```
**Good — failure-proof stated:**
```
exit-criterion: "POST /x with a malformed body returns 400, asserted by test_bad_body"
FAILS when the handler 500s or 200s on a malformed body; cheapest pass = validate + return 400;
foreclosed by G9 mutation-kill on test_bad_body.
```

**Applies to:** every exit-criterion (pairs with G6 reference-or-strike), every verifier, and every future gate added to this file (see "Adding a new gate" below). Enforcement is **self-review discipline** (the `## Self-review against code-quality gates` block audits it), not a `validate-state` check — consistent with G2/G6 (see the `project` skill's enforcement-honesty note in `project-create-plan.md`).

---

## Index — rule × skill matrix

| Rule | project-plan | project-status | hunt | fix | review-plan-internal | review-code-with-codex | simplify |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| G1 read-before-claim | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| G2 soft-language | ✓ | ✓ | | ✓ | ✓ | ✓ | |
| G3 anti-tautology | | | ✓ | ✓ | | ✓ | |
| G4 fixture realism | | | ✓ | ✓ | | ✓ | |
| G5 red-phase | | | | ✓ | | | |
| G6 reference-or-strike | ✓ | ✓ | | | ✓ | ✓ | |
| G7 anti-premature-abstraction | | | | ✓ | | ✓ | ✓ |
| G10 gate-must-be-able-to-fail | ✓ | | | | ✓ | ✓ | |

G8 (react-hook-safety) aplica-se ao dashboard deste repo — injetado via CLAUDE.md, não via skills genéricos. G9 (mutation-kill) é opt-in por verifier `kind: test` (não uma linha de skill). G10 aplica-se a todo autor de gate/exit-criterion.

G9 (mutation-kill) é opcional e aplica-se a qualquer verifier `kind: test` (independente de skill) — registrada no `evidence.mutation` de uma exit-gate/task, não mapeia colunas do matrix.

Skills inject only the rules they ✓. The Self-review checkpoint at the end of each task mentions those rules by id, forcing explicit application.

---

## Adding a new gate (G8+)

1. Add the rule to this file with the same shape (Rule / Failure it catches / Bad / Good / Applies to).
2. **Pass G10 on the new gate itself:** state its failure-proof — `FAILS when ⟨defect⟩; cheapest pass ⟨X⟩; foreclosed by ⟨mechanism⟩`. A gate whose `Failure it catches` clause you cannot write is a vanity gate; do not add it.
3. Update the rule × skill matrix above.
4. Update each affected skill body's `## Code-quality gates` section + Self-review checkpoint to include the new gate id.

The gate IDs are stable (G1 stays G1 forever). New gates always append. Deprecating a gate: mark it `## G<n> — DEPRECATED (replaced by G<m>)` and leave the body; do not renumber.
