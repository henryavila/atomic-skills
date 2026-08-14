# Flow diagram engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the list/card `flow.html` with three deterministic SVG diagrams (sequence, BPM, state machines) plus PDTI-style tabs and pan/zoom — no mermaid.

**Architecture:** `normalizeFlow` stays. New pure `flow-layout.js` (walk + boxes) and `flow-draw.js` (SVG strings). `render-flow.js` embeds the SVGs in a tabbed viewport. Same JSON + same `ds.css` = byte-identical HTML. `data-fl-content-sha` remains the L1 fingerprint.

**Tech Stack:** Node test runner, existing `validate-flow` / `normalizeFlow` / `escapeHtml`, inline SVG + a few dozen lines of tab/pan/zoom JS. No new npm deps.

**Design:** `docs/plans/2026-08-14-flow-diagram-engine-design.md`

**Do not:** change schema, brief, ratification, `serve-flow`, `--strict`, or finalize F0–F2. Do not commit automate `prepare.json` / `sealed-brief.md`.

---

### Task 1: Walk MODEL graph into layout steps

**Files:**
- Create: `scripts/lib/flow-layout.js`
- Create: `tests/flow-layout.test.js`

**Step 1: Write the failing test**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeFlow } from '../scripts/lib/render-flow.js';
import { walkSteps } from '../scripts/lib/flow-layout.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MINIMAL = JSON.parse(
  readFileSync(join(ROOT, 'docs/design/project-flow/dogfood/minimal-xor.json'), 'utf8'),
);

describe('walkSteps', () => {
  it('emits activity then xor with two branch chains then ends', () => {
    const steps = walkSteps(normalizeFlow(MINIMAL));
    assert.equal(steps[0].kind, 'activity');
    assert.equal(steps[0].nodeId, 'S1');
    assert.equal(steps[1].kind, 'xor');
    assert.equal(steps[1].nodeId, 'D1');
    assert.equal(steps[1].branchPanels.length, 2);
    assert.equal(steps[1].branchPanels[0].branch.label, 'Accepts');
    assert.equal(steps[1].branchPanels[0].chain[0].kind, 'end');
    assert.equal(steps[1].branchPanels[1].chain[0].nodeId, 'end_no');
  });

  it('marks a cycle as loop-ref instead of walking forever', () => {
    const doc = structuredClone(MINIMAL);
    doc.graph.nodes.S1.next = 'S1';
    const steps = walkSteps(normalizeFlow(doc));
    assert.ok(steps.some((s) => s.kind === 'loop-ref' || s.nodeId === 'S1'));
    assert.ok(steps.length < 8);
  });
});
```

**Step 2: Run — expect FAIL** (module missing)

```bash
node --test tests/flow-layout.test.js
```

**Step 3: Minimal `walkSteps`**

Port the PDTI idea (`walkLayout` + `collectBranchChain` in `docs/design/project-flow/dogfood/fluxo-completo.html`) onto MODEL types:

- `activity` / `event` / `subprocess` / `join` → step + follow `next`
- `xor` / `and` → step with `branchPanels[]` (each `branch` + `chain` from `branch.next`); do not continue a trunk after exclusive xor
- `end` → step, stop
- `next` already visited → `{ kind: 'loop-ref', nodeId }`
- depth cap 12 / guard 50 (same as PDTI)

Export `walkSteps(normalized)` only in this task.

**Step 4: Re-run — expect PASS**

**Step 5: Commit** `feat(flow): walk MODEL graph into layout steps`

---

### Task 2: Sequence layout (actors, rows, XOR bands)

**Files:**
- Modify: `scripts/lib/flow-layout.js`
- Modify: `tests/flow-layout.test.js`

**Step 1: Failing test**

```js
import { GEOM, layoutSequence } from '../scripts/lib/flow-layout.js';

