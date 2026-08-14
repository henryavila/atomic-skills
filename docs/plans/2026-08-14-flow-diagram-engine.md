# Flow diagram engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the list/card `flow.html` with three deterministic SVG diagrams (sequence, BPM, state machines) plus PDTI-style tabs and pan/zoom — no mermaid.

**Architecture:** `normalizeFlow` stays. New pure `flow-layout.js` (walk + boxes) and `flow-draw.js` (SVG strings). `render-flow.js` embeds the SVGs in a tabbed viewport. Same JSON + same `ds.css` = byte-identical HTML. `data-fl-content-sha` remains the L1 fingerprint.

**Tech Stack:** Node test runner, existing `validate-flow` / `normalizeFlow` / `escapeHtml`, inline SVG + a few dozen lines of tab/pan/zoom JS. No new npm deps.

**Design:** `docs/plans/2026-08-14-flow-diagram-engine-design.md`

**Do not:** change schema, brief, ratification, `serve-flow`, `--strict`, or finalize F0–F2. Do not commit automate `prepare.json` / `sealed-brief.md`.

---

## Verified premises (G1 / G6)

| Claim | Marker |
|---|---|
| `normalizeFlow` is exported from `scripts/lib/render-flow.js` and calls `assertValidFlow` | verified_by: `scripts/lib/render-flow.js:201-228` |
| `renderFlowHtml` / `buildFlowHtml` / `FLOW_CSS` / `contentFingerprint` live in the same module; CLI calls `buildFlowHtml` | verified_by: `scripts/lib/render-flow.js:41-42,259-260,456-517,525-531`; `scripts/render-flow.js:20,104` |
| Current L2 is lists: `renderSequence` → `<ol class="fl-messages">`; BPM/machines similar; nav is `role="navigation"` | verified_by: `scripts/lib/render-flow.js:325-343,386-405,408-448,488-491` |
| `collectSequence` is **unexported**; it walks `graph.nodes` **and** `graph.subgraphs` | verified_by: `scripts/lib/render-flow.js:236-256` |
| `walkNodeIds` is BFS from entry, then leftover ids sorted | verified_by: `scripts/lib/render-flow.js:66-81` |
| `escapeHtml` lives in `scripts/lib/render-site.js` and escapes `& < > " '` | verified_by: `scripts/lib/render-site.js:80-87`; imported at `render-flow.js:11` |
| `data-fl-content-sha` is `contentFingerprint(normalized)` (data only, not HTML) | verified_by: `scripts/lib/render-flow.js:41-42,464,469`; `tests/render-flow.test.js:135-141` |
| `find-missing-flow --strict` compares HTML `data-fl-content-sha` to L1 sha, **not** HTML bytes | verified_by: `scripts/find-missing-flow.js:102-114,197-210` |
| `render-flow.js --check` requires **byte-identical** HTML **and** matching content-sha | verified_by: `scripts/render-flow.js:115-128` |
| PDTI `walkLayout` guard 50; `collectBranchChain` depth cap 12 **and** inner guard 40 | verified_by: `docs/design/project-flow/dogfood/fluxo-completo.html:219-220,235,265-274` |
| PDTI loop-ref: second visit of `cur` pushes `{ kind: 'loop-ref', nodeId: cur }` | verified_by: `fluxo-completo.html:221-223` |
| Dogfood dir has **no** committed `flow.html` | verified_by: `docs/design/project-flow/dogfood/` listing (fluxo-completo.html, fluxo-sugestao.json, minimal-xor.json, … — no flow.html) |
| `minimal-xor.json`: actors U/R; S1 activity + 1 message; D1 xor Accepts/Rejects → end_ok/end_no; machine `request` with notify on **reject** transition | verified_by: `docs/design/project-flow/dogfood/minimal-xor.json:8-86` |
| `fluxo-sugestao.json`: labels `Criar sugestão`, `Envio válido?`; message `Clica em Sugerir necessidade`; `S3edit.next === "D2"`; types only activity/xor/end; **no** `subgraphs` | verified_by: `fluxo-sugestao.json:31-32,50,77,206-225` |
| Live `project-flow` L1 types are only xor/activity/end (no and/join/event/subprocess); `--strict` is currently exit 0 | verified_by: `flow/flow.json` node `type` fields; command `node scripts/find-missing-flow.js .atomic-skills/projects/atomic-skills/project-flow/plan.md --strict` → exit 0 |
| Schema `machines` is **required** with `minItems: 1`; each machine `nodes` has `minProperties: 1`. A valid L1 **cannot** have `machines: []` | verified_by: `meta/schemas/flow.schema.json:7-16,71-76,359-361` |
| Event `kind` enum is `timer` \| `error` only (not `start`) | verified_by: `meta/schemas/flow.schema.json:291-301` |
| Existing landmark test **requires** `role="region"` on each `#fl-sequence/#fl-bpm/#fl-machines` section | verified_by: `tests/render-flow.test.js:218-224` |
| Existing next-mutation test requires `data-node-id="S3edit"` **then** `data-next="D2"` on the **same** tag | verified_by: `tests/render-flow.test.js:97-109` |
| DS tokens used by this plan exist (`--fg-faint`, `--status-warning-line`, `--bg-elevated`, `--status-success`, `--status-error`, `--border-subtle`) | verified_by: `site/assets/ds.css:23,36,45,49-51,62` |
| `FLOW_CSS` already uses `--fs-3xl`, `--space-12`, `--font-sans`; no `.ds-` classes | verified_by: `scripts/lib/render-flow.js:261,313` |
| `skills/shared/project-assets/project-flow.md` does **not** describe the panel as lists/cards | verified_by: grep of that file (paths + serve-flow; no `fl-messages` / list/card view) |
| New `scripts/lib/*.js` ship via package `files: ["scripts/"]` | verified_by: `package.json:9-12` |
| Worktree is `.worktrees/project-flow` on `plan/project-flow` | verified_by: `git rev-parse --show-toplevel` / branch |

