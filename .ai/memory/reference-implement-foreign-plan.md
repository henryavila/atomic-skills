# Implement foreign-plan lane (2026-07-28)

`implement` accepts **AS inventory slug** or **path/to/plan.md** outside inventory.

## Entry (start only)

`src/implement-target-kind.js` → `classifyImplementTarget` / `classifyImplementArgv`.

- `foreign-plan` → **AskUserQuestion** (no silent default):
  1. **Promote** → `project adopt` → Flow A
  2. **Implement as Foreign** → `skills/shared/implement-foreign-plan.md`
- Promote **never** at FINALIZE/ARCHIVE.

## Foreign lane

| Piece | Location |
|-------|----------|
| Sidecar | colocated `plan.md` → `plan.implement.yaml` |
| Work order | `src/foreign-work-order.js` (FINALIZE + ARCHIVE terminal phases) |
| Parse S0–S3 | `src/foreign-plan-parse.js` |
| Worktree | `plan/<slug>` + `.worktrees/<slug>` |
| Ground-truth | mandatory before code |
| Mode default | automate (maestro light; host-thin) |
| Close | `markTaskDone` + evidence on sidecar (not AS `done`) |
| End | FINALIZE (validation/PR) → ARCHIVE (clean WT/branch) |

## Tests

`tests/implement-foreign-plan.test.js`