it('layoutSequence places actors, one message row, and an xor rail', () => {
  const layout = layoutSequence(normalizeFlow(MINIMAL));
  assert.equal(layout.actors.length, 2);
  assert.equal(layout.actors[0].id, 'U');
  assert.equal(layout.actors[1].id, 'R');
  assert.ok(layout.actors[1].x > layout.actors[0].x);
  assert.equal(layout.messages.length, 1);
  assert.equal(layout.messages[0].from, 'U');
  assert.equal(layout.messages[0].to, 'R');
  assert.equal(layout.messages[0].n, 1);
  assert.equal(layout.bands.length, 1);
  assert.equal(layout.bands[0].xorId, 'D1');
  assert.match(layout.bands[0].question, /Accept/);
  assert.equal(layout.bands[0].branches.length, 2);
  assert.ok(layout.bands[0].branches[1].y > layout.bands[0].branches[0].y);
  assert.equal(GEOM.actorWidth, 196);
  assert.equal(GEOM.messageRow, 36);
});
```

**Step 2: Run — expect FAIL** (`layoutSequence` missing)

```bash
node --test tests/flow-layout.test.js
```

**Step 3: Implement `layoutSequence`**

Export `GEOM`:

```js
export const GEOM = {
  actorWidth: 196,
  actorHeader: 46,
  messageRow: 36,
  rankGap: 56,
  branchGap: 36,
  bpmNodeW: 200,
  bpmNodeH: 48,
  pad: 40,
};
```

- `actors[]` in JSON order, `x = pad + i * actorWidth`
- Walk `walkSteps`; for each activity/event, emit one row per `messages[]` (`y` increments by `messageRow`)
- On xor: open a band (`x` at left pad, `y` at current, `question` from `node.question || node.label`); each branch gets `{ id, label, y, height }` stacked vertically; recurse into `chain` (messages + nested bands)
- `loop-ref` → `{ label, y }` in `loops`
- `width` / `height` from extents + pad

**Step 4: Re-run — expect PASS**

**Step 5: Commit** `feat(flow): sequence layout with xor bands`

---

### Task 3: Sequence SVG — no alt/else box

**Files:**
- Create: `scripts/lib/flow-draw.js`
- Create: `tests/flow-draw.test.js`

**Step 1: Failing test**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeFlow } from '../scripts/lib/render-flow.js';
import { layoutSequence } from '../scripts/lib/flow-layout.js';
import { drawSequenceSvg } from '../scripts/lib/flow-draw.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MINIMAL = JSON.parse(
  readFileSync(join(ROOT, 'docs/design/project-flow/dogfood/minimal-xor.json'), 'utf8'),
);

it('draws lifelines, numbered arrow, xor rail; never writes alt/else', () => {
  const svg = drawSequenceSvg(layoutSequence(normalizeFlow(MINIMAL)));
  assert.match(svg, /<svg[^>]*data-surface="sequence"/);
  assert.match(svg, /data-actor-id="U"/);
  assert.match(svg, /data-actor-id="R"/);
  assert.match(svg, /data-lifeline/);
  assert.match(svg, /data-from="U"[^>]*data-to="R"|data-to="R"[^>]*data-from="U"/);
  assert.match(svg, /Sends the request/);
  assert.match(svg, /data-xor-rail="D1"/);
  assert.match(svg, /data-branch-label/);
  assert.doesNotMatch(svg, />\s*alt\s*</i);
  assert.doesNotMatch(svg, />\s*else\s*</i);
  assert.doesNotMatch(svg, /\balt\b|\belse\b/i);
});
```

**Step 2: Run — expect FAIL**

```bash
node --test tests/flow-draw.test.js
```

**Step 3: `drawSequenceSvg(layout)`**

- `<svg data-surface="sequence" viewBox="0 0 W H" xmlns="http://www.w3.org/2000/svg">`
- `<title>` / `<desc>`
- Actor headers (top + bottom) as `<g data-actor-id>`
- Lifelines: dashed `<line data-lifeline>` using `var(--fg-faint)` / `#424a5a`
- Messages: `<g data-from data-to data-n>` line + text; async = dasharray
- XOR: `<g data-xor-rail="{xorId}">` — left rail only (`var(--status-warning-line)` / `#e0a44a`), no enclosing rect; `◇ {question}` note; per branch a hairline + `<text data-branch-label>`; no fill box (optional 8% wash rect *without* stroke)
- Escape all text (`escapeHtml` from `render-site.js`)
- Double-render of the same layout must be byte-identical (no random ids)

