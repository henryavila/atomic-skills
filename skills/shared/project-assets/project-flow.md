# project — `flow` (day-2 L1/L2)

Loaded for `/atomic-skills:project flow` and the alias `process`.

> Communicate with the user in the install-configured language.

This is a **day-2** command. It is **not** a creation stage. Ready without flow is legal. Do **not** invent nodes from `phases[]`. Do **not** write `map.html`. Do **not** put flow in `.implement.yaml`.

## Paths

```
.atomic-skills/projects/<project-id>/<plan-slug>/flow/flow.json   # L1 SoT
.atomic-skills/projects/<project-id>/<plan-slug>/flow/flow.html   # generated, NEVER map.html
```

Foreign plan: `dirname(plan.md)/flow/` — same `flowPathsForPlan(plan.md)`.

## Grammar

```
/atomic-skills:project flow [--check] [--open] [--strict]
/atomic-skills:project process   → same as flow (alias)
```

Parse {{ARG_VAR}} first.

| Flag | Action |
|------|--------|
| `--check` or `--strict` | run the detector only (step `--check`) |
| `--open` | generate/update if needed, then show |
| no flag | generate / update / show / ratify loop |

## 1. Resolve plan

Same nested-first resolution as `status` / no-args (`{{ASSETS_PATH}}/project-view.md`). Ambiguous → disambiguation there.

No plan → tell the user this is **day-2**. They can run `new plan` (flow draft is optional, not a gate) or point at a plan file. Stop.

```
PLAN_MD=<resolved plan.md>
PLAN_DIR=<dirname of PLAN_MD>
L1=$PLAN_DIR/flow/flow.json
L2=$PLAN_DIR/flow/flow.html
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
```

## 2. Generate / update (`flow.json` missing or stale)

If `$L1` is missing: agent **MAY** draft a graph from `design.md` / source / ratified `businessIntent`. **Forbidden** to invent nodes from `phases[]`.

Write draft `$L1` **without** `ratifiedAt` / `ratifiedGraphSha` (only `buildFlowRatification` may stamp). Then render:

```bash
mkdir -p "$PLAN_DIR/flow"
node "$PKG_ROOT/scripts/render-flow.js" "$L1" -o "$L2"
```

If the graph changed after a previous stamp (`ratifiedGraphSha` ≠ current `graphSha`), treat the stamp as stale — require re-ratify (step 5). Re-render HTML after every L1 rewrite.

`process.yaml` / `map.html` are **not** a flow. Ignore them as success.

## 3. Show (`--open` or default)

Show `$L2` (browser and/or TUI) **before** any ratify question.

**Browser:** open `$L2` with the WSL-aware `open_url` contract in `{{ASSETS_PATH}}/project-view.md` / `help --html`. Never bare `xdg-open`.

**TUI:** print a complete structured summary from `$L1` (not a one-liner): `actor` · `scenario` · graph `entry` · each node id/type/`processLabel` · xor `when`/`label`/`next`. Path to `$L2`.

If `--open` only: show and stop (do not ratify unless the user asked to ratify).

## 4. Ratify — {{ASK_USER_QUESTION_TOOL}} only

Chat "ok" / "yes" / "lgtm" is **not** ratify. Re-invoke {{ASK_USER_QUESTION_TOOL}}.

**Question:** Approve this flow?

- **Aprovar**
- **Ajustar** (edit path)
- **Cancelar** (leave unstamped; ready still legal)

Host cannot run the tool → **STOP**. Do not invent a stamp.

## 5. On Aprovar — stamp only via `buildFlowRatification`

Never hand-write `ratifiedAt` or `ratifiedGraphSha`. Run:

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
import { buildFlowRatification } from process.argv[1];
const path = process.argv[2];
const doc = JSON.parse(readFileSync(path, "utf8"));
const next = buildFlowRatification(doc, { ratifiedBy: "operator" });
writeFileSync(path, JSON.stringify(next, null, 2) + "\n");
' "$PKG_ROOT/scripts/find-missing-flow.js" "$L1"
node "$PKG_ROOT/scripts/render-flow.js" "$L1" -o "$L2"
```

## 6. `--check`

```bash
node "$PKG_ROOT/scripts/find-missing-flow.js" "$PLAN_MD" --strict
```

Exit ≠ 0 → surface issues; do not claim green.

## 7. Re-ratify when the graph changed

If `$L1` has a stamp and the current graph sha diverges: show again, then step 4–5. Do not keep a stale stamp.

## 8. Edit path (Ajustar)

Agent rewrites `$L1` (labels, xor branches, nodes) + re-render `$L2`. **No visual editor.** Then show (step 3) and re-ask ratify.

## Red flags

- Inventing nodes from `phases[]`
- Writing `map.html` or treating `process.yaml` as the flow
- Hand-writing `ratifiedAt` / `ratifiedGraphSha`
- Treating chat "ok" as ratify
- Blocking `ready` because flow is missing
- Adding a creation stage `flow`
