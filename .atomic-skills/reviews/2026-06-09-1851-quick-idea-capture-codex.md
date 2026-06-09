---
date: 2026-06-09T18:51:42Z
topic: quick-idea-capture
artifact: .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md
skill: atomic-skills:review-plan
reviewer: gpt-5-codex
codex_version: codex-cli 0.135.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
framing_delta: +1 (0 dropped, 4 maintained, 1 emerged)
schema_version: "1.0"
---

# Cross-Model Review — quick-idea-capture

Mode: codex (two-pass sealed envelope). Reviewer: gpt-5-codex. Dirty-tree note: artifact fed via sealed stdin under --sandbox read-only; bug #8404 not applicable.

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan leaves core command behavior and verification under-specified. F0 can pass its stated gates without proving the new command is reachable, listed, or install/uninstall-safe. F1 claims promotion through the emergence ladder, but its only verifier covers status marking, not conversion or ladder integration.

Several record-level contracts are also missing: the exact `ideas.md` grammar, status lifecycle, ID rules, and the behavior of the `Analisar` path. These gaps are large enough that two implementers could produce incompatible inbox files and incompatible promotion behavior while still satisfying the current exit gates.

## Findings

### F-001 [major] coverage — .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md:45-67

**Evidence:**
```yaml
goal: Entregar a captura end-to-end — script determinístico de append, o detail
  file com o fork de dois modos e o `idea list`, mais o wiring no router e a
  paridade de install — sem tocar no modelo plan/initiative.
...
verifier:
  kind: shell
  command: node --test tests/idea-add.test.js
  expectExitCode: 0
...
verifier:
  kind: shell
  command: npm run validate-skills
  expectExitCode: 0
```

**Claim:** F0 requires `idea list`, router wiring, and install parity, but its gates only verify `idea-add.js` and generic skill validation.

**Impact:** F0 can be marked complete with a working append script while `/atomic-skills:project idea list` is unreachable, omitted from router dispatch, or missing install/uninstall roundtrip coverage.

**Recommendation:** Add explicit F0 gates for router dispatch/list behavior and install/uninstall parity, for example targeted `tests/project.test.js` assertions plus `node --test tests/install-uninstall-roundtrip.test.js`.

**Confidence:** high

---

### F-002 [major] ambiguity — .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md:101-103

**Evidence:**
```md
Register a project idea in seconds, near-zero token, without it becoming a loose tracked initiative. Capture is a two-mode fork (Analisar / Só salvar) writing to a single human-readable `ideas.md`; promotion into real work is always a separate, ratify-gated step that reuses the emergence ladder. F0 ships the cheap inbox; F1 adds promotion.
```

**Claim:** The plan names an `Analisar` capture path but does not define what analysis produces, what it writes, or how it differs from `Só salvar`.

**Impact:** One implementation could analyze and still append only title/description, another could generate scope/risks, and another could route to emergence behavior; users would see different persisted records under the same command.

**Recommendation:** Specify the `Analisar` contract in F0: required inputs, analysis output fields, whether the same append script writes the record, and the exact restriction that F0 mutates only `ideas.md`.

**Confidence:** high

---

### F-003 [major] ambiguity — .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md:32-40

**Evidence:**
```yaml
glossary:
  - term: ideas.md
    definition: inbox markdown único por projeto que guarda ideias cruas, cada uma
      com uma meta line (id, data, branch, status).
...
  - term: promoção
    definition: passo separado que move uma ideia do inbox para o modelo de
      iniciativa via emergence ladder.
```

**Claim:** The `ideas.md` record format is not specified beyond a loose “meta line”.

**Impact:** `idea-add`, `idea list`, `idea-mark`, and `idea promote` can disagree on ID format, date format, branch source, status enum, duplicate IDs, and how to parse hand-edited markdown, causing failed lookup or accidental mutation of the wrong idea.

**Recommendation:** Define an exact markdown grammar for one idea record, including ID generation, status values, branch/date formats, allowed body text, and malformed/duplicate handling; require parser tests for those cases.

**Confidence:** high

---

### F-004 [major] coverage — .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md:74-90

