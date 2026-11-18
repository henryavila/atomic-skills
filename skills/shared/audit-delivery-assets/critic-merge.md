# Critic merge (full depth preferred)

**Purpose:** How to merge field-axis results into a durable Findings Ledger and
verdict proposal. **Full depth** prefers a **fresh critic** after a structured Gap
List; **light depth** may keep parent-only merge.

{{READ_TOOL}} this asset after axis legs return (Phase 2 → ledger) and before the
verdict gate (Phase 3).

---

## Depth policy

| Depth | Merge path | Notes |
|-------|------------|-------|
| **`full`** (default) | Blind field legs → **Gap List** → product **downgrade-only** vs residual CRITICAL → **fresh critic** preferred | Critic sees Spec Package + Gap List + axis ledgers — not success narrative |
| **`light`** | Parent may synthesize ledger from matrix + residual greps | Same verdict hard blocks; no soft CLOSED |

Light depth **may keep parent merge**. Full depth **should not** skip the critic when
a spawn path is available ({{INVESTIGATOR_TOOL}}); if unavailable, parent merge with
explicit degradation warning (same family as axis inline fallback).

---

## Full-depth sequence (HARD order)

### 1. Field legs (blind)

Product, residual, and any opt-in axes (backend/frontend/prosecution) run **without**
sharing findings. Collect per-axis checklists + gaps.

### 2. Gap List (union, pre-verdict)

Build a **Gap List** — durable table of every CRITICAL→LOW gap from all legs, before
any downgrade:

| # | Title | Sev | Axis | Dn/Pn | Evidence |
|---|-------|-----|------|-------|----------|
| … | … | … | … | … | `path:line` |

Rules:

- Dedup **by mechanism** later; Gap List may temporarily keep near-duplicates.
- Claims without evidence stay **unverified** — do not drop silently.
- Residual CRITICAL always lands on the Gap List even if product said RESOLVED.

### 3. Product downgrade-only (vs residual CRITICAL)

Product matrix rows may be **downgraded** when residual (or prosecution) supplies
counter-evidence:

- Residual **CRITICAL** on a load-bearing surface → product RESOLVED for related Dn/Pn
  becomes **PARTIAL** or **NO** (never the reverse: residual cannot **upgrade** product
  to RESOLVED).
- **Downgrade-only** — parent/product must not raise severity of residual hits downward
  without re-read (G1).

### 4. Fresh critic (preferred)

Spawn a **fresh** critic agent (new context) with:

1. **Spec Package only** (anti-success-framing — see `spec-package.md`)
2. Gap List + per-axis gap excerpts
3. Mission: produce merged Findings Ledger + provisional verdict rationale
4. Forbid: inventing Dn/Pn; applying fixes; suite-green ⇒ CLOSED

Critic output feeds `findings-ledger.md` merge rules. Operator (parent) still owns the
final verdict gate (`verdict-gate.md`) and must re-read CRITICAL cites (G1).

**Why fresh:** Parent-only synthesis reuses the same context that ran greps and can
anchor on "mostly green." Fresh critic is preferred over parent-only synthesis at full
depth.

### 5. Parent finalizes

- Apply `findings-ledger.md` + `severity.md`
- Run `verdict-gate.md`
- If critic unavailable: parent merge + log "critic merge skipped — isolation/context degraded"

---

## Light depth

- Parent greps + matrix fill OK
- Gap List still recommended (short form)
- Fresh critic **optional**
- CLOSED still blocked by CRITICAL residual, residual opt-out/invalid, load-bearing NO,
  staged/multi-hop failures

---

## Forbidden

- Promoting residual CRITICAL off the ledger because product "looks shipped"
- Parent inventing RESOLVED after a thin Gap List
- Feeding success/shipping narrative into the critic brief
- Skipping residual leg and claiming full-depth critic merge
