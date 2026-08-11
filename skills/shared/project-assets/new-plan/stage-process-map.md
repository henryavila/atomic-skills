# Stage — Process map (L1 estrutura + L2 HTML) — INESCAPÁVEL

## Contract

**Iron Law P1:** NO PLAN WITHOUT PROCESS MAP (`docs/kb/process-map.md`).

Draft + **show** + ratify `process/process.yaml` (L1), render `process/map.html` (L2), advance creation-gate to `process-map`. **Never skip.** Deriving the graph by renaming `phases[]` is **forbidden** (Iron Law P2).

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

## Non-skippable questions (HARD)

Every interactive step in this stage uses **{{ASK_USER_QUESTION_TOOL}}** and is **not skippable**.

| Rule | Enforcement |
|------|-------------|
| Tool required | Free-text chat (“ok”, “sim”, “pode”, “depois”, “skip”, “lgtm”) is **not** a valid answer — re-invoke {{ASK_USER_QUESTION_TOOL}} |
| One of the listed options | “Other” with skip/defer/later intent → re-ask with the same options |
| No silent default | Do **not** pick Browser, TUI, audience, or Aprovar for the user |
| No advance without answers | Do **not** write final `ratifiedAt`, do **not** advance `process-map` / `ready` until **audience**, **display surface**, and **ratify** each returned an explicit option |
| Cancel is a real choice | Only the labeled **Cancelar** option on ratify may stop the stage (gate stays at `summaries`) |

If the host declines / cannot run {{ASK_USER_QUESTION_TOOL}}: **STOP**. Do not invent answers. Tell the operator the stage is blocked until the tool works.

There are **three** non-skippable questions in order: **(1) audience → (2) display surface → (3) ratify**.

---

## Paths

```
PLAN_DIR=.atomic-skills/projects/<project-id>/<slug>
L1=$PLAN_DIR/process/process.yaml
L2=$PLAN_DIR/process/map.html
```

## Steps (mandatory order)

### 1. Audience — {{ASK_USER_QUESTION_TOOL}} (not skippable)

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
- **Do not set `ratifiedAt` yet** — draft only until step 6 approves

**HARD anti-collapse:** if `main` stages biject 1:1 to `plan.phases[]` titles with only cosmetic renames, **rewrite** until the graph is a confidence/value journey. Warn the user explicitly if you almost collapsed.

**Lint:** no `T-00x`, paths, `implementar`, `verifier` in copy (enforced by `validateProcessMap`).

### 3. Write draft L1 + render L2 (before any confirm)

```bash
mkdir -p "$PLAN_DIR/process"
# write process.yaml WITHOUT ratifiedAt (draft)
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)"
node "$PKG_ROOT/scripts/render-process-map.js" "$L1" -o "$L2" --audience <audience>
```

L2 must exist on disk **before** asking how/where to view it. Do **not** run `find-missing-process-map --strict-html` yet (it requires `ratifiedAt`).

Optional draft frontmatter on the plan (no `ratifiedAt` until step 6):

```yaml
processMap:
  path: process/process.yaml
  htmlPath: process/map.html
  audience: <chosen>
```

### 4. Display surface — {{ASK_USER_QUESTION_TOOL}} (not skippable)

**Question:** Onde você quer ver o mapa do processo **antes** de aprovar?

| Option | Meaning |
|--------|---------|
| No browser (Recommended) | Open `map.html` via `open_url` / host open (same contract as `help --html`) |
| No TUI (esta conversa) | Full map rendered as structured markdown in the agent/TUI transcript |
| Nos dois | Browser **and** TUI — both required before ratify |

**HARD:**

- This question is **not optional** and **not skippable**.
- Do **not** default to browser or TUI without the tool answer.
- Do **not** jump to ratify (step 6) without completing the chosen surface(s) in step 5.
- Free-text “abre aí” / “tanto faz” → re-ask this question.

Persist the choice in the session as `displaySurface`: `browser` | `tui` | `both`.

### 5. Show the map (inescapable — matches step 4)

Execute **exactly** what the operator picked:

**Browser** (`browser` or `both`):

```bash
# WSL-aware open_url from project-view / help --html — never bare xdg-open hang
open_url "$L2"   # or host equivalent: open / start
```

Announce absolute path + content-sha from the HTML `data-pm-content-sha`.

**TUI** (`tui` or `both`):

Print a **complete** map in the transcript (install language), not a one-line summary:

1. Header: `actor` · `scenario` · `audience` · `youAreHere`
2. Table: `id` · `kind` · layperson name · developer name · youGain (short)
3. Edges: `from → to (solid|dashed)` for every edge
4. Path to L2 for later reopen: `process/map.html`

**Empty show is a violation.** If browser open fails, surface the error + path and still require TUI full map before ratify (or re-ask display surface). If TUI was chosen, do not open the browser unless the user re-answers step 4 as **Nos dois** / **No browser**.

### 6. Ratify L1 — {{ASK_USER_QUESTION_TOOL}} (not skippable)

**Only after** step 5 completed for the chosen surface(s).

**Question:** Aprovar este mapa do processo?

Present (or re-present) the same table as TUI so the options sit under a visible draft. Options:

- **Aprovar mapa**
- **Ajustar** (user edits → rewrite draft L1 → re-render L2 → re-run steps 4–5 if they want a different surface, else re-show previous surface → re-ask this question)
- **Cancelar** (stop; do **not** set `ratifiedAt`; do **not** advance gate; plan stays not ready)

On **Aprovar mapa**, set:

```yaml
ratifiedAt: "<ISO now UTC>"
ratifiedBy: "operator"
audience: <chosen>
```

Rewrite L1 with those fields, re-render L2, stamp plan frontmatter if used:

```yaml
processMap:
  path: process/process.yaml
  htmlPath: process/map.html
  ratifiedAt: <same>
  audience: <same>
  displaySurface: <browser|tui|both>
```

Generic “yes/ok/do it” **without** this tool question = re-prompt. Approving **without** having shown the map (step 5) = **violation** — go back to steps 4–5.

### 7. HARD gate

```bash
node "$PKG_ROOT/scripts/find-missing-process-map.js" "$PLAN_DIR/plan.md" --strict-html
```

Exit ≠ 0 → fix; do **not** advance `process-map`.

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
| Display/audience/ratify skipped or free-text only | Re-ask with {{ASK_USER_QUESTION_TOOL}}; no advance |
| Map not shown before ratify | Block ratify; run steps 4–5 |
| Collapse to phases | Rewrite draft; do not stamp `ratifiedAt` |
| find-missing fails | Fix YAML/HTML; re-run render |
| adopt path | **Same stage required** — no exemption |

## Red flags

- "Skip process map for a small plan"  
- "phases[] is enough"  
- "HTML only, no YAML"  
- "YAML only, no HTML"  
- "I'll invent stages after implement"  
- "Confirm in TUI without opening/showing the map"  
- "Default to browser so we don't ask"  
- "User said ok in chat — that counts as Aprovar"  
