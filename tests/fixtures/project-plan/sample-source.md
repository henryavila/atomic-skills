# Sample Plan — Foundation + UI v1

This plan exists to validate the project-plan decompose heuristics. It mirrors the v3-redesign shape but at a fraction of the size so tests stay fast.

The motivation is: a structured markdown plan must decompose deterministically into Plan + N Initiatives + Tasks, with optional exit-gate criteria pulled from fenced YAML blocks.

## Inviolable principles

- **P1 Truth source** — The dump file is the only authoritative source; the live DB is disposable.
- **P2 Determinism** — Every operation is an idempotent script. No LLM call at runtime.
- **P3 Exit gate per phase** — A phase only closes when its criteria are met.

## Glossary

- **Tenant song** — Song owned by a tenant (tenant_id NOT NULL).
- **Collection song** — Shared song from the LouvorJA catalog.
- **Exit gate** — Verifiable criterion that closes a phase.

## F0 — Foundation Repair

Goal: clean the data before any UI work begins.

### T0.1 Migrate dump
### T0.2 Deduplicate songs
### T0.3 Verify schema invariants

```yaml
exit_gate:
  - id: F0-G1
    description: Tag git core-v2 created
    verifier: { kind: shell, command: "git tag | grep core-v2", expectExitCode: 0 }
  - id: F0-G2
    description: Audit query returns 0 duplicates
    verifier:
      kind: query
      sql: SELECT COUNT(*) FROM v_song_duplicates
      expectRowCount: 0
```

## F1 — UI Redesign

Goal: rebuild admin UI atop the freshly repaired data.

### T1.1 Filament Resources
### T1.2 Nuxt routes

```yaml
exit_gate:
  - id: F1-G1
    description: Every Resource passes UI Gate (3 viewports + dark mode + i18n)
    verifier: { kind: manual, description: Visual review per Resource }
```

## F2 — Growth

Goal: extra features that build on F1.

### T2.1 Multi-event planning
### T2.2 TF-IDF theme suggestions

## Open questions

Random notes that don't decompose — should surface as a warning.
