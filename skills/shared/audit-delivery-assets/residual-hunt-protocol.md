# Residual hunt protocol (domain-agnostic)

**Purpose:** Prove delivery is not a half-migration. Residual is a **protocol**, not a domain-specific grep list.

{{READ_TOOL}} this asset for the **residual** axis (and parent greps when residual is in-session). Lekto / note-pipeline strings appear only as **e.g.** — never as universal steps.

---

## Inputs (required)

| Input | Source |
|-------|--------|
| **OLD_TERMS** | Intent Package vocabulary delta (OLD column) + legacy aliases still taught |
| **NEW_TERMS** | Intent Package vocabulary delta (NEW column) + canonical SSOT names |
| **Surface inventory** | Intent Package surface list (or single-surface flag + that surface) |

If vocabulary was marked `none (additive)`, still derive **NEW_TERMS** from decisions/SSOT and treat absent OLD as "no rename" — residual still hunts dual paths, teaching drift, and false-green fixtures around NEW_TERMS.

### Invalid residual (blocks CLOSED)

A residual leg that **cannot** derive OLD_TERMS/NEW_TERMS (or NEW_TERMS for additive packages) from the Intent Package **must not** report "nothing found" as success.

- Mark residual result: **`invalid residual`**
- Finding: CRITICAL or HIGH — "residual protocol starved of terms/surfaces"
- Global verdict: **cannot be CLOSED** while invalid residual stands (see verdict-gate)

Missing surface inventory without single-surface flag is an Intent Package abort (Phase 0), not a residual "clean" result.

---

## Protocol steps

### 1. Derive term sets

```text
OLD_TERMS = vocabulary.OLD ∪ documented legacy aliases (input-only OK if labeled)
NEW_TERMS = vocabulary.NEW ∪ SSOT canonical names from Intent Package
```

Normalize case/underscore variants when grepping (e.g. `drafts_ready` / `draftsReady` / `DRAFTS_READY`) — variants are search aids, not new product decisions.

### 2. Cross terms × surface inventory

For **each** surface in the inventory, search for OLD_TERMS and for teaching of pre-change lifecycle as current truth.

| Surface (from inventory) | Hunt for |
|--------------------------|----------|
| Storage / DB / enums | OLD as **stored** value or poll default |
| API / jobs / workers | OLD in force/reprocess/accept paths; recovery skip of NEW residual |
| Client / UI | Helpers that **rewrite** server truth from side channels |
| Tests / fixtures | Seed OLD while asserting NEW (false green) |
| Teaching (docs, MCP, skills, runbooks) | OLD lifecycle presented as current |
| Config / env / checklists | Defaults contradict NEW decisions |

Customize surface rows to the inventory names; keep the **classes** of hunt.

### 3. Classify every hit

| Class | Meaning | Typical severity |
|-------|---------|------------------|
| **storage** | OLD persists as source of truth or default poll/storage | CRITICAL / HIGH |
| **alias** | OLD accepted as **input only**, normalized to NEW | LOW–MEDIUM if documented; HIGH if dual-write |
| **teaching** | Docs/MCP/skills/scripts teach OLD as current | HIGH |
| **dead** | Unreachable / commented / migration-only; not user path | LOW (confirm truly dead) |

Record class on each residual finding. **alias** that is intentional must be evidenced (normalizer + tests); undocumented dual paths are not alias.

### 4. Emit findings

Each non-benign hit → Findings Ledger row with:

- Title, severity, axis=`residual`, evidence `path:line`
- Classification (storage|alias|teaching|dead)
- Suggested fix one-liner

Benign **alias** / confirmed **dead** may be listed under Residual as reviewed-OK (not OPEN blockers) with evidence.

### 5. Residual classes checklist (cover all)

Hunt these **mechanism classes** on every package (domain-agnostic):

1. **Dual SSOT** — two writers/readers for the same concept (old + new)
2. **Client rewrite** — UI/client remaps server status from drafts/side channels
3. **Recovery gap** — reclaim/heal/retry paths skip NEW residual states
4. **Force/admin legacy** — admin/force/reprocess only accepts OLD failure labels
5. **Teaching surfaces** — MCP, skills, ops docs, scripts still teach pre-change lifecycle
6. **False-green fixtures** — tests seed obsolete fixtures while asserting new names
7. **Config/env drift** — defaults, `.env.example`, checklists contradict decisions

(e.g. note-pipeline SM: MCP legacy poll, `rejected` force gap, client `applyDraftsReady`, reclaim skip-with-drafts — illustrations only.)

---

## Output for residual axis

```markdown
# Axis: residual

## Term sets
- OLD_TERMS: …
- NEW_TERMS: …
- Surfaces hunted: N (list)

## Protocol validity
- valid | **invalid residual** (reason)

## Hits
| Term | Surface | Class | Evidence | Sev | Notes |
|------|---------|-------|----------|-----|-------|

## Gaps (CRITICAL → LOW)
1. …

## Reviewed-OK (alias/dead with evidence)
- …

## Not verified
- …

## Confidence %
```

---

## Parent-session minimum (when residual agent unavailable)

If {{INVESTIGATOR_TOOL}} is unavailable, operator still:

1. Derives OLD_TERMS/NEW_TERMS from Intent Package
2. {{GREP_TOOL}} OLD_TERMS across surface inventory paths
3. Classifies hits; records invalid residual if terms missing
4. Never treats empty grep without derived terms as CLOSED-eligible

---

## Red flags

- "Residual found nothing" with empty OLD_TERMS/NEW_TERMS → **invalid residual**
- Skipping teaching surfaces because "not in the PR"
- Treating all OLD string matches as CRITICAL without class (alias vs storage)
- Using only product-axis happy path to skip residual protocol
