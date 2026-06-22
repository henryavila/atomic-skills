---
date: 2026-06-17T15:36:00Z
topic: reversible-installer
artifact: .atomic-skills/projects/atomic-skills/reversible-installer/plan.md
skill: review-plan
reviewer: gpt-5-codex
codex_version: codex-cli 0.139.0
final_verdict: needs_changes
counts_final: {blocker: 0, critical: 2, major: 4, minor: 0, nit: 0}
counts_blind: {blocker: 0, critical: 2, major: 3, minor: 0, nit: 0}
framing_delta: 0d/5=/1+
schema_version: "1.0"
---

# Cross-Model Review — reversible-installer

## Pass 1 (blind)

---
verdict: needs_changes
counts: {blocker: 0, critical: 2, major: 3, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan has implementability and coverage gaps around the reversible contract. The largest risks are that new verification targets are placed outside the fixed `npm test` suite, and the final rewire replaces the legacy installer without specifying how existing installations acquire the journal/before-state needed for safe uninstall.

Several core mechanisms are also underspecified: the built-in effect catalog is inconsistent, legacy pruning lacks a concrete ownership-proof source, and final runtime layers are not required to enumerate or test every persistent mutation they introduce.

## Findings

### F-001 [critical] coverage — .atomic-skills/projects/atomic-skills/reversible-installer/plan.md:63-65

**Evidence:**
```md
            kind: test
            runner: node --test
            pattern: test/kernel/reconciler.test.js
```

**Claim:** The phase gates put new tests under `test/...`, but the externally fixed suite runs `node --test tests/*.test.js`, so the kernel/provider tests can be outside the canonical suite.

**Impact:** F3 can pass `npm test` while missing the new kernel/provider regressions, leaving the reversible installer unprotected by the required project test entry point.

**Recommendation:** Put the new tests in files matched by `tests/*.test.js`, or change `npm test` and every verifier pattern to include the chosen nested test locations before F0/F2/F3 can exit.

**Confidence:** high

---

### F-002 [critical] coverage — .atomic-skills/projects/atomic-skills/reversible-installer/plan.md:134-136

**Evidence:**
```md
    goal: religar o atomic-skills sobre o kernel (aiDeck, hooks, auto-update como
      runtime layers), substituir o install/uninstall legados pelo driver, e
      provar a paridade com o round-trip e a suíte completa.
```

**Claim:** The plan replaces legacy install/uninstall without a migration/adoption task for existing manifests and installed files, but the new uninstall requires journaled before-state that legacy installs do not have.

**Impact:** Existing users can end up with files the new driver cannot prove ownership for, causing either orphaned installed files or unsafe deletion that violates the hard reversal rule.

**Recommendation:** Add a prerequisite migration/adoption task before F3 that converts existing manifest state into journal ownership records or explicitly marks unmanaged entries as non-removable, with update/uninstall fixtures for a pre-kernel installation.

**Confidence:** high

---

### F-003 [major] contradiction — .atomic-skills/projects/atomic-skills/reversible-installer/plan.md:50-52

**Evidence:**
```md
    goal: estabelecer o contrato fechado de efeito (apply/revert/before-state) + o
      journal + o efeito de reconciliação de arquivos portado da lógica 3-hash
      atual, sem tocar no instalador legado.
```

**Claim:** `reconcileFileSet` is described as an effect while P4 says the kernel has 3 built-in effect types and F1 allocates those three to non-file effects, so the effect registry contract is ambiguous.

**Impact:** Implementers can build incompatible registries: one with three built-ins excluding file reconciliation, another with four including it, breaking runtime-layer registration and fixture expectations.

**Recommendation:** Define the built-in catalog explicitly in the plan, either as four effects including `reconcileFileSet` or as three non-file effects plus a separate non-registered reconciler primitive.

**Confidence:** high

---

### F-004 [major] viability — .atomic-skills/projects/atomic-skills/reversible-installer/plan.md:98-99

**Evidence:**
```md
    summary: Os 3 efeitos não-arquivo (json-merge/refcount/legacy-prune) com
      before-state + matriz adversária no round-trip.
```

**Claim:** `legacy-prune` is planned as a removal effect, but the plan does not define what counts as proof that the installer created a legacy path.

**Impact:** The implementation must either refuse to prune legacy files, leaving stale installer artifacts, or infer ownership from weak signals and risk deleting user-created files.

**Recommendation:** Specify the only accepted ownership evidence for legacy pruning, require no-delete fallback when evidence is absent, and add fixtures for user files that mimic legacy paths or metadata.

**Confidence:** high

---

### F-005 [major] coverage — .atomic-skills/projects/atomic-skills/reversible-installer/plan.md:131-136

**Evidence:**
```md
  - id: F3
    slug: reversible-installer-f3-big-bang-rewire-e-paridade
    title: Big-bang rewire e paridade
    goal: religar o atomic-skills sobre o kernel (aiDeck, hooks, auto-update como
      runtime layers), substituir o install/uninstall legados pelo driver, e
```

**Claim:** F3 wires aiDeck, hooks, and auto-update as runtime layers, but no phase requires an inventory of their persistent mutations or per-layer reversible fixtures.

**Impact:** A runtime layer can mutate settings, hooks, generated assets, or update state outside the journal while the generic round-trip still passes for narrower fixtures.

**Recommendation:** Add a F3 gate that enumerates every persistent mutation emitted by each runtime layer and proves each one has a matching registered effect, revert fixture, or documented allowlist entry.

**Confidence:** medium

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/reversible-installer/plan.md:171 — Is “consumível por qualquer projeto via dependência + config” intended as a current acceptance target or future direction outside this work?

## Out of scope

- Extraction into a separate npm package.
- Changes to aiDeck or dashboard format.
## Pass 2 (informed)

---
verdict: needs_changes
counts: {blocker: 0, critical: 2, major: 4, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: informed
schema_version: "1.0"
---

## Summary
The plan still has blocking coverage and migration risks under the revealed constraints. The fixed `npm test` entry does not execute the planned nested test files, and the hard byte-for-byte install/uninstall rule is not covered for users upgrading from the legacy manifest into the new journal model.

The informed pass also confirms several design ambiguities: the effect catalog is inconsistent, runtime-layer mutations are not required to be inventoried, legacy pruning conflicts with the stated ownership-proof rule, and the plan’s “dependency + config” extraction target contradicts the non-goal that no separate npm package extraction occurs in this work.

## Findings

### F-001 [critical] coverage — .atomic-skills/projects/atomic-skills/reversible-installer/plan.md:63-65

**Evidence:**
```yaml
            kind: test
            runner: node --test
            pattern: test/kernel/reconciler.test.js
```

**Claim:** The plan places new verifier tests under `test/...`, but the externally fixed suite entry is `node --test tests/*.test.js`, so those tests are outside the canonical `npm test` suite.

**Impact:** F3 can satisfy its “suíte completa” gate with `npm test` while kernel/provider regressions are not run, leaving the reversible installer’s core behavior unprotected by the project’s required test entry point.

**Recommendation:** Put all new kernel/provider tests in files matched by `tests/*.test.js`, or first change `package.json` and every affected verifier to use the nested test layout.

**Confidence:** high

---

### F-002 [critical] coverage — .atomic-skills/projects/atomic-skills/reversible-installer/plan.md:38-39

**Evidence:**
```yaml
  - term: Journal
    definition: ledger de efeitos aplicados + before-state; extensão do manifesto atual.
```

**Claim:** The plan introduces a journal with before-state as an extension of the current manifest but has no migration/adoption task for existing installations whose manifests lack the new journal records.

**Impact:** Existing users can upgrade to the new driver with installed files and non-file mutations that the new uninstall cannot prove or revert byte-for-byte, causing either orphaned files or unsafe deletion contrary to the hard install/uninstall parity rule.

**Recommendation:** Add a pre-F3 migration/adoption task that converts legacy manifest state into journal ownership records where sound, marks unverifiable entries as unmanaged, and adds update/uninstall fixtures starting from a pre-kernel installation.

**Confidence:** high

---

### F-003 [major] contradiction — .atomic-skills/projects/atomic-skills/reversible-installer/plan.md:30-33

**Evidence:**
```yaml
  - id: P4
    title: Catálogo de efeitos fechado mas extensível
    body: O kernel traz 3 tipos built-in e expõe um contrato de registro; um runtime
      layer adiciona um tipo novo com seu par apply/revert + fixtures, sem
```

**Claim:** The built-in effect catalog is ambiguous because P4 says the kernel has three built-in types, while F0 describes `reconcileFileSet` as an effect and F1 allocates the three named built-ins to non-file mutations.

**Impact:** Implementers can build incompatible registries: one treating file reconciliation as a registered built-in effect and another treating it as a separate reconciler primitive, breaking runtime-layer registration and fixture expectations.

**Recommendation:** Define the built-in catalog explicitly as either four registered effects including `reconcileFileSet`, or three non-file effects plus a separate non-registered file reconciler primitive.

**Confidence:** high

---

### F-004 [major] contradiction — .atomic-skills/projects/atomic-skills/reversible-installer/plan.md:25-29

**Evidence:**
```yaml
  - id: P3
    title: Sem prova de propriedade, não apaga
    body: Qualquer remoção (órfão, legado, entrada de settings) só ocorre sobre algo
      que o efeito provou ter criado. Ausência de prova é um não-apague. É a
      defesa central de segurança de dados.
```

**Claim:** The plan requires proof that an effect created anything it removes, but the planned legacy-prune behavior is tied to legacy-path/frontmatter safelisting, which identifies artifact shape and not installer-created ownership.

**Impact:** A user-created file that mimics an atomic-skills frontmatter signature at a legacy path can be deleted, or the implementation must refuse pruning and leave stale legacy artifacts, depending on which developer resolves the contradiction.

**Recommendation:** Specify the only accepted ownership evidence for legacy pruning; if frontmatter safelisting remains the mechanism, document it as an explicit allowlist exception to P3 and add adversarial fixtures for user files with matching names/frontmatter.

**Confidence:** high

---

### F-005 [major] coverage — .atomic-skills/projects/atomic-skills/reversible-installer/plan.md:134-136

**Evidence:**
```yaml
    goal: religar o atomic-skills sobre o kernel (aiDeck, hooks, auto-update como
      runtime layers), substituir o install/uninstall legados pelo driver, e
      provar a paridade com o round-trip e a suíte completa.
```

**Claim:** F3 wires aiDeck, hooks, and auto-update as runtime layers, but no gate requires an inventory proving every persistent mutation they introduce has a registered effect, revert fixture, or documented allowlist entry.

**Impact:** A runtime layer can add or modify settings, hook scripts, shared artifacts, or update state outside the journal while the round-trip test still passes for narrower fixtures.

**Recommendation:** Add a F3 gate that enumerates every persistent mutation emitted by each runtime layer and maps each one to a registered reversible effect, a byte-for-byte round-trip fixture, or an explicit allowlist entry.

**Confidence:** medium

---

### F-006 [major] scope — .atomic-skills/projects/atomic-skills/reversible-installer/plan.md:171

**Evidence:**
```md
Extrair o instalador do atomic-skills num kernel genérico de sincronização reversível de arquivos templados, consumível por qualquer projeto via dependência + config. Uninstall é propriedade estrutural do kernel (replay reverso do journal + reconcile do file set para vazio), não código que cada consumidor escreve. Fonte-de-verdade: `design.md` desta pasta (aprovado pelo critic).
```

**Claim:** The plan states a target of extraction into a generic kernel consumable by any project via dependency and config, contradicting the external non-goal that this work does not extract the installer into a separate npm package.

**Impact:** Implementation can spend scope on packaging, dependency boundaries, or cross-project consumption APIs that are explicitly outside this work, delaying the actual reversible installer rewire.

**Recommendation:** Rewrite the context and phase goals to limit this work to an in-repo reusable kernel/API, and move separate-package dependency consumption to a future-plan note outside the acceptance criteria.

**Confidence:** high

## Questions (non-findings)

- _(none)_

## Out of scope

- Generic package-manager dependency/version resolution.
- Multi-machine transactional rollback.
- aiDeck or dashboard format changes.

## Pass 2 reconciliation

### Dropped from blind pass

- _(none)_

### Maintained

- F-001-blind → F-001-final [critical] — same
- F-002-blind → F-002-final [critical] — same
- F-003-blind → F-003-final [major] — same
- F-004-blind → F-004-final [major] — refined to account for the external frontmatter-safelist constraint while preserving the ownership-proof contradiction
- F-005-blind → F-005-final [major] — same

### Emerged

- F-006-final [major] scope — emerged: the external non-goal forbids separate npm package extraction, while the plan says the kernel is to be consumed by any project via dependency + config.
## Fixes applied in this session

<!-- Append-only. Triage step adds lines here as user approves/skips. -->

- F-001 [critical] applied — F0-T-001: amplia glob do `npm test` para `tests/**/*.test.js test/**/*.test.js`.
- F-002 [critical] applied — F3-T-005 (nova tarefa, ratificada): migração de installs legados → ownership do journal; T-003 blockedBy T-005.
- F-003 [major] applied — P4 fixado em 4 efeitos built-in registrados (reconcileFileSet + json-merge + refcount + legacy-prune).
- F-004 [major] applied — P3 documenta a safelist de frontmatter como exceção-allowlist única + fixture adversária (F1-T-004).
- F-005 [major] applied — F3 G-3 (novo gate): inventário de mutações persistentes por runtime layer.
- F-006 [major] applied — Context escopado a kernel/API in-repo; consumo cross-project = futuro.
