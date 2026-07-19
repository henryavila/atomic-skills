# Project onboarding HTML (archive)

**Deprecated as product SSOT:** 2026-07-17.

## Canonical guide

The **canonical** product Project guide is the generated site route:

- **Source dataset:** `meta/product/project-guide.yaml` (entities, lifecycle spine, can/cannot, command groups)
- **Built page:** `site/dist/project/index.html`
- **Public URL (when deployed):** `https://atomic-skills.henryavila.com/project/`

Author and update product copy in the dataset + site generator — not by expanding this monólito or bloating `core.project` in `meta/catalog.yaml`.

## Why this file remains

`index.html` in this directory is a **self-contained offline archive** (pt-BR interactive monólito with inlined CSS/JS). It is still:

1. Opened by `/atomic-skills:project help --html` via the fixed contract path  
   `docs/design/project-onboarding/index.html` (`scripts/compute-help.js` → `HTML_GUIDE_PATH`)
2. Listed in `package.json` `files` so the npm package ships an offline visual guide for maintainers dogfooding without the full site deploy

It is **not** the product SSOT and should not be re-authored as the primary doc surface.

## Package shipping policy

| Artifact | Shipped in npm `files`? | Role |
|----------|-------------------------|------|
| `docs/design/project-onboarding/index.html` | **Yes** | Offline / `help --html` archive |
| `site/dist/**` | No (build output; generated in CI / local `npm run generate-site`) | Canonical multi-page product docs |
| `meta/product/project-guide.yaml` | **Yes** (via `meta/`) | Domain dataset for the site Project page |

If `help --html` is later pointed at the generated site page, update `HTML_GUIDE_PATH` and the `files` list in the same change. Until then, keep this monólito.

## Design history

- Brief (content contract): `html-design-brief.md`
- Guide command plan: `guide-command-plan.md`
- Site design D4: project domain dataset separate from `core.project` — see plan `product-docs-site`