**Step 4: Re-run — expect PASS**

**Step 5: Commit** `feat(flow): draw sequence SVG with elegant xor rail`

---

### Task 4: BPM layout (TB, branch columns)

**Files:**
- Modify: `scripts/lib/flow-layout.js`
- Modify: `tests/flow-layout.test.js`

**Step 1: Failing test**

```js
it('layoutBpm stacks trunk and opens sibling columns under xor', () => {
  const layout = layoutBpm(normalizeFlow(MINIMAL));
  const byId = Object.fromEntries(layout.nodes.map((n) => [n.id, n]));
  assert.equal(byId.S1.type, 'activity');
  assert.equal(byId.D1.type, 'xor');
  assert.equal(byId.end_ok.type, 'end');
  assert.ok(byId.D1.y > byId.S1.y);
  assert.ok(byId.end_ok.x !== byId.end_no.x);
  assert.ok(byId.end_ok.y > byId.D1.y);
  assert.ok(layout.edges.some((e) => e.from === 'S1' && e.to === 'D1'));
  assert.ok(layout.edges.some((e) => e.from === 'D1' && e.to === 'end_ok' && /Accept/i.test(e.label)));
  assert.equal(byId.S1.label.includes('S1'), false);
});
```

**Step 2: Run — expect FAIL**

```bash
node --test tests/flow-layout.test.js
```

**Step 3: `layoutBpm(normalized)`**

- Walk from `entry`
- Trunk x = center
- `xor`/`and`: children laid in sibling columns (`x` offset by `bpmNodeW + branchGap`)
- Node `{ id, type, label, who, x, y, w, h }` — `label` is business (`node.label`), never the technical id as the visible label
- Edges `{ from, to, label, points }`
- `subprocess`: one box (do not explode subgraphs in v1 of this plan unless already in `walkSteps`)

**Step 4: Re-run — expect PASS**

**Step 5: Commit** `feat(flow): BPM TB layout with xor columns`

---

### Task 5: BPM SVG shapes

**Files:**
- Modify: `scripts/lib/flow-draw.js`
- Modify: `tests/flow-draw.test.js`

**Step 1: Failing test**

```js
import { layoutBpm } from '../scripts/lib/flow-layout.js';
import { drawBpmSvg } from '../scripts/lib/flow-draw.js';

const UI_WORD_RE = /\b(click|modal|screen)\b|clica|\btela\b/i;

it('draws activity rect, xor diamond, end circle; no UI words; no technical ids as labels', () => {
  const svg = drawBpmSvg(layoutBpm(normalizeFlow(MINIMAL)));
  assert.match(svg, /data-surface="bpm"/);
  assert.match(svg, /data-node-id="S1"[^>]*data-shape="rect"|data-shape="rect"[^>]*data-node-id="S1"/);
  assert.match(svg, /data-node-id="D1"[^>]*data-shape="diamond"/);
  assert.match(svg, /data-node-id="end_ok"[^>]*data-shape="circle"/);
  assert.match(svg, /Submit request/);
  assert.match(svg, /Accept\?/);
  assert.doesNotMatch(svg, UI_WORD_RE);
});
```

Also add a dogfood case in the same file (load `fluxo-sugestao.json`): BPM must include `Criar sugestão` and `Envio válido?` and must **not** match `UI_WORD_RE`. Sequence (task 3 function) on dogfood **must** include `Clica em Sugerir necessidade`.

**Step 2: Run — expect FAIL**

**Step 3: `drawBpmSvg(layout)`**

| type | `data-shape` | geometry |
|------|----------------|----------|
| activity / subprocess | `rect` | rounded rect |
| xor | `diamond` | polygon |
| and / join | `bar` | horizontal bar |
| event | `circle` | thin stroke |
| end | `circle` | filled |

