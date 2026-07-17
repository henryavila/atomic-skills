---
verdict: needs_changes
counts: {blocker: 0, critical: 1, major: 2, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The generator trusts catalog-derived values in places that affect filesystem paths, public host publication, and executable link targets. These are source-level defects: a crafted catalog key can write outside `site/dist`, the hosts page publishes every configured adapter instead of the public host set, and `docs_url` can become a `javascript:` link in generated public HTML.

## Findings

### F-001 [critical] path traversal — scripts/generate-site.js:165-168

**Evidence:**
```js
  for (const [relPath, content] of expected) {
    const full = join(distDir, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
```

**Claim:** `writeDist` joins untrusted generated relative paths to `distDir` without normalizing and enforcing that the resolved path stays under `distDir`.

**Impact:** A catalog skill key containing `../` can make `buildSiteFiles` produce a path like `skills/../../../docs/design/project-onboarding/index.html`, causing `npm run generate-site` to create or overwrite files outside `site/dist`.

**Recommendation:** Validate catalog skill/module keys as URL/path-safe slugs before rendering and make `writeDist` resolve each target path, reject any path outside `resolve(distDir)`, and reject absolute paths or path segments equal to `..`.

**Confidence:** high

---

### F-002 [major] incorrect public host surface — scripts/lib/render-site.js:406-418

**Evidence:**
```js
  const rows = Object.entries(ideConfig)
    .map(([id, ide]) => {
      const support = supportLabel(id);
      const badgeClass = support === 'Tested' ? 'badge-tested' : 'badge-theoretical';
      const format = FORMAT_LABELS[ide.format] || ide.format;
      return `<tr>
          <td>${escapeHtml(ide.name)}</td>
          <td><code>${escapeHtml(id)}</code></td>
          <td><code>${escapeHtml(ide.dir)}</code></td>
          <td>${escapeHtml(format)}</td>
          <td><span class="badge ${badgeClass}">${escapeHtml(support)}</span></td>
        </tr>`;
```

**Claim:** The hosts page renders every `IDE_CONFIG` entry instead of filtering to the public host IDs.

**Impact:** Internal or alias adapters such as `gemini-commands` are published as standalone product-facing hosts, so the generated support table misstates the supported host surface and duplicates Gemini as a separate command profile.

**Recommendation:** Import and use the public host ID list from `src/config.js`, or pass an explicit ordered list of public host IDs into `renderHostsPage` and render only those IDs.

**Confidence:** high

---

### F-003 [major] unsafe URL scheme — scripts/lib/render-site.js:206-211

**Evidence:**
```js
    ${
      docsUrl
        ? `<section class="section">
      <h2>Canonical URL</h2>
      <p class="prose"><a href="${escapeHtml(docsUrl)}">${escapeHtml(docsUrl)}</a></p>
    </section>`
```

**Claim:** `product.docs_url` is inserted into an `href` with HTML escaping but without URL scheme validation.

**Impact:** A catalog value like `javascript:alert(document.domain)` produces a clickable executable link in the public static site; there is no generated CSP or protocol allowlist preventing that navigation.

**Recommendation:** Parse `docs_url` with `new URL`, allow only `https:` and `http:`, and fail generation or render plain text for any other scheme.

**Confidence:** high

---

## Questions (non-findings)

- None.

## Out of scope

- Generated `site/dist` HTML content.
- CSS visual/style-only issues.