---

### Task 1: Walk MODEL graph into layout steps

**Files:**
- Create: `scripts/lib/flow-layout.js`
- Create: `tests/flow-layout.test.js`

**Step 1: Write the failing test**

Create `tests/flow-layout.test.js` (new file) with:

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
const DOGFOOD = JSON.parse(
  readFileSync(join(ROOT, 'docs/design/project-flow/dogfood/fluxo-sugestao.json'), 'utf8'),
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
    // Must be kind===loop-ref. `nodeId==='S1'` alone is tautological (first visit is activity S1).
    assert.ok(steps.some((s) => s.kind === 'loop-ref' && s.nodeId === 'S1'));
    assert.equal(steps.filter((s) => s.kind === 'activity' && s.nodeId === 'S1').length, 1);
    assert.ok(steps.length < 8);
  });

  it('walks dogfood nested xors and treats S1e→D1 as loop-ref', () => {
    const steps = walkSteps(normalizeFlow(DOGFOOD));
    const d1 = steps.find((s) => s.kind === 'xor' && s.nodeId === 'D1');
    assert.ok(d1, 'entry path must include xor D1');
    const fail = d1.branchPanels.find(
      (p) => p.branch.id === 'D1.fail' || p.branch.next === 'S1e',
    );
    assert.ok(fail.chain.some((c) => c.kind === 'activity' && c.nodeId === 'S1e'));
    // S1e.next is D1 (the xor already on the trunk) — not a second D1 expansion.
    assert.ok(fail.chain.some((c) => sLoop(c)), 'S1e.next=D1 must be loop-ref');
    const allXor = [];
    const visit = (list) => {
      for (const s of list) {
        if (s.kind === 'xor' || s.kind === 'and') {
          allXor.push(s.nodeId);
          for (const p of s.branchPanels) visit(p.chain);
        }
      }
    };
    visit(steps);
    assert.ok(allXor.includes('D1'));
    assert.ok(allXor.includes('D_edit'));
    assert.ok(allXor.includes('D2'));
  });

  it('starts at xor when graph.entry is a xor (live project-flow L1 shape)', () => {
    const raw = structuredClone(MINIMAL);
    raw.graph.entry = 'D1';
    const steps = walkSteps(normalizeFlow(raw));
    assert.equal(steps[0].kind, 'xor');
    assert.equal(steps[0].nodeId, 'D1');
  });
});