**Evidence:**
```yaml
goal: Adicionar o verbo idea promote que extrai uma ideia do inbox, roteia pela
  emergence ladder com ratify e marca a ideia como triaged, sem reinventar
  classificação.
...
description: Promoção converte uma ideia em task ou iniciativa via ladder e
  marca a ideia triaged; a suíte de idea-mark passa.
...
verifier:
  kind: shell
  command: node --test tests/idea-mark.test.js
  expectExitCode: 0
```

**Claim:** F1’s gate claims conversion into task or initiative, but the only verifier checks the marking script.

**Impact:** F1 can pass while `idea promote` never extracts an idea, never invokes the ratify gate, never creates a task/initiative, and only flips status to `triaged`.

**Recommendation:** Split F1 verification into separate gates: one for `idea-mark.js`, one for `idea promote` routing through the emergence ladder with ratify, and one fixture-based test proving task and initiative outcomes are created or handed off as specified.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md:103 — Does `Analisar` persist analysis text inside `ideas.md`, or is it only conversational context before the same append operation?
- .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md:74 — When promotion selects “initiative”, is F1 expected to create an initiative file directly or hand off to the existing emergence/new-initiative flow?

## Out of scope

- Dashboard panel behavior in F0/F1.
- New state-schema keys or changes to `src/decompose.js` / `meta/schemas/`.
- Replacing existing `park` / `emerge` commands.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The blind-pass findings stand after applying the external constraints. The constraints strengthen the verification gaps: install/uninstall parity, compatibility checks, and emergence-ladder behavior are already mechanically testable, but the plan’s exit gates do not require those tests.

The remaining risk is that F0 and F1 can be closed with only narrow script tests and generic validation while command dispatch, cross-agent rendering compatibility, install rollback, parser contracts, and promotion-through-ratify behavior remain unproven.

## Findings

### F-001 [major] coverage — .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md:45-67

**Evidence:**
```yaml
goal: Entregar a captura end-to-end — script determinístico de append, o detail
  file com o fork de dois modos e o `idea list`, mais o wiring no router e a
  paridade de install — sem tocar no modelo plan/initiative.
...
verifier:
  kind: shell
  command: node --test tests/idea-add.test.js
  expectExitCode: 0
...
verifier:
  kind: shell
  command: npm run validate-skills
  expectExitCode: 0
```

**Claim:** F0 requires `idea list`, router wiring, and install parity, but its gates only verify `idea-add.js` and generic skill validation.

**Impact:** F0 can be marked complete with a working append script while `/atomic-skills:project idea list` is unreachable, omitted from router dispatch, or missing install/uninstall roundtrip coverage.

**Recommendation:** Add explicit F0 gates for router dispatch/list behavior and install/uninstall parity, including targeted `tests/project.test.js` assertions plus `node --test tests/install-uninstall-roundtrip.test.js`.

**Confidence:** high

---

### F-002 [major] ambiguity — .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md:103

**Evidence:**
```md
Register a project idea in seconds, near-zero token, without it becoming a loose tracked initiative. Capture is a two-mode fork (Analisar / Só salvar) writing to a single human-readable `ideas.md`; promotion into real work is always a separate, ratify-gated step that reuses the emergence ladder. F0 ships the cheap inbox; F1 adds promotion.
```

**Claim:** The plan names an `Analisar` capture path but does not define what analysis produces, what it writes, or how it differs from `Só salvar`.

**Impact:** One implementation could analyze and still append only title/description, another could generate scope/risks, and another could route to emergence behavior; users would see different persisted records under the same command.

**Recommendation:** Specify the `Analisar` contract in F0: required inputs, analysis output fields, whether the same append script writes the record, and the exact restriction that F0 mutates only `ideas.md`.

**Confidence:** high

---

### F-003 [major] ambiguity — .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md:32-40

**Evidence:**
```yaml
glossary:
  - term: ideas.md
    definition: inbox markdown único por projeto que guarda ideias cruas, cada uma
      com uma meta line (id, data, branch, status).
...
  - term: promoção
    definition: passo separado que move uma ideia do inbox para o modelo de
      iniciativa via emergence ladder.
```

**Claim:** The `ideas.md` record format is not specified beyond a loose “meta line”.

**Impact:** `idea-add`, `idea list`, `idea-mark`, and `idea promote` can disagree on ID format, date format, branch source, status enum, duplicate IDs, and how to parse hand-edited markdown, causing failed lookup or accidental mutation of the wrong idea.

