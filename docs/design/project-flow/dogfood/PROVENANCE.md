# Provenance — dogfood fixtures

| File | Origin | Role |
|------|--------|------|
| `fluxo-sugestao.json` | arch-legacy plan `sugestao-necessidade-pdti` `docs/` | Canonical **graph** prototype (N2 interface flow). **PR1:** enveloped to schema 1.0 (`schemaVersion` + lifecycle + `graph{entry,nodes}`). |
| `fluxo-completo.html` | same | Model-driven viewer (Sequence + Fluxo + Estados) — **source to productize** |
| `fluxos-bpmn-interface.html` | same | Non-canonical hand Mermaid (Partes A/B/C) — do not productize as SoT |
| `fluxos-usuario-sistema.html` | same | Non-canonical N1 journey — ideas only |
| `process.yaml` | same `process/` | Atomic Skills process-map L1 for this plan (macro journey) |
| `process-map.html` | same | Generated L2 card UI (edges not drawn) |
| `minimal-xor.json` | authored in this repo (PR1) | Generic fixture: 2 actors, 1 xor, **no** status 10/1/11 |

**Source worktree (ephemeral / will be removed from feature repo):**  
`/home/henry/arch-legacy/.worktrees/sugestao-necessidade-pdti/.atomic-skills/projects/arch-legacy/sugestao-necessidade-pdti/`

**Copied into atomic-skills:** 2026-08-12  
**Intent:** product `project flow` lives here; dogfood must not depend on arch-legacy paths.

**Domain of the fixture:** PDTI suggestion (GETIN → líder). Status codes 10/1/11 are **instance data**, not product rules.