function sLoop(c) {
  return c.kind === 'loop-ref' && c.nodeId === 'D1';
}
```

Self-loop `S1.next = 'S1'` is schema-legal (verified_by: `validate-flow.js:143-148` only checks `next` exists as a node id). `normalizeFlow` therefore does not throw.

Dogfood `D1.fail → S1e → D1` is a real cycle (verified_by: `fluxo-sugestao.json:81-120`). Walking it as a second xor expansion hangs or overflows.

**Step 2: Run — expect FAIL** (module missing)

```bash
node --test tests/flow-layout.test.js
```

**Step 3: Minimal `walkSteps`**

Port the PDTI **idea** (`walkLayout` + `collectBranchChain` in `docs/design/project-flow/dogfood/fluxo-completo.html:215-318`) onto MODEL types (verified_by: `docs/design/project-flow/MODEL.md:26-29`):

- `activity` / `event` / `subprocess` / `join` → step + follow `next`
- `xor` / `and` → step with `branchPanels[]` (each `branch` + `chain` from `branch.next`); do **not** continue a trunk after xor **or** and (MODEL has no trunk `next` on those types)
- `end` → step, stop
- `next` already visited → `{ kind: 'loop-ref', nodeId }`
- Trunk guard **50** (PDTI `walkLayout`); nested-decision depth cap **12** (PDTI `collectBranchChain`). Do **not** copy PDTI types `sequence`/`decision`.

**v1 subgraphs:** do **not** enter `graph.subgraphs`. Neither dogfood nor live L1 has `subgraphs` (verified_by: grep `subgraphs` in `fluxo-sugestao.json` and `flow/flow.json` → 0 hits). `subprocess` is one step (follow `next`; do not explode `ref`).

Export `walkSteps(normalized)` only in this task.

**Step 4: Re-run — expect PASS**

**Step 5: Commit** `feat(flow): walk MODEL graph into layout steps`

---

### Task 2: Sequence layout (actors, rows, XOR bands)

**Files:**
- Modify: `scripts/lib/flow-layout.js`
- Modify: `tests/flow-layout.test.js` (**append** to the existing `describe`; do not create a second file or duplicate the Task 1 imports)

**Step 1: Failing test** (append)

```js
// Merge into the existing flow-layout import from Task 1; do not add a second import block.

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

it('layoutSequence records a loop-ref instead of another message row', () => {
  const doc = structuredClone(MINIMAL);
  doc.graph.nodes.S1.next = 'S1';
  const layout = layoutSequence(normalizeFlow(doc));
  assert.ok(layout.loops.some((lp) => lp.nodeId === 'S1'));
});

it('layoutSequence on dogfood keeps UI narration as messages and stacks xor bands', () => {
  const layout = layoutSequence(normalizeFlow(DOGFOOD));
  assert.ok(layout.messages.some((m) => /Clica em Sugerir necessidade/.test(m.text)));
  assert.ok(layout.bands.length >= 2, 'dogfood has nested/sequential xors');
});
```

**Step 2: Run — expect FAIL** (`layoutSequence` missing)

```bash
node --test tests/flow-layout.test.js
```

**Step 3: Implement `layoutSequence`**

Export `GEOM` (numbers from design §2):

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
- `loop-ref` → `{ label, y, nodeId }` in `loops`
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

it('draws lifelines, numbered arrow, xor rail; never writes alt/else as a UML label', () => {
  const svg = drawSequenceSvg(layoutSequence(normalizeFlow(MINIMAL)));
  assert.match(svg, /<svg[^>]*data-surface="sequence"/);
  assert.match(svg, /data-actor-id="U"/);
  assert.match(svg, /data-actor-id="R"/);
  assert.match(svg, /data-lifeline/);
  assert.match(svg, /data-from="U"[^>]*data-to="R"|data-to="R"[^>]*data-from="U"/);
  assert.match(svg, /Sends the request/);
  assert.match(svg, /data-xor-rail="D1"/);
  assert.match(svg, /data-branch-label/);
  // Scope: visible text nodes / UML words only. Do NOT run this regex on full HTML
  // (inline tab JS is allowed to contain the JavaScript keyword `else`).
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
- Escape all text (`escapeHtml` from `scripts/lib/render-site.js:80`)
- Double-render of the same layout must be byte-identical (no random ids)

**Step 4: Re-run — expect PASS**

**Step 5: Commit** `feat(flow): draw sequence SVG with elegant xor rail`

---

### Task 4: BPM layout (TB, branch columns)

**Files:**
- Modify: `scripts/lib/flow-layout.js`
- Modify: `tests/flow-layout.test.js` (append)

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

it('layoutBpm places and/join/event/subprocess from a valid synthetic doc', () => {
  const raw = structuredClone(MINIMAL);
  raw.graph = {
    entry: 'E1',
    nodes: {
      E1: { type: 'event', label: 'Timer fires', kind: 'timer', next: 'F1' },
      F1: {
        type: 'and',
        label: 'Split work',
        branches: [{ next: 'A1' }, { next: 'P1' }],
      },
      A1: { type: 'activity', label: 'Left work', who: 'Requester', messages: [], next: 'J1' },
      P1: { type: 'subprocess', label: 'Right sub', ref: 'other', messages: [], next: 'J1' },
      J1: { type: 'join', label: 'Together', of: 'F1', next: 'Z' },
      Z: { type: 'end', label: 'Done' },
    },
  };
  const layout = layoutBpm(normalizeFlow(raw));
  const byId = Object.fromEntries(layout.nodes.map((n) => [n.id, n]));
  assert.equal(byId.E1.type, 'event');
  assert.equal(byId.F1.type, 'and');
  assert.equal(byId.P1.type, 'subprocess');
  assert.equal(byId.J1.type, 'join');
  assert.ok(byId.A1.x !== byId.P1.x);
  assert.equal(layout.nodes.filter((n) => n.id === 'J1').length, 1);
  assert.ok(layout.edges.some((e) => e.from === 'F1' && e.to === 'A1'));
  assert.ok(layout.edges.some((e) => e.from === 'J1' && e.to === 'Z'));
});
```

