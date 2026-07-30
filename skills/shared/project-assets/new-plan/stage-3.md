# Stage 3 — Plan input source

## Contract

Produce the decompose-shaped source plan (seed from design, existing path, or minimal template). Advance creation-gates to `source`.

**creation-gates stage target:** `source`

After this stage closes:

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
GATE=".atomic-skills/status/creation-gates/<project-id>-<slug>.json"
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --advance source --write
```

Do **not** load other `new-plan/stage-*.md` files while executing this stage.

---

Once an approved `design.md` exists, choose the source the decomposer will consume. Present Structured Options:

```
Plan source?
  (a) Seed a decompose-shaped source from the approved design  ← recommended
  (b) I'll paste an existing markdown plan file path
  (c) Give me the minimal template — I'll fill it
```

If `(a)`:
- Translate the design's **Decisions** + **Chosen approach** into the decompose grammar (`## F0/F1` phases + `Goal:` + `### Tn` + fenced `exit_gate` YAML) in a draft source (the throwaway `source.md` / `.atomic-skills/_drafts/<slug>-source.md`). The design is the source of truth; the source markdown is its decompose-ready projection. Use this path for Stage 4.

If `(b)`:
- Ask for the markdown file path. Validate it exists. Skip to Stage 4.

If `(c)` (the minimal-template subflow):

1. Copy `{{ASSETS_PATH}}/minimal-source.template.md` to a temp path inside the repo, e.g. `.atomic-skills/_drafts/<slug>-source.md`. Create the `_drafts/` directory if needed.
2. Tell the user the file path and what sections to fill (title, narrative, principles, glossary, ≥ 1 phase with ≥ 1 task, and each task's four SPEC fields — Files / scopeBoundary / acceptance / verifier). **Fill every section you keep**: the No-Placeholders lint (Stage 4) rejects any leftover `REPLACE_*` marker before decompose, so to omit an optional section (e.g. glossary) *delete it entirely* rather than leaving its `REPLACE_*` markers in place.
3. Wait for the user to confirm they've finished editing. Re-read the file.
4. Use this path as the source-plan path for Stage 4.

The temp source under `.atomic-skills/_drafts/` is not canonical state — delete it after decompose.

> **Nested-layout draft (R-XAGENT-05):** in the `projects/<id>/<slug>/` layout the per-plan source draft lives at `projects/<id>/<slug>/source.md`. Delete it after decompose (throwaway projection).
