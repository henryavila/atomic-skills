---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The plan still has executable gates that do not verify the behavior they claim to close. Several phase gates can pass with missing hard admission rules, missing residual artifacts, absent ecosystem disambiguation, or omitted advanced features. The most immediate risk is F0: the plan declares the materialized initiative as authoritative while also recording that the initiative verifier is still inverted.

## Findings

### F-001 [major] contradiction — .atomic-skills/projects/atomic-skills/audit-delivery-hardening/plan.md:249-276

**Evidence:**
```md
| **F0 tasks + verifiers** | Materialized initiative `phases/audit-delivery-hardening-f0-p0-craft-foundation.md` |
```

```md
**Verifier polarity (T-001 / G-F0-1):** absence checks MUST use fail-on-match (`! rg -q '…'` or `rg …; test $? -eq 1` only after inverted exit handling). The pattern `rg … \|\| test $? -eq 1` is **wrong** when matches exist (exits 0 = false green). Initiative F0 still carries the inverted form — fix via `project` / initiative edit, not ignored at implement.
```

**Claim:** F0 declares the materialized initiative as the verifier authority while the same plan states that the authoritative initiative verifier is still inverted, so the active F0 gate is known-bad.

**Impact:** F0 can be implemented and phase-completed through a false-green verifier that still permits forbidden Portuguese/status strings, leaving later phases built on an invalid craft foundation.

**Recommendation:** Patch the materialized F0 initiative verifier before any F0 implementation step, or change the SSOT table so the corrected frontmatter gate is the only authoritative F0 verifier.

**Confidence:** high

---

### F-002 [major] coverage gap — .atomic-skills/projects/atomic-skills/audit-delivery-hardening/plan.md:90-98

**Evidence:**
```yaml
          verifier:
            kind: shell
            command: npm run validate-skills && test -f
              skills/shared/audit-delivery-assets/reaudit-entry.md && rg -n
              'axis-brief-template|reaudit-brief-template|reaudit-entry'
              skills/core/audit-delivery.md && ! rg -q 'Present in
              Portuguese|FECHADO|RESOLVIDO|Reauditoria|Resumo executivo'
              skills/core/audit-delivery.md skills/shared/audit-delivery-assets
            expectExitCode: 0
```

**Claim:** G-F0-1 uses one alternation grep for three required body references, so the gate passes if only one of `axis-brief-template`, `reaudit-brief-template`, or `reaudit-entry` is wired.

**Impact:** F0 can close with orphaned axis or reaudit brief templates, breaking the promised real reaudit entry path and leaving later evidence phases dependent on assets the skill body never loads.

**Recommendation:** Replace the alternation with separate required checks for each body reference and keep the existing `test -f` check for `reaudit-entry.md`.

**Confidence:** high

---

### F-003 [major] coverage gap — .atomic-skills/projects/atomic-skills/audit-delivery-hardening/plan.md:119-132

**Evidence:**
```yaml
      doneWhen: intent-package, residual-hunt-protocol, verdict-gate assets exist and
        body encodes product+residual default and Accept Record rules.
```

```yaml
            command: test -f skills/shared/audit-delivery-assets/intent-package.md &&
              test -f skills/shared/audit-delivery-assets/residual-hunt-protocol.md
              && test -f skills/shared/audit-delivery-assets/verdict-gate.md && rg
              -q 'product,residual|product \+ residual' skills/core/audit-delivery.md
```

**Claim:** F1’s gate verifies asset existence and a default-axis string, but it does not verify the hard Intent Package admission gate, Accept Record fields, residual opt-out cap, or CRITICAL-never-CLOSED rule.

**Impact:** The phase can close without the mechanisms that prevent false-CLOSED delivery audits, so missing acceptance/vocabulary or unaccepted high-risk residuals can still be reported as CLOSED.

**Recommendation:** Add explicit gate checks or tests for Intent Package HARD-GATE admission, Accept Record requirements, residual opt-out capped at PARTIAL, and CRITICAL residual prohibition from CLOSED.

**Confidence:** high

---

### F-004 [major] coverage gap — .atomic-skills/projects/atomic-skills/audit-delivery-hardening/plan.md:153-168

**Evidence:**
```yaml
      doneWhen: matrices and spec-package assets exist; --depth in body+catalog;
        audit-delivery referenced from sibling catalog/implement prose.
```

```yaml
              skills/core/audit-delivery.md meta/catalog.yaml && rg -q
              'audit-delivery' skills/core/implement.md meta/catalog.yaml
```

**Claim:** F2 requires sibling catalog and implement disambiguation, but the verifier searches both files in a single `rg`, so any existing `audit-delivery` mention in either file satisfies the check.

**Impact:** The phase can pass without updating `skills/core/implement.md` or without adding catalog `when_not` disambiguation, leaving operators exposed to the wrong-skill collision the phase is meant to fix.

**Recommendation:** Split the verifier into separate checks requiring the expected audit-delivery disambiguation in `meta/catalog.yaml` and the soft implement suggestion in `skills/core/implement.md`.

**Confidence:** high

---

### F-005 [major] coverage gap — .atomic-skills/projects/atomic-skills/audit-delivery-hardening/plan.md:174-201

**Evidence:**
```yaml
    goal: Prevent skill rot — thin resident spine, complete lazy assets
      (checklists/report/ledger), INVESTIGATOR fallback, static test that every
      asset is reachable from the body.
```

```yaml
      doneWhen: validate-skills + asset wire test green; report and product/residual
        checklists exist.
```

```yaml
            command: npm run validate-skills && node --test
              tests/audit-delivery-assets.test.js && test -f
              skills/shared/audit-delivery-assets/report-template.md && test -f
              skills/shared/audit-delivery-assets/checklists/product.md
```

**Claim:** F3 promises product and residual checklists plus a ledger, but the gate only checks `report-template.md` and `checklists/product.md`.

**Impact:** F3 can close with no residual checklist and no ledger asset, leaving the residual protocol without its promised lazy checklist/report support and making the asset reachability test unable to catch absent assets.

**Recommendation:** Add concrete required filenames for the residual checklist and ledger, then include `test -f` checks for both in G-F3-1.

**Confidence:** high

## Questions (non-findings)

- None

## Out of scope

- Items explicitly listed as non-goals, including classic RTM databases, 5x5 risk matrices, coverage quotas, and hard-requiring audit-delivery on automate finalize / phase-done.
---

## Local triage (both mode, post-pass1)

| Codex # | Disposition | Action |
|---------|-------------|--------|
| F-001 | accepted | Initiative T-001 verifier still inverted — **initiative HARD-GATE**: fix via project/initiative edit before implement; plan documents known-bad SSOT risk |
| F-002 | applied | G-F0-1 now requires three separate `rg -q` for axis-brief, reaudit-brief, reaudit-entry |
| F-003 | applied | G-F1-1 greps Accept Record, CRITICAL, PARTIAL/cap, admission HARD-GATE tokens |
| F-004 | applied | Split implement vs catalog `audit-delivery` checks; catalog when_not/intentVsDelivered tokens |
| F-005 | applied | G-F3-1 requires residual checklist + findings-ledger + INVESTIGATOR fallback prose |

Pass 2 (informed): skipped after plan gate rewrites — re-run `review-plan --mode=codex` if needed for second pass.

**allow-dirty:** dirty tree (WIP skill + plan) — invoked with skip-git-repo-check; operator accepted dirty review risk.