Event `kind` **must** be `timer` or `error` (verified_by: schema enum). Do not invent `kind: "start"`.

**Step 2: Run — expect FAIL**

```bash
node --test tests/flow-layout.test.js
```

**Step 3: `layoutBpm(normalized)`**

- Walk **reachable** nodes from `graph.entry` only. Do **not** use `walkNodeIds` leftover-id pass (that would park unreachable nodes as floating boxes).
- Place each node **id once**. Both AND branches in the synthetic doc go to `J1` — one join box (below the taller column) plus edges from both parents. A second `J1` is a bug.
- Trunk x = center
- `xor`/`and`: children laid in sibling columns (`x` offset by `bpmNodeW + branchGap`); recurse so nested xor/and also open columns
- Node `{ id, type, label, who, x, y, w, h }` — `label` is business (`node.label`), never the technical id as the visible label
- Edges `{ from, to, label, points }`
- `subprocess`: one box (do not explode subgraphs / `ref`)

**Step 4: Re-run — expect PASS**

**Step 5: Commit** `feat(flow): BPM TB layout with xor columns`

---

### Task 5: BPM SVG shapes

**Files:**
- Modify: `scripts/lib/flow-draw.js`
- Modify: `tests/flow-draw.test.js` (append; reuse ROOT/MINIMAL from Task 3)

**Step 1: Failing test**

```js
import { layoutBpm } from '../scripts/lib/flow-layout.js';
import { drawBpmSvg } from '../scripts/lib/flow-draw.js';

const UI_WORD_RE = /\b(click|modal|screen)\b|clica|\btela\b/i;
const DOGFOOD = JSON.parse(
  readFileSync(join(ROOT, 'docs/design/project-flow/dogfood/fluxo-sugestao.json'), 'utf8'),
);

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

it('dogfood BPM keeps business labels; sequence keeps UI narration', () => {
  const doc = normalizeFlow(DOGFOOD);
  const bpm = drawBpmSvg(layoutBpm(doc));
  assert.match(bpm, /Criar sugestão/);
  assert.match(bpm, /Envio válido\?/);
  assert.doesNotMatch(bpm, UI_WORD_RE);
  const seq = drawSequenceSvg(layoutSequence(doc));
  assert.match(seq, /Clica em Sugerir necessidade/);
});

it('puts data-node-id before data-next on the same tag (existing render-flow mutation regex)', () => {
  const svg = drawBpmSvg(layoutBpm(normalizeFlow(DOGFOOD)));
  assert.match(svg, /data-node-id="S3edit"[^>]*data-next="D2"/);
});

it('draws event circle, and/join bar, subprocess rect', () => {
  const raw = structuredClone(MINIMAL);
  raw.graph = {
    entry: 'E1',
    nodes: {
      E1: { type: 'event', label: 'Timer fires', kind: 'timer', next: 'F1' },
      F1: {
        type: 'and',
        label: 'Split work',
        branches: [{ next: 'A1' }, { next: 'P1' }],
      },
      A1: { type: 'activity', label: 'Left work', who: 'Requester', messages: [], next: 'J1' },
      P1: { type: 'subprocess', label: 'Right sub', ref: 'other', messages: [], next: 'J1' },
      J1: { type: 'join', label: 'Together', of: 'F1', next: 'Z' },
      Z: { type: 'end', label: 'Done' },
    },
  };
  const svg = drawBpmSvg(layoutBpm(normalizeFlow(raw)));
  assert.match(svg, /data-node-id="E1"[^>]*data-shape="circle"|data-shape="circle"[^>]*data-node-id="E1"/);
  assert.match(svg, /data-node-id="F1"[^>]*data-shape="bar"/);
  assert.match(svg, /data-node-id="J1"[^>]*data-shape="bar"/);
  assert.match(svg, /data-node-id="P1"[^>]*data-shape="rect"/);
});
```

**Step 2: Run — expect FAIL**

**Step 3: `drawBpmSvg(layout)`**

| type | `data-shape` | geometry |
|------|----------------|----------|
| activity / subprocess | `rect` | rounded rect |
| xor | `diamond` | polygon |
| and / join | `bar` | horizontal bar |
| event | `circle` | thin stroke |
| end | `circle` | filled |

Edges as `<path>` + `<text>` for branch label.

Attribute order on the node element (required by `tests/render-flow.test.js:107-108`):

`data-node-id="…" data-node-type="…" data-shape="…" data-next="…"` when `next` is known.

