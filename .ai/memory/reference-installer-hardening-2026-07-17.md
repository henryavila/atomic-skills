---
name: reference-installer-hardening-2026-07-17
description: Pointer to the 2026-07-17 installer audit and P0+P1 hardening plan for the next session.
metadata:
  type: reference
---

# Installer hardening — handoff 2026-07-17

## Canonical docs (in repo)

| Doc | Path |
|-----|------|
| **Audit** (findings F-001…F-014) | `docs/audits/installer-audit-2026-07-17.md` |
| **Plan** (P0 + P1 only) | `docs/plans/installer-hardening-p0-p1.md` |
| Prior audit | `docs/audits/installer-audit-2026-07-10.md` |

## Context commits

- `758b42c` — modules concept removed; init-memory core
- `131a345` — adopt unowned desired (GREENFIELD_CONFLICT fix; tradeoff = F-004)

## P0 (do first)

1. **F-001** Incomplete TX recovery (engine + CLI repair)
2. **F-002** Revert dropped effects on IDE shrink (auto-update residue)
3. **F-003** Grok host/isolation cleanup when grok leaves ides
4. Full-path fault E2E tests

## P1 (after P0)

F-004 harden adopt · F-005 versioned registry · F-006 atomic manifest · F-007 stage path-safety · F-008 SIGINT · F-009 publishRuntimeAndRegister always

## Start command for next session

> Implement `docs/plans/installer-hardening-p0-p1.md` using findings in `docs/audits/installer-audit-2026-07-17.md`. Prefer P0-C (Grok shrink) first if upstream for F-001/F-002 is blocked.
