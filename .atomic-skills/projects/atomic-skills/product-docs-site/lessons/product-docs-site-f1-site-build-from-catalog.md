---
schemaVersion: "0.1"
plan: product-docs-site
phaseId: F1
initiative: product-docs-site-f1-site-build-from-catalog
status: open
generatedAt: 2026-07-17T16:06:41.000Z
lessons:
  - id: L-F1-001
    statement: "Static generators that join catalog keys into paths need path containment (reject ..) before write."
    corrective: "Always resolve+contain dist writes and validate keys as kebab-case slugs."
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    source: review-code codex F-001
  - id: L-F1-002
    statement: "Public host tables must use PUBLIC_IDE_IDS, not raw Object.keys(IDE_CONFIG)."
    corrective: "Import PUBLIC_IDE_IDS for product surfaces; keep aliases out of docs."
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    source: review-code codex F-002
  - id: L-F1-003
    statement: "HTML-escaping href is not enough — validate URL schemes for user-controlled links."
    corrective: "Allow only http(s) via URL parser; render invalid schemes as text."
    scope: reusable
    appliesTo: []
    status: open
    confidence: 2
    source: review-code codex F-003
---

# Lessons — F1 site build
