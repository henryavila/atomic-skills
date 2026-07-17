# Product docs site — deploy

Canonical public URL: **https://atomic-skills.henryavila.com**

## What ships

Static HTML/CSS under `site/dist/`, produced by:

```bash
npm run generate-site
```

Sources: `meta/catalog.yaml`, `meta/product/*`, `site/assets/ds.css`, and host labels from `src/config.js`. Skill prompt bodies under `skills/` are **not** published on the product site.

## Git-driven deploy (GitHub Pages)

Workflow: [`.github/workflows/deploy-docs.yml`](../.github/workflows/deploy-docs.yml)

| Trigger | Behavior |
|---------|----------|
| Push to `main` | Build `site/dist` → upload Pages artifact → deploy |
| `workflow_dispatch` | Same, on demand |

No deploy secrets live in the repo. Auth is the workflow `GITHUB_TOKEN` with `pages: write` and OIDC (`id-token: write`).

### One-time GitHub setup

1. Repo **Settings → Pages**: Source = **GitHub Actions** (not "Deploy from a branch").
2. Custom domain: set `atomic-skills.henryavila.com` and enable HTTPS once DNS is ready.
3. DNS: CNAME (or ALIAS) for `atomic-skills` → the GitHub Pages target for this repo (e.g. `<user>.github.io`).

If DNS is not ready yet, the site still deploys to the default `*.github.io` Pages URL; the custom domain is configuration only.

## Offline / local

No DNS or network is required after a local build:

```bash
npm run generate-site
open site/dist/index.html   # or any browser
```

CI also keeps dist in sync via `npm run check-docs` / `npm run check-site`.

## Out of scope for this workflow

- npm package publish (see `publish.yml`)
- Engineering archive MD (`docs/kb/`, `docs/design/`, plans, audits) — not on the product site
- Hand-editing remote HTML
