# project — `process` (L1/L2 process map)

Loaded for `/atomic-skills:project process` and aliases.

> Communicate with the user in the install-configured language.

**Canon:** `docs/kb/process-map.md`  
**Iron Law P1:** NO PLAN WITHOUT PROCESS MAP — structure (YAML) + HTML are integral to every multi-phase plan.

## Paths

```
.atomic-skills/projects/<project-id>/<plan-slug>/process/process.yaml   # L1 SoT
.atomic-skills/projects/<project-id>/<plan-slug>/process/map.html       # L2 generated
```

## Grammar

```
/atomic-skills:project process [--check] [--audience=layperson|developer|both] [--strict-html]
/atomic-skills:project process --open     # default: regenerate if needed + open HTML
```

## Resolution

Same active plan resolution as `status` / no-args (nested-first). Ambiguous → disambiguation in `project-view.md`. No plan → tell user to run `new plan` (process map is created **with** the plan, not alone).

## Default (`process` / `process --open`)

1. Resolve plan dir + paths via `processMapPathsForPlan` logic (`scripts/find-missing-process-map.js`).  
2. If L1 missing → **STOP**. Message: process map is mandatory at plan creation; run incomplete creation resume or re-bootstrap. Do **not** invent a map from `phases[]` silently.  
3. If L1 present but L2 missing/stale:
   ```bash
   node "$PKG_ROOT/scripts/render-process-map.js" "$L1" -o "$L2" --audience <from yaml or flag>
   ```
4. Open `map.html` (WSL-aware `open_url` same as `help --html`).  
5. Print content-sha + audience + pin (`youAreHere`).

## `--check`

```bash
node "$PKG_ROOT/scripts/find-missing-process-map.js" "$PLAN_MD" --strict-html
```

Exit ≠ 0 → surface issues; do not claim green.

## `--audience=`

Override render lens; rewrite `audience` in YAML only if user ratifies a permanent change (AskUserQuestion). Ephemeral override: pass flag to render only.

## Creation (not this command)

L1+L2 are authored in `new-plan/stage-process-map.md` during `new plan` / `adopt`. This command is the **day-2 viewer / re-render**, not a substitute for creation.

## Red flags

- Generating YAML from phase titles alone  
- Editing HTML by hand  
- Skipping map because “plan is technical”  
