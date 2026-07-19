---
schemaVersion: "0.1"
plan: product-docs-site
phaseId: F0
initiative: product-docs-site-f0-catalog-v0-3-and-product-block
status: open
generatedAt: 2026-07-17T15:57:11.533Z
lessons:
  - id: L-F0-001
    statement: "Using `in` on skill.entry without an object guard crashes validateCatalog on primitive entries under v0.3 iron_law required path."
    corrective: "Always type-guard entry as non-null plain object before `in` / field access in validator loops."
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    source: review-code codex F-001
  - id: L-F0-002
    statement: "Scaffold/new-skill must emit every required catalog field for the active root version or commits fail after write."
    corrective: "When raising catalog root version requirements, update scaffold-skill defaultFields/buildSkillEntry in the same change."
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    source: review-code codex F-002
  - id: L-F0-003
    statement: "Iron Law extractors that use /m with `$´ can empty-match at EOL and absorb the next H2 as the law line."
    corrective: "Parse Iron Law via index/slice and stop at next ^## ; fail cross-check when catalog has iron_law but body line is missing."
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    source: review-code codex F-003
---

# Lessons — F0 Catalog v0.3

Three major findings from Codex review, all fixed before phase close.