Colors from DS (`--bg-elevated`, `--status-warning` for xor, `--status-success` / `--status-error` for end if you can tell from label — do **not** invent PDTI status 10).

Visible `<text>` is `node.label` only. Technical ids stay in `data-node-id`, never as the label text.

**Step 4: Re-run — expect PASS**

**Step 5: Commit** `feat(flow): draw BPM SVG shapes`

---

### Task 6: Machine layout + SVG

**Files:**
- Modify: `scripts/lib/flow-layout.js`
- Modify: `scripts/lib/flow-draw.js`
- Modify: `tests/flow-layout.test.js`
- Modify: `tests/flow-draw.test.js`

**Step 1: Failing tests** (append)

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

`entry` on a state is derived from `machine.entry === stateId` (verified_by: `minimal-xor.json:58` + `normalizeMachines` at `render-flow.js:187-192`). Notify lives on the **reject** transition, not accept (verified_by: `minimal-xor.json:64-86`).

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
- Modify: `scripts/lib/render-flow.js` (`FLOW_CSS`, `renderFlowHtml`, delete `renderSequence` / `renderBpm` / `renderMachines` **and** `collectSequence`)
- Modify: `tests/render-flow.test.js`

Keep `normalizeFlow`, `contentFingerprint`, `buildFlowHtml`, `finalizeHtml`, `sha256`, `FLOW_CSS` export. CLI `scripts/render-flow.js` is not edited.

**Step 1: Replace the list-era assertions in `tests/render-flow.test.js`**

Keep: three surfaces, messages on sequence, no UI words on BPM, effects on machines, mutation of `next` changes HTML, no mermaid, determinism, DS tokens, CLI `-o` / `--stdout` / `--check` / default `flow.html`.

Change:

- Sequence/BPM/machines bodies must contain `svg[data-surface=…]` (string match `data-surface="sequence"` **inside** an `<svg>`).
- `assert.doesNotMatch(html, /<ol class="fl-messages">/)`
- `assert.doesNotMatch(html, /<ol class="fl-nodes">/)`
- **Do not** run `/\balt\b|\belse\b/` against the **full** HTML. Inline tab JS is allowed to use the keyword `else`. Ban `alt`/`else` only inside each `drawSequenceSvg` output (Task 3).
- Landmarks **use** `role="tabpanel"` (still `id="fl-sequence"` etc. so CLI tests stay green).
- **Update** the existing assertion at `tests/render-flow.test.js:222` from `role="region"` to `role="tabpanel"` (or `role="region"|role="tabpanel"` during the edit, then land on `tabpanel`). Leaving `role="region"` in place **fails** this task.
- Nav is `role="tablist"` with `role="tab"`
- `FLOW_CSS` still uses `--fs-3xl` / `--space-12` / `--font-sans` or `--bg-canvas` / `--bg-surface`; still no `.ds-`
- Add: `html` includes `data-tab=` and a viewport class `fl-viewport`
- Add empty-sequence: clone `fluxo-sugestao.json` (or MINIMAL), set **every** `messages` array to `[]`, run `buildFlowHtml`. Sequência tab+panel is `hidden` or omitted. BPM section remains and is the selected tab (`aria-selected="true"` on `data-tab="bpm"`). Schema-legal: `messages` is not in any node `required` array (verified_by: `meta/schemas/flow.schema.json:205-218` activityNode).
- **Do not** write a `buildFlowHtml` test with `machines: []`. Schema `machines.minItems` is 1 (verified_by: `flow.schema.json:71-76`); `normalizeFlow` → `assertValidFlow` throws. Defensive hide: if `renderFlowHtml` sees `normalized.machines.length === 0`, hide Máquinas. Unit-test that by calling `renderFlowHtml({ ...normalizeFlow(MINIMAL), machines: [] }, DS)` — bypass validate, do not invent a valid empty-machines L1.

Write these tests **first**. Run:

```bash
node --test tests/render-flow.test.js
```

Expected FAIL: lists still emitted; `role="tablist"` absent; current HTML has no `alt`/`else` tokens (so an HTML-wide alt/else regex would give a **false green** today — that is why it is forbidden).

**Step 2: Confirm FAIL** (lists still emitted)

**Step 3: Rewrite `renderFlowHtml`**

Keep the existing shell (verified_by: `scripts/lib/render-flow.js:468-514`): `<!DOCTYPE html>`, `lang="pt-BR"`, `data-fl-slug`, `data-fl-content-sha`, inlined `dsCss` + `FLOW_CSS`, `<header class="fl-header">` (eyebrow, `h1.fl-title`, `p.fl-scenario`, `fl-meta` actor + plan), and `<footer class="fl-footer">` (content-sha prefix + schema). Do **not** delete the header/footer — only replace the nav + the three list `<section>`s.

Structure of the **replaced** middle (header/footer omitted here):

