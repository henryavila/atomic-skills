---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 2, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The deploy workflow publishes from `main` with deploy-level permissions granted across the whole workflow and no validation gate before uploading the Pages artifact. That leaves the build/install phase overprivileged and allows a public docs deployment from a commit whose catalog, generated docs, or tests are failing.

## Findings

### F-001 [major] security — .github/workflows/deploy-docs.yml:12-35

**Evidence:**
```yaml
permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages-product-docs
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22.18'
          cache: 'npm'

      - run: npm ci

      - name: Generate static site
        run: npm run generate-site
```

**Claim:** The build job executes dependency install and site generation with `pages: write` and `id-token: write` even though only the deploy job needs those permissions.

**Impact:** A compromised lifecycle script, dependency install, or build step runs with unnecessary deployment/OIDC capability before the artifact is produced, increasing the blast radius to public Pages deployment or any trust policy accepting the workflow OIDC token.

**Recommendation:** Scope permissions per job: give `build` only `contents: read` and grant `pages: write` plus `id-token: write` only on the `deploy` job; also set `actions/checkout` `persist-credentials: false` in `build` unless git credentials are required.

**Confidence:** high

---

### F-002 [major] release-gating — .github/workflows/deploy-docs.yml:32-40

**Evidence:**
```yaml
      - run: npm ci

      - name: Generate static site
        run: npm run generate-site

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: site/dist
```

**Claim:** The deploy path uploads and deploys after `generate-site` without running the catalog/docs validation that enforces the dual-view docs contract.

**Impact:** A direct push or bad merge to `main` can publish the product docs even when `npm test`, `npm run validate-catalog`, `npm run check-docs`, or `npm run check-site` would fail, so public docs can be cut over from an invalid or drifted source state.

**Recommendation:** Add a validation step before artifact upload, preferably `npm run validate-catalog` or at minimum `npm run check-docs` after generation, or trigger deployment only from a successful test/validation workflow via `workflow_run`.

**Confidence:** high

---

## Questions (non-findings)

- .github/workflows/deploy-docs.yml:7 — Should manual `workflow_dispatch` deploy arbitrary branch refs, or should it be constrained to `main` only?

## Out of scope

- DNS/custom-domain flip correctness and GitHub Pages domain reachability.
- Copy/style choices in README, CHANGELOG, and DEPLOY prose.