Edges as `<path>` + `<text>` for branch label. `data-node-id` `data-node-type` `data-next` when known. Colors from DS (`--bg-elevated`, `--status-warning` for xor, `--status-success` / `--status-error` for end if you can tell from label — do **not** invent PDTI status 10).

**Step 4: Re-run — expect PASS**

**Step 5: Commit** `feat(flow): draw BPM SVG shapes`

---

### Task 6: Machine layout + SVG

**Files:**
- Modify: `scripts/lib/flow-layout.js`
- Modify: `scripts/lib/flow-draw.js`
- Modify: `tests/flow-layout.test.js`
- Modify: `tests/flow-draw.test.js`

**Step 1: Failing tests**

```js
it('layoutMachines is LR pills with transitions', () => {
  const machines = layoutMachines(normalizeFlow(MINIMAL));
  assert.equal(machines.length, 1);
  assert.equal(machines[0].id, 'request');
  const open = machines[0].states.find((s) => s.id === 'open');
  const acc = machines[0].states.find((s) => s.id === 'accepted');
  assert.equal(open.entry, true);
  assert.equal(acc.terminal, true);
  assert.ok(acc.x > open.x);
  assert.ok(machines[0].transitions.some((t) => t.from === 'open' && t.to === 'accepted'));
});

it('draws effect kind label target on the edge', () => {
  const svg = drawMachinesSvg(layoutMachines(normalizeFlow(MINIMAL)));
  assert.match(svg, /data-surface="machines"/);
  assert.match(svg, /data-machine-id="request"/);
  assert.match(svg, /data-state-id="open"/);
  assert.match(svg, /data-effect-kind="notify"/);
  assert.match(svg, /data-effect-target="U"/);
  assert.match(svg, /Tell requester/);
});
```

**Step 2: Run — expect FAIL**

**Step 3: Implement**

- `layoutMachines`: each machine `states` in insertion order along x; `entry` / `terminal` flags; transitions as edges with `effects[]`
- `drawMachinesSvg`: one `<svg data-surface="machines">` containing one `<g data-machine-id>` per machine, stacked on y; state pills; edges; effect as second line `kind · label → target`

**Step 4: Re-run both test files — expect PASS**

```bash
node --test tests/flow-layout.test.js tests/flow-draw.test.js
```

**Step 5: Commit** `feat(flow): draw machine state diagrams`

---

### Task 7: Chrome — tabs + embed SVGs (kill lists)

**Files:**
- Modify: `scripts/lib/render-flow.js` (`FLOW_CSS`, `renderFlowHtml`, delete `renderSequence` / `renderBpm` / `renderMachines` list builders)
- Modify: `tests/render-flow.test.js`

**Step 1: Replace the list-era assertions in `tests/render-flow.test.js`**

Keep: three surfaces, messages on sequence, no UI words on BPM, effects on machines, mutation of `next` changes HTML, no mermaid, determinism, DS tokens, CLI `-o` / `--stdout` / `--check` / default `flow.html`.

Change:

- Sequence/BPM/machines bodies must contain `svg[data-surface=…]` (string match `data-surface="sequence"` **inside** an `<svg`).
- `assert.doesNotMatch(html, /<ol class="fl-messages">/)`
- `assert.doesNotMatch(html, /<ol class="fl-nodes">/)`
- `assert.doesNotMatch(html, /\balt\b|\belse\b/)`
- Landmarks may be `role="tabpanel"` (still `id="fl-sequence"` etc. so CLI tests stay green)
- Nav is `role="tablist"` with `role="tab"`
- `FLOW_CSS` still uses `--fs-3xl` / `--space-12` / `--font-sans` or `--bg-canvas`; still no `.ds-`
- Add: `html` includes `data-tab=` and a viewport class `fl-viewport`
- Add: empty-messages document hides the Sequência tab (`hidden` or omitted); empty-machines hides Máquinas; BPM always present

Write these tests **first**. Run:

```bash
node --test tests/render-flow.test.js
```

Expected: FAIL (still lists, no tablist, `alt` may be absent already).

**Step 2: Confirm FAIL** (lists still emitted)

**Step 3: Rewrite `renderFlowHtml`**