```html
<nav class="fl-toc" role="tablist">
  <button type="button" role="tab" data-tab="sequence" aria-selected="true" aria-controls="fl-sequence">Sequência</button>
  <button type="button" role="tab" data-tab="bpm" aria-selected="false" aria-controls="fl-bpm">Fluxo</button>
  <button type="button" role="tab" data-tab="machines" aria-selected="false" aria-controls="fl-machines">Máquinas</button>
</nav>
<div class="fl-toolbar">… + − 100% ajustar …</div>
<p class="fl-hint" id="fl-hint">…</p>
<div class="fl-viewport" id="fl-viewport">
  <section id="fl-sequence" class="fl-surface" role="tabpanel" data-surface="sequence">SVG</section>
  <section id="fl-bpm" hidden role="tabpanel" data-surface="bpm">…</section>
  <section id="fl-machines" hidden role="tabpanel" data-surface="machines">…</section>
</div>
<script>
/* tabs + pan/zoom only. No layout. No mermaid. No Date.now. */
</script>
```

Tab labels (locked — do not invent others):

| `data-tab` | Visible label | `id` / `data-surface` |
|---|---|---|
| `sequence` | Sequência | `fl-sequence` / `sequence` |
| `bpm` | Fluxo | `fl-bpm` / `bpm` |
| `machines` | Máquinas | `fl-machines` / `machines` |

Design §3 says “Estados” for the third tab. Keep **Máquinas** so the section still matches existing `/machine/i` checks and current `h2` vocabulary. `data-surface="machines"` stays.

- Call `layoutSequence` / `drawSequenceSvg` / `layoutBpm` / `drawBpmSvg` / `layoutMachines` / `drawMachinesSvg` on the already-normalized doc
- Hide sequence tab+panel when `layoutSequence(normalized).messages.length === 0`. Do **not** reuse `collectSequence` (it also walks subgraphs; `walkSteps` does not — delete it with the list builders). When sequence is hidden, the default selected tab is **Fluxo** (`data-tab="bpm"` `aria-selected="true"`, bpm panel not `hidden`).
- Hide machines when `normalized.machines.length === 0` (defensive; unreachable via `buildFlowHtml`)
- BPM always rendered
- Keep `finalizeHtml` (CRLF strip + trailing whitespace) so determinism tests stay honest
- Keep `data-fl-content-sha="${contentFingerprint(normalized)}"`
- Inline JS: click tab → `hidden` / `aria-selected`; pointer pan on `#fl-viewport`; wheel+ctrl scale a wrapper; buttons. Default scale 1. Deterministic (no random, no `Date.now`)
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
- Modify: `.atomic-skills/projects/atomic-skills/project-flow/flow/flow.html` via CLI (L1 unchanged → stamp stays valid because `--strict` compares the attribute sha to L1, not HTML bytes)
- Modify: `docs/kb/flow.md` (L2 is diagrams, not lists)
- Modify: `docs/design/project-flow/LEDGER.md` — short note under §6: mermaid still dead; native SVG panel is the view
- `skills/shared/project-assets/project-flow.md`: **skip** unless a new grep still claims the panel is lists/cards (current text does not)

**Step 1: No new test.** Existing `--check` / `--strict` must stay green after re-render.

```bash
node scripts/render-flow.js \
  .atomic-skills/projects/atomic-skills/project-flow/flow/flow.json \
  -o .atomic-skills/projects/atomic-skills/project-flow/flow/flow.html

node scripts/find-missing-flow.js \
  .atomic-skills/projects/atomic-skills/project-flow/plan.md --strict
```

Expected: `--strict` exit 0 (L1 sha unchanged; HTML attribute rewritten to the same hex).

Regenerate dogfood preview (not a product path):

```bash
node scripts/render-flow.js \
  docs/design/project-flow/dogfood/fluxo-sugestao.json \
  -o /tmp/flow-diagram-dogfood.html
```

Open via existing serve only if you need a visual check; do not add `file://` to the skill.

**Step 2: Patch KB / LEDGER** — one sentence each: L2 = three SVG diagrams; lists are not the view; mermaid is still not the product.

**Step 3: Run the three render test files + find-missing-flow + serve-flow**

```bash
node --test tests/render-flow.test.js tests/flow-layout.test.js tests/flow-draw.test.js tests/find-missing-flow.test.js tests/serve-flow.test.js
```

Expected: PASS.

**Step 4: Commit** `docs(flow): diagram L2 + regenerate live flow.html`

---

## Execution notes

