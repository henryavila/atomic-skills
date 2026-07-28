# Ground-truth review (plan ↔ code) — lazy asset

Loaded by `review-plan` **Flow E** (`--mode=ground-truth` / `--mode=gt` —
specialized type, **not** folded into `--mode=internal`) and referenced by
`implement` (HARD-GATE). Authoritative procedure — do not paraphrase the receipt
format.

**Canonical invocation (attributable):**

```text
atomic-skills:review-plan --mode=ground-truth <plan.md|slug>
```

## Why this exists

Two complementary failure modes kill plans mid-implementation:

| Direction | Failure | Example |
|-----------|---------|---------|
| **A — Plan → code** | Plan **assumes** X exists; X does not | "extend `src/matcher.js`" but the file never existed; "reuse the existing auth middleware" that is not in the tree |
| **B — Code → plan** | Code **has** Y the plan never models; Y impacts the work | Dual write path, legacy hook, polymorphic column with live rows, second entrypoint |

`project verify` does **not** cover this (state coherence only). `implement`
**refuses** to code until this review has a machine-checkable receipt.

## HARD rules

1. **Always run** for every materialized plan before declaring review complete
   and before implement. No severity threshold lets you skip writing the section.
2. **Empty / no-product-code repos still run.** If there is no product source to
   inspect, record `Status: complete-empty-repo`, list premises as N/A or none,
   and list impacts as none — with the scan evidence (globs run, result empty).
   **Silence is not a pass.**
3. **Persist in the plan body** (not only chat):
   - `## Ground-truth review` section (full A+B tables + **content floor**)
   - `- ground-truth:` line under `## Reviews` with `mode=` **and** `fp=`
4. **Content floor (machine-checked):** section must include `**Scanned:**`,
   `**Counts:**`, and real A/B substance (markdown table data rows or explicit
   `none` / greenfield wording). Empty headings fail as `thin-ground-truth-section`.
5. **Freshness (`fp=`):** stamp `fp=<12-hex>` from plan substance fingerprint
   (frontmatter minus volatile keys + body minus Reviews/Ground-truth sections +
   phase initiative files). If the plan/tasks change, re-run Flow E — detector
   returns `stale-ground-truth-receipt`.
6. **Machine gate** (zero-token):  
   `node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/find-plans-missing-ground-truth.js" <plan.md>`  
   Non-zero exit = incomplete/stale/thin receipt. `implement` HARD-BLOCKS;
   `assert-automate-gate --gate spawn` HARD-BLOCKS (JS fence, not prose only).
7. **Cannot be waived by operator chat.** There is no `--skip-ground-truth`.

## Procedure (items 21–22)

### 21 — Direction A: plan premises vs code (phantoms)

1. Read the full plan + every discovered initiative (task descriptions,
   acceptance, files/paths mentioned, "existing X", "reuse Y", "already has Z").
2. Extract an explicit list of **existence premises** — anything the plan
   treats as already true in the repo (paths, modules, APIs, commands, schemas,
   invariants, "we already do …").
3. For each premise, verify with {{GLOB_TOOL}} / {{GREP_TOOL}} / {{READ_TOOL}}:
   - **exists + matches claim** → `ok` (paste `file:line` evidence — G1)
   - **path missing** and no prior task creates it → **critical** (phantom)
   - **path exists but claim is wrong** → **significant** (false premise)
   - **cannot verify** → `unverified: <why>` (not silent ok)
4. Outputs of the plan (`outputs[].path` the task **creates**) are **not**
   premises of existence — do not flag them as missing. Inputs the task
   **reads/modifies** are premises unless a prior plan task creates them.

### 22 — Direction B: code present, plan silent (impact candidates)

1. Derive a **blast radius** from the plan: `scope.paths[]`, explicit Files /
   `outputs[]` dirs, phase titles, symbols named in tasks. If none, use the
   nearest product roots (`src/`, `lib/`, `app/`, `packages/`, language roots).
2. Inventory **what exists** in that radius that the plan does **not** mention:
   dual systems, hooks, feature flags, migrations, sibling entrypoints, data
   columns / polymorphic types, shared utilities the change will touch, tests
   that encode invariants, config that gates behavior.
3. For each candidate, classify **impact**:
   - **direct** — change will edit or depend on it
   - **indirect** — change can break or be broken by it without naming it