Structure:

```html
<nav class="fl-toc" role="tablist">
  <button type="button" role="tab" data-tab="sequence" aria-selected="true" aria-controls="fl-sequence">Sequência</button>
  …
</nav>
<div class="fl-toolbar">… + − 100% ajustar …</div>
<p class="fl-hint" id="fl-hint">…</p>
<div class="fl-viewport" id="fl-viewport">
  <section id="fl-sequence" class="fl-surface" role="tabpanel" data-surface="sequence">SVG</section>
  <section id="fl-bpm" hidden>…</section>
  <section id="fl-machines" hidden>…</section>
</div>
<script>
/* tabs + pan/zoom only. No layout. No mermaid. No Date.now. */
</script>
```

- Call `layoutSequence` / `drawSequenceSvg` etc. on the already-normalized doc
- Hide sequence tab+panel when `collectSequence` would be empty (no messages)
- Hide machines when `machines.length === 0`
- BPM always rendered
- Inline JS: click tab → `hidden` / `aria-selected`; pointer pan on `#fl-viewport`; wheel+ctrl scale a wrapper; buttons. Default scale 1. Deterministic (no random).
- `FLOW_CSS`: chrome + viewport (`overflow: auto`), keep DS tokens, no `.ds-` classes
- Delete list CSS (`.fl-msg`, `.fl-nodes`, …) if unused

**Step 4: Re-run `tests/render-flow.test.js` — expect PASS**

Also run:

```bash
node --test tests/flow-layout.test.js tests/flow-draw.test.js tests/find-missing-flow.test.js
```

**Step 5: Commit** `feat(flow): tabbed SVG chrome replaces list view`

---

### Task 8: Re-render on-disk HTML + KB

**Files:**
- Regenerate: `docs/design/project-flow/dogfood/` has no committed `flow.html` today — do **not** invent one
- Modify: `.atomic-skills/projects/atomic-skills/project-flow/flow/flow.html` via CLI (L1 unchanged → stamp stays valid)
- Modify: `docs/kb/flow.md` (L2 is diagrams, not lists)
- Modify: `docs/design/project-flow/LEDGER.md` — short note under §6: mermaid still dead; native SVG panel is the view
- Modify: `skills/shared/project-assets/project-flow.md` only if it still tells the agent the panel is lists/cards

**Step 1: No new test.** Existing `--check` / `--strict` must stay green after re-render.

```bash
node scripts/render-flow.js \
  .atomic-skills/projects/atomic-skills/project-flow/flow/flow.json \
  -o .atomic-skills/projects/atomic-skills/project-flow/flow/flow.html

node scripts/find-missing-flow.js \
  .atomic-skills/projects/atomic-skills/project-flow/plan.md --strict
```

Expected: `--strict` exit 0 (sha L1 unchanged).

Regenerate dogfood preview (not a product path):

```bash
node scripts/render-flow.js \
  docs/design/project-flow/dogfood/fluxo-sugestao.json \
  -o /tmp/flow-diagram-dogfood.html
```

Open via existing serve only if you need a visual check; do not add `file://` to the skill.

**Step 2: Patch KB / LEDGER / skill** — one sentence each: L2 = three SVG diagrams; lists are not the view; mermaid is still not the product.

**Step 3: Run the three render test files + find-missing-flow + serve-flow**

```bash
node --test tests/render-flow.test.js tests/flow-layout.test.js tests/flow-draw.test.js tests/find-missing-flow.test.js tests/serve-flow.test.js
```

Expected: PASS.

**Step 4: Commit** `docs(flow): diagram L2 + regenerate live flow.html`

---

## Execution notes

- TDD: red → green → commit. Do not “write all modules then tests”.
- Prefer `minimal-xor.json` for unit geometry; dogfood for “UI words stay on sequence only”.
- `escapeHtml` already lives in `scripts/lib/render-site.js`.
- Worktree is already `.worktrees/project-flow` (`plan/project-flow`). Do not create another worktree unless asked.
- Operator evaluates F0–F2 at the end; this plan is **not** finalize.
