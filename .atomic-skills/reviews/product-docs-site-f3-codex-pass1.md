---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 1, minor: 1, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
The change introduces a supported generator state where `project/index.html` is absent while the landing page still links to it. It also makes the new Project guide dataset a canonical product surface without validating the dataset shape beyond “is an object,” so malformed required sections can silently publish as empty documentation.

## Findings

### F-001 [major] broken-link — tests/generate-site.test.js:198-217

**Evidence:**
```js
    const files = buildSiteFiles({ catalogData, pkgVersion: '9.9.9' });
    assert.ok(files.has('index.html'));
    assert.ok(files.has('skills/index.html'));
    assert.ok(files.has('skills/demo/index.html'));
    assert.ok(files.has('skills/other/index.html'));
    assert.ok(files.has('skills/init-memory/index.html'));
    assert.ok(files.has('modules/index.html'));
    assert.ok(files.has('hosts/index.html'));
    assert.ok(!files.has('project/index.html'));

    const modules = files.get('modules/index.html');
    assert.ok(modules.includes('Persistent context.'));
    assert.ok(modules.includes('Configurable path'));

    const skillsIndex = files.get('skills/index.html');
    assert.ok(skillsIndex.includes('demo/index.html'));
    assert.ok(skillsIndex.includes('NO TEST WITHOUT EVIDENCE.'));

    const landing = files.get('index.html');
    assert.ok(landing.includes('href="project/index.html"'));
```

**Claim:** `buildSiteFiles` can emit a site with no `project/index.html` while still emitting a landing link to `project/index.html`.

**Impact:** Any build where `projectGuide` is absent or explicitly `null` publishes a user-visible broken Project guide link from the home page, and the same unconditional nav entry can break navigation on generated pages.

**Recommendation:** Either always emit a valid `project/index.html` fallback page, or make the Project nav item and Explore card conditional on `projectGuide`; add a link-integrity assertion for the no-guide build.

**Confidence:** high

---

### F-002 [minor] validation — scripts/generate-site.js:79-83

**Evidence:**
```js
  const data = parse(readFileSync(path, 'utf8'));
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`project-guide.yaml must parse to an object: ${path}`);
  }
  return data;
```

**Claim:** The canonical Project guide dataset is accepted without validating required fields or section shapes.

**Impact:** A typo such as `command_group` instead of `command_groups`, or a missing `entities`/`cannot` section, silently generates an incomplete canonical guide and passes `check-site` because the renderer defaults absent arrays to empty output.

**Recommendation:** Add schema validation for `meta/product/project-guide.yaml` before rendering, requiring the fields used by the page (`title`, `one_liner`, `entities`, `lifecycle_spine`, `can`, `cannot`, `command_groups`) and failing `generate-site --check` on malformed data.

**Confidence:** high

## Questions (non-findings)

- None

## Out of scope

- Visual styling and full redesign of the archived onboarding HTML.