4. Disposition each: fold into a task / exit gate / `outOfScope` / alignment
   note on the plan, **or** record as accepted residual with reason. Do not
   leave high-impact silent findings without disposition.
5. **Empty tree:** if globs return no product files, write B as
   `none — empty/thin tree; scan: <globs> → 0 files` (still a completed pass).

## Persistence format (mandatory)

Append or update (idempotent) in the **plan** file body:

```markdown
## Ground-truth review

**Status:** complete | complete-empty-repo | complete-with-findings
**Codebase class:** empty | thin | populated
**Scanned:** <globs or paths> → <N files>
**Commit:** <short sha | uncommitted>
**At:** <ISO-8601 UTC>

### A — Plan premises vs code

| # | Premise | Result | Evidence |
|---|---------|--------|----------|
| 1 | <claim> | ok \| missing \| false \| unverified | path:line or "none — greenfield" |

### B — Code present, plan silent (impact candidates)

| # | Finding | Location | Impact | Disposition |
|---|---------|----------|--------|-------------|
| 1 | <what exists> | path | direct \| indirect \| none | task/gate/oos/accepted |

**Counts:** premises=N (missing=M, false=F); impacts=K (direct=D, indirect=I)
```

Empty-repo example (still required):

```markdown
## Ground-truth review

**Status:** complete-empty-repo
**Codebase class:** empty
**Scanned:** src/, lib/, app/, packages/ → 0 product files
**Commit:** uncommitted
**At:** 2026-07-28T12:00:00Z

### A — Plan premises vs code

| # | Premise | Result | Evidence |
|---|---------|--------|----------|
| — | none — greenfield / no existence claims | ok | scan empty |

### B — Code present, plan silent (impact candidates)

| # | Finding | Location | Impact | Disposition |
|---|---------|----------|--------|-------------|
| — | none — empty tree | — | none | n/a |

**Counts:** premises=0 (missing=0, false=0); impacts=0 (direct=0, indirect=0)
```

### Reviews receipt line

Under `## Reviews` (create the section if absent), write/refresh **one** line
(match by `- ground-truth:` prefix; never duplicate):

```markdown
- ground-truth: complete | mode=ground-truth | fp=<12-hex> | premises=N | impacts=K @ <commitSha | uncommitted> (<ISO-8601 UTC>)
```

Status token (first word before `|` or `@`) MUST be one of:
`complete` | `complete-empty-repo` | `complete-with-findings` | `ok`

**Mandatory tokens on the line:**
- `mode=ground-truth` (or `mode=gt`) — attributes Flow E
- `fp=<hex>` — plan substance fingerprint (freshness)

Compute `fp` after writing the section (so the section itself is not hashed):

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
# After editing plan body section, stamp Reviews line with fp from:
node -e "
import { assessGroundTruthPlanFile } from '$PKG_ROOT/src/ground-truth-review.js';
import { readFileSync } from 'node:fs';
const r = assessGroundTruthPlanFile(readFileSync('<plan.md>','utf8'));
// Prefer re-run after writing a draft line, or use find-plans-missing helper:
console.log(r.fingerprint);
"
```

Or: write the section + a temporary Reviews line, run the detector; on
`no-ground-truth-fingerprint` / wrong fp, set `fp=` to the printed
`current fp=` from the CLI and re-check exit 0.

Stamp commit with {{BASH_TOOL}}:
`git rev-parse --short HEAD 2>/dev/null || echo uncommitted`  
and time: `date -u +%Y-%m-%dT%H:%M:%SZ`.

## Severity → plan fixes

- **A missing / false premise (critical):** fix the plan or add a creating task
  before implement; do not leave the phantom in place.
- **B direct impact without disposition (significant):** add task, gate, or
  explicit out-of-scope; re-write the ground-truth section.
- **complete-with-findings** is allowed only when every finding has a disposition
  recorded in the table (not "we'll see during coding").

## Red flags

- "Repo is empty, skip ground-truth" → forbidden; write complete-empty-repo.
- "Internal review already passed, ground-truth is redundant" → different axis;
  implement checks the ground-truth receipt specifically.
- "I'll note it in chat and implement" → implement runs the detector on disk.
- "Premises seem fine, no need to GLOB" → GLOB/READ or it is not verified.
- "I'll put ground-truth only under `.atomic-skills/reviews/`" → plan body
  section + Reviews line are what the detector reads.
