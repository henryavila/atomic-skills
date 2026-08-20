# Plan → graph brief Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Any agent drafting a flow fills `flow/brief.json` first, derives nodes only from that brief, and a detector refuses the seven known-weak shapes before the human sees the panel.

**Architecture:** Sidecar `flow/brief.json` (not in the MODEL schema). `flowPathsForPlan` also returns `flowBrief`. `find-weak-flow-draft.js` is a read-only detector in the same family as `find-weak-business-intent.js`. The skill `project-flow.md` runs it only when writing/rewriting the graph. `--strict` / implement stay unchanged.

**Tech Stack:** Node test runner, existing `flowPathsForPlan` / `validateFlow` / `countFlowMessages`, no new runtime deps.

**Design:** `docs/plans/2026-08-13-plan-to-graph-brief-design.md`

---

### Task 1: `flowPathsForPlan` exposes `flowBrief`

**Files:**
- Modify: `scripts/find-missing-flow.js` (`flowPathsForPlan`)
- Test: `tests/find-missing-flow.test.js` (add one it)

**Step 1: Write the failing assertion**

In the existing describe that covers `flowPathsForPlan`, add:

```js
it('flowPathsForPlan also returns flowBrief', () => {
  const p = flowPathsForPlan('/tmp/demo/plan.md');
  assert.equal(p.flowBrief, join('/tmp/demo', 'flow', 'brief.json'));
});
```

**Step 2: Run it — expect FAIL** (`flowBrief` undefined)

```bash
node --test tests/find-missing-flow.test.js
```

**Step 3: Minimal implementation**

In `flowPathsForPlan`:

```js
flowBrief: join(planDir, 'flow', 'brief.json'),
```

**Step 4: Re-run — expect PASS**

**Step 5: Commit** `fix: expose flowBrief next to flow.json`

---

### Task 2: Detector — missing / empty brief (rule 1)

**Files:**
- Create: `scripts/find-weak-flow-draft.js`
- Create: `tests/find-weak-flow-draft.test.js`

**Step 1: Failing test**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkFlowDraft } from '../scripts/find-weak-flow-draft.js';

