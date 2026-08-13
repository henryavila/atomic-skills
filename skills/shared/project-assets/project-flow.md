# project — `flow` (day-2 L1/L2)

Loaded for `/atomic-skills:project flow` and the alias `process`.

> Communicate with the user in the install-configured language.

This is a **day-2** command. It is **not** a creation stage. Ready without flow is legal. Do **not** invent nodes from `phases[]`. Do **not** write `map.html`. Do **not** put flow in `.implement.yaml`. `process.yaml` never satisfies.

## Paths

```
.atomic-skills/projects/<project-id>/<plan-slug>/flow/flow.json   # L1 SoT
.atomic-skills/projects/<project-id>/<plan-slug>/flow/flow.html   # generated, NEVER map.html
```

Foreign / any source markdown: `dirname(<source.md>)/flow/` — same `flowPathsForPlan(<source.md>)`. Filename need not be `plan.md`.

## Grammar

```
/atomic-skills:project flow [<path-to-source.md>] [--check] [--open] [--strict]
/atomic-skills:project flow --plan <path-to-source.md> [--check] [--open] [--strict]
/atomic-skills:project process   → same as flow (alias)
```

Parse {{ARG_VAR}} first.

| Flag / arg | Action |
|------|--------|
| `<path-to-source.md>` or `--plan <path>` | bind this file (AS `plan.md` or foreign `docs/cutover.md`); paths via `flowPathsForPlan` |
| `--check` or `--strict` | run the detector only (step `--check`) |
| `--open` | generate/update if needed, then show |
| no flag | generate / update / show / ratify loop |

## 1. Resolve plan

1. If {{ARG_VAR}} has an existing `*.md` path (positional or `--plan`), that file **is** the plan. `PLAN_MD` = that path (any filename). Resolve L1/L2 with `flowPathsForPlan(PLAN_MD)` — **never** the sidecar.
2. Else same nested-first resolution as `status` / no-args (`{{ASSETS_PATH}}/project-view.md`). Ambiguous → disambiguation there.

No plan and no source file → tell the user this is **day-2**. They can run `new plan` (flow draft is optional, not a gate) or `project flow path/to/source.md`. Stop.

```
PLAN_MD=<resolved plan.md or source.md>
PLAN_DIR=<dirname of PLAN_MD>
L1=$PLAN_DIR/flow/flow.json
L2=$PLAN_DIR/flow/flow.html
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
```

## 2. Generate / update (`flow.json` missing or stale)

If `$L1` is missing: agent **MAY** draft a graph from `design.md` / source / ratified `businessIntent`. **Forbidden** to invent nodes from `phases[]`.

Write draft `$L1` **without** `ratifiedAt` / `ratifiedGraphSha` (only `buildFlowRatification` may stamp). Then render via {{BASH_TOOL}}:

```bash
mkdir -p "$PLAN_DIR/flow"
node "$PKG_ROOT/scripts/render-flow.js" "$L1" -o "$L2"
```

If the graph changed after a previous stamp (`ratifiedGraphSha` ≠ current document sha), treat the stamp as stale — require re-ratify (step 5). Re-render HTML after every L1 rewrite.

`process.yaml` / `map.html` are **not** a flow. Ignore them as success.

## 3. Show (`--open` or default)

Show `$L2` (browser and/or TUI) **before** any ratify question.

**Browser:** open `$L2` with the WSL-aware `open_url` contract in `{{ASSETS_PATH}}/project-view.md` / `help --html`. Never bare `xdg-open`.

**TUI:** print a complete structured summary from `$L1` (not a one-liner): `actor` · `scenario` · graph `entry` · each node id/type/`label` · messages · machines. Path to `$L2`.

If `--open` only: show and stop (do not ratify unless the user asked to ratify).

## 4. Ratify — {{ASK_USER_QUESTION_TOOL}} only (required after show)

Chat "ok" / "yes" / "lgtm" is **not** ratify. Re-invoke {{ASK_USER_QUESTION_TOOL}}.

**Show first.** Do **not** stamp without completing step 3, then this question.

**Question:** Approve this flow?

- **Aprovar**
- **Ajustar** (edit path)
- **Cancelar** (leave unstamped; ready still legal)

Host cannot run the tool → **STOP**. Do not invent a stamp. Do not hand-write `ratifiedAt` from free-text chat.

## 5. On Aprovar — stamp only via `buildFlowRatification`

Never hand-write `ratifiedAt` or `ratifiedGraphSha`. Run via {{BASH_TOOL}}:

```bash
node "$PKG_ROOT/scripts/lib/flow-ratification.js" --ratify "$L1" --ratified-by operator
node "$PKG_ROOT/scripts/render-flow.js" "$L1" -o "$L2"
```

`buildFlowRatification` is the **only** writer of those two fields.

## 6. `--check`

Run via {{BASH_TOOL}}:

```bash
node "$PKG_ROOT/scripts/find-missing-flow.js" "$PLAN_MD" --strict
```

`--check` on the command is this detector `--strict` path. Exit ≠ 0 → surface issues; do not claim green.

## 7. Re-ratify when the graph changed

If `$L1` has a stamp and the current document sha diverges: show again, then step 4–5. Do not keep a stale stamp.

## 8. Edit path (Ajustar)

Agent rewrites `$L1` (labels, xor branches, nodes, messages, machines) + re-render `$L2`. **No visual editor.** Then show (step 3) and re-ask ratify.

## Red flags

- Inventing nodes from `phases[]`
- Writing `map.html` or treating `process.yaml` as the flow
- Hand-writing `ratifiedAt` / `ratifiedGraphSha`
- Treating chat "ok" as ratify
- Stamping before show + {{ASK_USER_QUESTION_TOOL}}
- Blocking `ready` because flow is missing
- Adding a creation stage `flow`
