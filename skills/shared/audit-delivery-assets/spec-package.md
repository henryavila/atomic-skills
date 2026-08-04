# Spec Package (anti-success-framing strip)

**Purpose:** What audit agents receive. **Intent criteria stay; success narrative out.**

Agents audit against a **Spec Package** — structured, checkable criteria derived
from the Intent Package — **not** a shipping narrative, suite-green praise, or
"this already shipped" handoff prose.

{{READ_TOOL}} this asset when building axis briefs (Phase 2) and whenever an
agent prompt is assembled. Axis briefs use **Spec Package only** for criteria.

---

## Spec Package vs Intent Package

| Package | Audience | Contains | Forbids |
|---------|----------|----------|---------|
| **Intent Package** | Operator + orchestrator | Decisions, problems, acceptance, vocabulary, surfaces, non-goals, SSOT | Invented product choices |
| **Spec Package** | Audit agents (per leg) | Structured IDs, expected chains, terms, non-goals, SSOT paths, checklists | **Success narrative**, **shipping narrative**, suite-green praise, "LGTM / done" framing |

Derive Spec Package **from** Intent Package by **stripping** story and keeping
criteria. Do **not** seal intent out (anti-intent briefing is the wrong skill —
that is `review-code`). Do **not** invent Spec IDs not in the Intent Package.

---

## Spec Package skeleton (paste into axis brief)

```markdown
# Spec Package — <slug>

## Decisions (IDs only + short criterion)
| ID | Criterion (checkable) | Expected evidence chain |
|----|----------------------|-------------------------|
| D1 | … | config → code → UI → test |

## Problems (IDs only + expected fix shape)
| ID | Expected fix shape | Surfaces |
|----|-------------------|----------|
| P1 | … | … |

## Acceptance criteria (IDs)
| ID | Checkable criterion |
|----|---------------------|
| A1 | … |

## Non-goals / must-not (negative space)
- …

## Vocabulary terms
| OLD | NEW |
|-----|-----|
| … | … |

## Key SSOT paths
- …

## Surface inventory (names)
- …
```

---

## Strip rules (HARD)

**Remove from agent briefs:**

1. **Success narrative** — "we shipped SM", "suite is green", "just needs a quick look"
2. **Shipping narrative** — release notes, "closed-beta ready", "merge when CI passes" as proof
3. Praise / confidence pressure — "should be fine", "looks complete", confidence % as closure
4. Author story that substitutes for matrix evidence
5. Instructions to **treat green tests alone as RESOLVED**

**Keep:**

1. Decision / problem / acceptance **IDs** and short **checkable** criteria
2. Expected **evidence chains** (multi-hop)
3. **Non-goals** / must-not seeds
4. Vocabulary OLD/NEW and **SSOT paths**
5. Surface inventory names
6. Adversarial stance: hunt counter-evidence and half-migration

---

## Axis brief integration

When filling `{{ASSETS_PATH}}/axis-brief-template.md`:

1. Set `{{INTENT_PACKAGE}}` to the **Spec Package** block (stripped), not raw handoff praise.
2. Optionally attach a one-line source pointer: `Intent sources: <paths>` (paths only).
3. Forbid inventing decisions not in Spec Package IDs.
4. Forbid treating green tests alone as RESOLVED for a decision.

---

## Red flags

- Pasting the whole "celebration" handoff into the agent as proof of delivery
- "Suite green → RESOLVED" in the brief
- Sealing Dn/Pn out "to avoid bias" (wrong skill — use `review-code` for blind patch)
- Inventing Spec IDs the operator never accepted