- TDD: red → green → commit. Do not “write all modules then tests”.
- Prefer `minimal-xor.json` for unit geometry; dogfood for “UI words stay on sequence only” and nested xor.
- `escapeHtml` already lives in `scripts/lib/render-site.js:80`.
- Worktree is already `.worktrees/project-flow` (`plan/project-flow`). Do not create another worktree unless asked.
- Operator evaluates F0–F2 at the end; this plan is **not** finalize.
- `youAreHere` is normalized (verified_by: `scripts/lib/render-flow.js:220`) and does not appear in `renderFlowHtml` (verified_by: only hit in that file is the normalize field). This plan does **not** draw a you-are-here pin (out of scope; schema unchanged).

## Review corrections (local 2026-08-14)

Applied after adversarial local review. Not a ground-truth receipt.

1. Cycle test required `kind === 'loop-ref'` (old `nodeId === 'S1'` was tautological).
2. `/\belse\b/` must not run on full HTML (inline JS).
3. Existing `role="region"` assertion must be updated to `tabpanel`.
4. Hide-sequence uses `layoutSequence.messages`, not `collectSequence`.
5. Empty-machines via `buildFlowHtml` is schema-illegal (`minItems: 1`).
6. `data-node-id` then `data-next` order locked to the existing mutation regex.
7. Nested xor + and/join/event/subprocess tests added; event `kind` is `timer|error`.
8. Tab labels locked; G1/G6 premises table added; G2 soft-language tokens removed.
9. Dogfood `S1e→D1` is loop-ref; AND/join is one box; empty sequence selects Fluxo.
10. Ground-truth: keep header/footer; xor-first entry (live L1) has a walk test.

## Ground-truth review

**Status:** complete-with-findings
**Codebase class:** populated
**Scanned:** `scripts/lib/render-flow.js`, `scripts/lib/render-site.js`, `scripts/lib/validate-flow.js`, `scripts/lib/serve-flow.js`, `scripts/lib/flow-ratification.js`, `scripts/lib/render-process-map.js`, `scripts/render-flow.js`, `scripts/find-missing-flow.js`, `tests/render-flow.test.js`, `tests/find-missing-flow.test.js`, `tests/serve-flow.test.js`, `meta/schemas/flow.schema.json`, `site/assets/ds.css`, `docs/design/project-flow/dogfood/*`, `docs/design/project-flow/MODEL.md`, `docs/design/project-flow/LEDGER.md`, `docs/plans/2026-08-14-flow-diagram-engine-design.md`, `docs/kb/flow.md`, `skills/shared/project-assets/project-flow.md`, `package.json`, `.atomic-skills/projects/atomic-skills/project-flow/flow/{flow.json,flow.html,brief.json}` → 25+ files
**Commit:** 864f39dd
**At:** 2026-08-14T15:20:00Z

### A — Plan premises vs code

| # | Premise | Result | Evidence |
|---|---------|--------|----------|
| 1 | `normalizeFlow` / `renderFlowHtml` / `buildFlowHtml` / `FLOW_CSS` / `contentFingerprint` exist; CLI calls `buildFlowHtml` | ok | `scripts/lib/render-flow.js:201-228,456-531`; `scripts/render-flow.js:20,104` |
| 2 | Current L2 is list/card HTML (`<ol class="fl-messages">`, `role="navigation"`) | ok | `scripts/lib/render-flow.js:325-343,488-491` |
| 3 | `collectSequence` is unexported and also walks `graph.subgraphs` | ok | `scripts/lib/render-flow.js:236-256` |
| 4 | `walkNodeIds` BFS + leftover sorted ids | ok | `scripts/lib/render-flow.js:66-81` |
| 5 | `escapeHtml` in `render-site.js` escapes `& < > " '` | ok | `scripts/lib/render-site.js:80-87` |
| 6 | `data-fl-content-sha` is data-only fingerprint | ok | `scripts/lib/render-flow.js:41-42,464,469`; `tests/render-flow.test.js:135-141` |
| 7 | `find-missing-flow --strict` compares HTML attribute sha to L1, not HTML bytes | ok | `scripts/find-missing-flow.js:197-210` |
| 8 | `render-flow.js --check` requires byte-identical HTML | ok | `scripts/render-flow.js:115-128` |
| 9 | PDTI `walkLayout` guard 50; `collectBranchChain` depth 12 + guard 40; loop-ref on second visit | ok | `fluxo-completo.html:219-274` |
| 10 | Dogfood dir has no committed `flow.html` | ok | `docs/design/project-flow/dogfood/` listing |
| 11 | `minimal-xor.json` actors U/R, S1→D1 xor, notify on reject | ok | `minimal-xor.json:8-86` |
| 12 | `fluxo-sugestao.json` labels/UI split; `S3edit.next=D2`; `S1e.next=D1`; types activity/xor/end only; no subgraphs | ok | `fluxo-sugestao.json:31-120,206-225` |
| 13 | Live L1 entry is xor `TemArquivo`; types xor/activity/end; `--strict` exit 0 | ok | `flow/flow.json:28-31`; command exit 0 |
| 14 | Schema `machines.minItems: 1`; event `kind` is `timer`\|`error` | ok | `meta/schemas/flow.schema.json:71-76,291-301` |
| 15 | Landmark test requires `role="region"`; mutation test requires `data-node-id` then `data-next` | ok | `tests/render-flow.test.js:97-109,218-224` |
| 16 | DS tokens `--fg-faint`, `--status-warning-line`, `--bg-elevated`, `--status-success`, `--status-error`, `--border-subtle` exist | ok | `site/assets/ds.css:23,36,45,49-51,62` |
| 17 | `package.json` `files` includes `scripts/` | ok | `package.json:9-12` |
| 18 | `validate-flow` allows self-loop `next` if the id exists | ok | `scripts/lib/validate-flow.js:143-148` |
| 19 | MODEL types include activity/xor/and/join/subprocess/event/end | ok | `docs/design/project-flow/MODEL.md:26-29` |
| 20 | Header/footer exist in today's `renderFlowHtml` (title, scenario, actor, content-sha footer) | ok | `scripts/lib/render-flow.js:468-514` |
| 21 | `youAreHere` is normalized only (not rendered) | ok | `scripts/lib/render-flow.js:220` (sole hit) |
| 22 | `serve-flow` / `flow-ratification` / CLI `scripts/render-flow.js` exist and are out of mutate-scope | ok | `scripts/lib/serve-flow.js`; `scripts/lib/flow-ratification.js`; `scripts/render-flow.js` |
| 23 | Design file exists | ok | `docs/plans/2026-08-14-flow-diagram-engine-design.md` |
| 24 | `flow-layout.js` / `flow-draw.js` do not exist yet | ok | create-targets; `scripts/lib/` listing has neither |

