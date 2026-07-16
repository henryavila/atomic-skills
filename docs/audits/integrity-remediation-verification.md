# Integrity remediation — F6 release verification

**candidateSha:** `170d8d743aa40e5e76b5b4170b61402a3b1753bc`  
**generatedAt:** 2026-07-16T17:53:38.687Z
**status:** partial (Linux local product gates; multi-OS CI environment-limited)

## Gates

| Gate | Local result | Notes |
|------|--------------|-------|
| F6-G1 blackbox + host probes + fault matrix | PASS | Linux |
| F6-G2 product half (`npm test`, validate-skills, check-docs, runtime, findings) | PASS when suite green | This document |
| F6-G2 multi-OS half | PARTIAL / FAIL without `--allow-partial` | macos/windows not run here |

## Host tiers

All PUBLIC_IDE_ID hosts remain **layout-only** (`supportDeclared: false`) until operational discovery/load/invoke receipts exist. See `docs/audits/host-contract-receipt.json`.

## Findings

Canonical inventory: `docs/audits/integrity-remediation-findings.json`  
Source-qualified exact set: installer (13) + project-implement (22) + codex-review (6) = **41**.

## Environment limit

See `/tmp/grok-goal-4a02531e9a98/implementer/f6-env-limit.log`.
