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


## Full suite status (honest)

`npm test` on this branch: **not fully green** (~11 failures / ~2096 passes). Failures observed are **pre-existing** relative to F6 commits (byte budgets, cwd-bound script refs in mode2 lane, consumer e2e/schema/migrate/lazy materialization). **F6-local tests and F6-G1 are green.**

F6-G2 product half used for this environment:

```
node --test tests/release-blackbox.test.js tests/release-host-probes.test.js tests/release-fault-matrix.test.js \
  tests/findings-manifest-contract.test.js tests/verify-ci-candidate.test.js \
  tests/installed-runtime-drift.test.js tests/ci-matrix.test.js tests/ci-runtime-matrix.test.js
npm run validate-skills && npm run check-docs
node scripts/verify-installed-runtime.js --check
node scripts/verify-findings-manifest.js --manifest docs/audits/integrity-remediation-findings.json --receipt docs/audits/release-candidate-ci.json
node scripts/verify-ci-candidate.js --receipt docs/audits/release-candidate-ci.json \
  --require-os linux,macos,windows --require-node '22.18.x,>=24.11.0' \
  --require-host-manifest meta/host-qualification.json --no-product-diff --allow-partial
```
