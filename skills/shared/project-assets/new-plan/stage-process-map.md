# Stage — Process map (L1 estrutura + L2 HTML) — INESCAPÁVEL

## Contract

**Iron Law P1:** NO PLAN WITHOUT PROCESS MAP (`docs/kb/process-map.md`).

Draft + ratify `process/process.yaml` (L1), render `process/map.html` (L2), advance creation-gate to `process-map`. **Never skip.** Deriving the graph by renaming `phases[]` is **forbidden** (Iron Law P2).

**creation-gates stage target:** `process-map`  
**Runs after:** `summaries` (Stage 7)  
**Runs before:** `reviews` (Stage 8)

After this stage closes:

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
GATE=".atomic-skills/status/creation-gates/<project-id>-<slug>.json"
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --advance process-map --write
```

Do **not** load other `new-plan/stage-*.md` files while executing this stage.

---

## Paths

```
PLAN_DIR=.atomic-skills/projects/<project-id>/<slug>
L1=$PLAN_DIR/process/process.yaml
L2=$PLAN_DIR/process/map.html
```

## Steps (mandatory order)

### 1. Audience — {{ASK_USER_QUESTION_TOOL}}

**Question:** Este mapa do processo é para quem?

| Option | Meaning |
|--------|---------|
| Quem não é de tech | Lente leigo only |
| Dev, em alto nível (Recommended for tooling plans) | Lente dev abstraído (domínio, não código) |
| Ambos | Toggle no HTML |

Persist choice as `audience`. Generic “ok” is **not** a choice — re-ask.

### 2. Draft L1 (process of the **objective**)

Agent drafts `process.yaml` from **design.md + source narrative + ratified businessIntent**, in the install-configured language:

- `actor`, `scenario` (one sentence)
- `stages[]` with `kind`: done | main | optional | always
- **both** `copy.layperson` and `copy.developer` always filled (even if audience is single-lens — the other lens is ready if they switch later)
- `edges[]` solid vs dashed
- `youAreHere` = first main stage the operator should start (or current pin)
- `sourcedFrom` per stage (design section / principle — **not** “F0 title”)
- `mapsToPhases` **optional** and weak; leave `[]` if unsure

**HARD anti-collapse:** if `main` stages biject 1:1 to `plan.phases[]` titles with only cosmetic renames, **rewrite** until the graph is a confidence/value journey. Warn the user explicitly if you almost collapsed.

**Lint:** no `T-00x`, paths, `implementar`, `verifier` in copy (enforced by `validateProcessMap`).

### 3. Ratify L1 — {{ASK_USER_QUESTION_TOOL}}

Present the full draft (table: id · kind · layperson name · developer name · youGain short). Options:

- **Aprovar mapa**  
- **Ajustar** (user edits → re-present)  
- **Cancelar** (stop; do **not** advance gate; plan stays not ready)

On approve, set:

```yaml
ratifiedAt: "<ISO now UTC>"
ratifiedBy: "operator"
audience: <chosen>
```

Generic “yes/ok/do it” **without** the draft visible = re-prompt.

### 4. Write L1

```bash
mkdir -p "$PLAN_DIR/process"
# write process.yaml (validated content only)
```

Optional: stamp plan frontmatter:

```yaml
processMap:
  path: process/process.yaml
  htmlPath: process/map.html
  ratifiedAt: <same>
  audience: <same>
```

### 5. Render L2 (deterministic)

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
node "$PKG_ROOT/scripts/render-process-map.js" "$L1" -o "$L2" --audience <audience>
```

### 6. HARD gate

```bash
node "$PKG_ROOT/scripts/find-missing-process-map.js" "$PLAN_DIR/plan.md" --strict-html
```

Exit ≠ 0 → fix; do **not** advance `process-map`.

### 7. Open for the operator

Open `map.html` in the browser (same opener contract as `help --html` / `open_url` when available). Announce path + content-sha.

### 8. Advance gate

```bash
node "$PKG_ROOT/scripts/assert-creation-stage.js" "$GATE" --advance process-map --write
```

Then continue to Stage 8 (reviews).

---

## Failure modes

| Failure | Action |
|---------|--------|
| User cancels ratify | Leave gate at `summaries`; no ready |
| Collapse to phases | Rewrite draft; do not write L1 |
| find-missing fails | Fix YAML/HTML; re-run render |
| adopt path | **Same stage required** — no exemption |

## Red flags

- "Skip process map for a small plan"  
- "phases[] is enough"  
- "HTML only, no YAML"  
- "YAML only, no HTML"  
- "I'll invent stages after implement"  