**Recommendation:** Define an exact markdown grammar for one idea record, including ID generation, status values, branch/date formats, allowed body text, and malformed/duplicate handling; require parser tests for those cases.

**Confidence:** high

---

### F-004 [major] coverage — .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md:74-90

**Evidence:**
```yaml
goal: Adicionar o verbo idea promote que extrai uma ideia do inbox, roteia pela
  emergence ladder com ratify e marca a ideia como triaged, sem reinventar
  classificação.
...
description: Promoção converte uma ideia em task ou iniciativa via ladder e
  marca a ideia triaged; a suíte de idea-mark passa.
...
verifier:
  kind: shell
  command: node --test tests/idea-mark.test.js
  expectExitCode: 0
```

**Claim:** F1’s gate claims conversion into task or initiative, but the only verifier checks the marking script.

**Impact:** F1 can pass while `idea promote` never extracts an idea, never invokes the ratify gate, never creates a task/initiative, and only flips status to `triaged`.

**Recommendation:** Split F1 verification into separate gates: one for `idea-mark.js`, one for `idea promote` routing through the existing emergence ladder with ratify, and one fixture-based test proving task and initiative outcomes are created or handed off as specified.

**Confidence:** high

---

### F-005 [major] coverage — .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md:61-67

**Evidence:**
```yaml
- id: F0-G2
  description: Validação de skills verde com o novo detail file project-idea.md.
  status: pending
  verifier:
    kind: shell
    command: npm run validate-skills
    expectExitCode: 0
```

**Claim:** F0 introduces a new skill `.md` detail file but does not require the cross-agent hardcoded-tool-name compatibility test.

**Impact:** `project-idea.md` can pass schema validation while hardcoding `Bash`, `Read tool`, or similar host-specific tool names, breaking Gemini/Claude rendering compatibility after install.

**Recommendation:** Add an F0 gate that runs the compatibility coverage for skill markdown, either `node --test tests/compatibility.test.js` or the full `npm test`, and require assertions covering `project-idea.md`.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md:103 — Does `Analisar` persist analysis text inside `ideas.md`, or is it only conversational context before the same append operation?
- .atomic-skills/projects/atomic-skills/quick-idea-capture/plan.md:74 — When promotion selects “initiative”, is F1 expected to create an initiative file directly or hand off to the existing emergence/new-initiative flow?

## Out of scope

- Dashboard panel behavior in F0/F1.
- New state-schema keys or changes to `src/decompose.js` / `meta/schemas/`.
- Automatic promotion of ideas into tasks/initiatives.
- Replacing existing `park` / `emerge` commands.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [major] — same
- F-002-blind → F-002-final [major] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-004-final [major] — same

### Emerged

- F-005-final [major] coverage — emerged: the revealed cross-agent compatibility constraint makes `validate-skills` alone insufficient for a new skill `.md` detail file.
## Fixes applied in this session

All 5 final findings are major (0 blocker/critical). Triage rule ends the sub-flow at 0 blocker+critical, but the major findings materially harden plan verifiability and remove real spec ambiguity, so they were applied to the plan + initiatives:

- **F-001 + F-005** → F0 gained gates F0-G3 (router dispatch + install/uninstall parity via `tests/install-uninstall-roundtrip.test.js` + dispatch grep) and F0-G2 strengthened to run `tests/compatibility.test.js` (cross-agent hardcoded-tool-name guard) alongside validate-skills.
- **F-002** → Capture contract pinned in plan body §5: both modes write via `idea-add.js`; `Analisar` adds optional `scope`/`context` fields + light analysis + clarifying questions; neither mode promotes; F0 mutates only `ideas.md`.
- **F-003** → `ideas.md` record grammar specified in plan body §6 (id `#N` incremental int, date UTC, branch from git, status enum `pending`|`triaged→<target>`, body, duplicate/malformed handling); T-001 acceptance gained parser-contract cases.
- **F-004** → F1 split into F1-G1 (`idea-mark.js`) + F1-G2 (promote routing through the emergence ladder with ratify; fixture test proving extraction + handoff, manual verifier for the interactive ratify leg).

Questions (non-findings) resolved: `Analisar` persists into `ideas.md` (optional fields), not a side file; promotion to "initiative" hands off to the existing emergence/new-initiative flow (no direct file creation).
