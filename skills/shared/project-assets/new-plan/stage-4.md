# Stage 4 — Receive markdown plan

## Contract

HARD-BLOCK: lint-design → find-missing-design-process → find-weak-design + lint-source. Then receive source.

**creation-gates stage target:** `source`

After this stage closes, advance with:

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
GATE=".atomic-skills/status/creation-gates/<project-id>-<slug>.json"
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --advance <next-stage> --write
```

Do **not** load other `new-plan/stage-*.md` files while executing this stage.

---

Read the source plan (either the file seeded from the approved design, the file the user pointed at, or the in-skill template the user filled in).

**PLAN precondition — refuse without an approved design (R-ORCH-09).** Before decomposing, confirm a committed `design.md` exists for this plan and passes the section lint **and** the design-process detectors. Run in order (any non-zero exit **HARD-BLOCKS** — do not decompose):

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
DESIGN_MD="projects/<project-id>/<slug>/design.md"
DIGEST_MD="projects/<project-id>/<slug>/research-digest.md"
DESIGN_GATE=".atomic-skills/status/design-gates/<project-id>-<slug>.json"

# 1) Section lint (Context, Non-goals, Interview, Decisions, Chosen approach)
node "$PKG_ROOT/scripts/lint-design.js" "$DESIGN_MD"
# add --migration when the plan is a one-way-door / migration (requires a Blast radius section)

# 2) Process receipt present + status ready (Interview, debate, digest, critic, userApproved)
node "$PKG_ROOT/scripts/find-missing-design-process.js" "$DESIGN_GATE"
# R-ORCH-03 exempt lanes only: pass --lane adopt|ad-hoc|single-task (never silent skip)

# 3) Quality: soft-language, non-goals≠echo, interview length, research digest strength
node "$PKG_ROOT/scripts/find-weak-design.js" "$DESIGN_MD" "$DIGEST_MD"
```

A non-zero exit (missing file, missing/empty required section, design-gates not ready, or weak design/digest) **HARD-BLOCKS** the plan — do not decompose. Either run `atomic-skills:brainstorm` to produce the design and process receipt, or, for a lane triage explicitly exempted from DESIGN (ad-hoc / single-task per R-ORCH-03, or `adopt` capturing a pre-lifecycle plan), record that exemption verbatim and pass `--lane` to the detectors. PLAN never starts on a design that does not lint clean **and** prove process.

**No-Placeholders precondition — reject authored fill-me markers (R-ORCH-12).** The source plan itself must be free of leftover template/placeholder markers before it can decompose:

```bash
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/lint-source.js" <source.md>
```

A non-zero exit — any `REPLACE_*`, `TODO`/`TBD`/`FIXME` sentinel, fuzzy `<path>`-class placeholder, or "similar to Task N" cross-task hand-waving — **HARD-BLOCKS** decompose: **no file is written**. Fix the source and re-run. The gate is deterministic and zero-token (a pure `node` string scan, no LLM call), so it runs identically on every host. Unlike DESIGN, **no lane is exempt** from this one: even the magnitude-exempt single-task lane runs the No-Placeholders lint (R-ORCH-03 — "single-task runs ZERO gates *only* No-Placeholders lint"). It is intentionally narrow — a documented path *variable* like `projects/<id>/<slug>/` is not flagged; only the fixed fuzzy vocabulary (`<path>`, `<file>`, `<dir>`, `<…>`, …) is.

Sanity checks before decomposing:
- File is well-formed markdown (has at least one H1 or H2 header).
- File is < 5,000 lines (anything larger almost certainly contains noise that needs splitting first — surface a warning and ask the user to confirm).
- The file is *outside* the materialized state tree (`.atomic-skills/projects/*/`; legacy `.atomic-skills/plans/`). This skill never decomposes a previously-materialized plan.

If any check fails: surface the specific issue, do not proceed.
