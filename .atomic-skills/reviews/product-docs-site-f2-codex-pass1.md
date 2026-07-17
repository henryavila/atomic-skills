---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 0, minor: 2, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The README renderer can produce malformed or empty generated README sections from catalog states that are not rejected inside the rendering path. Both issues affect generated package-facing documentation, not the site HTML.

## Findings

### F-001 [minor] markdown_generation — scripts/lib/render-readme.js:129-147

**Evidence:**
```js
  const safeDocs = safeHttpUrl(docsUrlRaw);
  const docsLine = safeDocs
    ? `**Docs:** [${safeDocs}](${safeDocs})`
    : `**Docs:** \`${docsUrlRaw}\``;

  const notBullets = whatIsNot.map((item) => `- ${item.trim()}`).join('\n');
  return [
    '## What it is',
    '',
    whatIs,
    '',
    '## What it is not',
    '',
    notBullets,
    '',
    '## Install',
    '',
    '```bash',
    installPrimary,
```

**Claim:** Catalog product strings are interpolated into Markdown syntax without escaping or dynamic fence handling.

**Impact:** A catalog value containing backticks, a closing code fence, or Markdown line breaks can corrupt the generated README while still being a non-empty string, causing broken public package documentation that `generate-readme` will reproduce as canonical output.

**Recommendation:** Add Markdown-safe render helpers for inline code, links, list items, and fenced code blocks; size the install fence longer than any backtick run or reject multiline/fenced install commands in product validation.

**Confidence:** high

---

### F-002 [minor] validation — scripts/lib/render-readme.js:98-99

**Evidence:**
```js
export function renderProductEnvelope(product) {
  if (product == null) return '';
```

**Claim:** Missing `catalog.product` silently renders an empty product block instead of failing in the README renderer.

**Impact:** Running `generate-readme` or `generate-docs` directly after an accidental product-block removal can erase the README’s top product/install/docs section before any separate validation step reports the catalog error.

**Recommendation:** Make `renderReadme` require `catalog.product` for real catalog rendering, and update unit fixtures to pass a minimal product block or use an explicit test-only option for absent product data.

**Confidence:** medium

## Questions (non-findings)

- None

## Out of scope

- Site HTML/dist output and deployment behavior.