### B — Code present, plan silent (impact candidates)

| # | Finding | Location | Impact | Disposition |
|---|---------|----------|--------|-------------|
| 1 | `renderFlowHtml` emits header (title/scenario/actor) + footer; Task 7 snippet showed only tabs | `scripts/lib/render-flow.js:479-511` | direct | folded — Task 7 now keeps header/footer |
| 2 | Live L1 `graph.entry` is xor (`TemArquivo`); unit fixtures all start at an activity | `flow/flow.json:28-31` | direct | folded — Task 1 xor-first walk test |
| 3 | `walkNodeIds` leftover-id pass would float unreachable nodes if reused for BPM | `scripts/lib/render-flow.js:78-80` | direct | folded — Task 4 reachable-only + no leftover pass |
| 4 | `collectSequence` walks subgraphs; `walkSteps` v1 must not | `scripts/lib/render-flow.js:252-255` | direct | folded — delete `collectSequence`; hide-sequence uses `layoutSequence.messages` |
| 5 | `machines.minItems: 1` makes empty-machines `buildFlowHtml` impossible | `meta/schemas/flow.schema.json:71-76` | direct | folded — Task 7 defensive hide + synthetic `renderFlowHtml` test |
| 6 | `youAreHere` normalized, never drawn | `scripts/lib/render-flow.js:220` | indirect | accepted / oos — no pin in this plan |
| 7 | `data-flow-content-sha` alias in detector | `scripts/find-missing-flow.js:111-113` | indirect | accepted — keep emitting `data-fl-content-sha` |
| 8 | `serve-flow` serves HTML bytes opaquely | `scripts/lib/serve-flow.js` | none | accepted — do not change |
| 9 | `render-process-map.js` sibling (abolished L2) | `scripts/lib/render-process-map.js` | none | oos — not the product |
| 10 | `flow-ratification.js` / brief / `--strict` fence | `scripts/lib/flow-ratification.js` | none | oos — Do not list |
| 11 | `audience` normalized, unused in HTML | `scripts/lib/render-flow.js:219` | none | accepted |
| 12 | `graph.subgraphs` in schema; no fixture has any | `meta/schemas/flow.schema.json` | indirect | accepted v1 — do not enter subgraphs |
| 13 | `walkNodeIds` may become unused after list BPM dies | `scripts/lib/render-flow.js:66` | none | accepted — may remain exported |
| 14 | Dual `--check`: CLI bytes vs detector sha | `scripts/render-flow.js:124-126` vs `find-missing-flow.js:206-209` | indirect | accepted — Task 8 uses detector `--strict`; re-render keeps CLI `--check` green |

**Counts:** premises=24 (missing=0, false=0); impacts=14 (direct=5, indirect=4)

## Reviews

- ground-truth: complete-with-findings | mode=ground-truth | fp=ff7b161eaf28 | premises=24 | impacts=14 @ 864f39dd (2026-08-14T15:20:00Z)