it('rule 1: missing brief is weak', () => {
  const dir = mkdtempSync(join(tmpdir(), 'flow-brief-'));
  try {
    const planMd = join(dir, 'plan.md');
    writeFileSync(planMd, '# p\n');
    mkdirSync(join(dir, 'flow'));
    writeFileSync(join(dir, 'flow', 'flow.json'), '{}');
    const r = checkFlowDraft(planMd);
    assert.equal(r.ok, false);
    assert.ok(r.issues.some((i) => /brief/i.test(i)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

**Step 2: Run — expect FAIL** (module missing)

```bash
node --test tests/find-weak-flow-draft.test.js
```

**Step 3: Minimal `checkFlowDraft`**

- Resolve paths via `flowPathsForPlan`
- If `flowBrief` missing / invalid JSON / `actor` `scenario` empty / `decisions` not non-empty array / `stateChanges` not non-empty array → issue, `ok: false`
- CLI: `node scripts/find-weak-flow-draft.js <plan.md>` exit 1 when `!ok`, 0 when ok, 2 on usage

**Step 4: Re-run — expect PASS**

**Step 5: Commit** `feat: reject flow draft with missing brief`

---

### Task 3: Rules 2–7

**Files:**
- Modify: `scripts/find-weak-flow-draft.js`
- Modify: `tests/find-weak-flow-draft.test.js`

Use one shared good fixture in the test file:

```js
const goodBrief = {
  actor: 'Operador',
  scenario: 'Carimbar o fluxo antes de executar.',
  decisions: [
    { id: 'Decidir', question: 'Aprovar?', outcomes: ['aprova', 'ajusta'] },
  ],
  stateChanges: [
    { id: 'artefato', states: ['rascunho', 'carimbado'] },
  ],
};
const goodFlow = {
  schemaVersion: '1.0',
  planSlug: 'probe',
  actor: 'Operador',
  scenario: 'Carimbar o fluxo antes de executar.',
  audience: 'both',
  actors: [{ id: 'Op', label: 'Operador', kind: 'actor' }],
  graph: {
    entry: 'Draftar',
    nodes: {
      Draftar: {
        type: 'activity',
        label: 'Draftar o grafo',
        who: 'Operador',
        messages: [{ from: 'Op', to: 'Op', text: 'Escreve a ficha', async: false }],
        next: 'Decidir',
      },
      Decidir: {
        type: 'xor',
        label: 'Aprovar?',
        branches: [
          { id: 'Decidir.aprova', when: 'aprova', label: 'Aprova', next: 'Fim' },
          { id: 'Decidir.ajusta', when: 'ajusta', label: 'Ajusta', next: 'Fim' },
        ],
      },
      Fim: { type: 'end', label: 'Fim' },
    },
  },
  machines: [
    {
      id: 'artefato',
      label: 'Artefato',
      entry: 'rascunho',
      nodes: { rascunho: { label: 'Rascunho' }, carimbado: { label: 'Carimbado' } },
      transitions: [],
    },
  ],
};
```

Tests (each mutates one thing):

| Test | Mutation | Issue matches |
|---|---|---|
| good pair | none | `ok === true` |
| rule 2 orphan node | add node id `Solto` activity | `/rastreio|orphan|brief/i` |
| rule 3 missing xor | delete `Decidir` xor | `/Decidir/` |
| rule 3 outcomes | drop `ajusta` branch | `/outcomes|saídas|ajusta/i` |
| rule 4 phase id | rename activity to `F0` | `/F0/` |
| rule 5 UI token | label `Clica no modal` | `/clique|modal|tela/i` |
| rule 6 | xor with 1 branch | `/xor|branches/i` |
| rule 7 no messages | strip all messages | `/messages/i` |
| phases in plan.md are ok | write `phases:\n  - id: F0` in plan.md, keep good graph | `ok === true` |

**Activity rule:** at least one `activity` with `who` matching `brief.actor` (trim, case-insensitive) or a non-violating label. `Draftar.who = Operador` satisfies.

**Step 2/4:** `node --test tests/find-weak-flow-draft.test.js` red then green.

**Step 5: Commit** `feat: trace flow draft to brief (rules 2-7)`

---

### Task 4: `--strict` ignores brief

**Files:**
- Test: `tests/find-weak-flow-draft.test.js` or `tests/find-missing-flow.test.js`

**Step 1:** Stamp `goodFlow` with `buildFlowRatification`, write `flow.json` + matching `flow.html` (`data-fl-content-sha`), **no** `brief.json`. Run `find-missing-flow.js --strict <plan.md>`. Expect exit 0.

**Step 3:** No product change if already true. If someone wired brief into `--strict`, revert that.

**Step 5: Commit** only if a test was added: `test: --strict still passes without brief`

---

### Task 5: Skill procedure

**Files:**
- Modify: `skills/shared/project-assets/project-flow.md`
- Modify: `docs/kb/flow.md`
- Test: `tests/flow-ratification.test.js` (string matches on the skill, same style as today)

Assert the skill contains:

- `brief.json`
- `find-weak-flow-draft`
- instruction to run the detector **before show** when writing/rewriting the graph
- instruction **not** to ask when the detector fails
- `phases[]` still forbidden
- `--strict` does **not** require brief

KB: one short paragraph pointing at the design + detector. Ficha = autoria, não cadeado.

**Step 5: Commit** `docs: project flow drafts from brief then lints`

---

### Task 6 (optional dogfood): brief for this plan

**Files:**
- Create: `.atomic-skills/projects/atomic-skills/project-flow/flow/brief.json`

Ids **must** match the grafo já carimbado (`TemArquivo`, `QualPedido`, `ChecarParaExecutar`, `Decidir`, machine `artefato`). Do **not** rewrite `flow.json` (that would stale the stamp).

Then:

```bash
node scripts/find-weak-flow-draft.js .atomic-skills/projects/atomic-skills/project-flow/plan.md
```

Expect exit 0. If rule 2 fires on activity ids (`Draftar`, `Mostrar`, …), treat those activity ids as allowed when `who` matches `actor` (already in rule 2’s activity clause). Adjust the detector, not the stamped graph.

**Step 5: Commit** `chore: dogfood flow brief for project-flow`

---

## Out of this plan

- Changing `flow.schema.json`
- `implement` / `assert-automate-gate` spawn fence
- Generator 1:1
- Visual editor
- New creation stage
