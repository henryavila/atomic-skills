# Process map — design samples + generator

**Canon:** [`docs/kb/process-map.md`](../../kb/process-map.md)  
**Iron Law P1:** NO PLAN WITHOUT PROCESS MAP  
**Iron Law P2:** MAP IS NOT THE PHASE TREE  
**Iron Law P3:** TWO LAYERS (YAML SoT → HTML view)  
**Iron Law P4:** AUDIENCE IS A LENS  

## Production paths (real plans)

```
.atomic-skills/projects/<project-id>/<plan-slug>/process/process.yaml  # L1
.atomic-skills/projects/<project-id>/<plan-slug>/process/map.html      # L2
```

Created **only** by Atomic Skills during `new plan` / `adopt` (`stage-process-map`), never as an optional afterthought. Titan / any product is just an *instance* of that contract.

## This folder

| Path | Role |
|------|------|
| `fixtures/*.yaml` | **Examples** of L1 (not live plan state) |
| `out/*.html` | Regenerated L2 from fixtures |
| Construction notes | Historical; superseded by `docs/kb/process-map.md` |

## Generate / check

```bash
node scripts/render-process-map.js fixtures/X.yaml -o out/X.html --audience both
node scripts/render-process-map.js --check fixtures/X.yaml out/X.html --audience both
node scripts/find-missing-process-map.js .atomic-skills --strict-html   # live plans
```

## Two layers

1. **L1** — structure authored + ratified at plan creation (objective journey, dual copy).  
2. **L2** — deterministic HTML from L1 + `site/assets/ds.css`. Same inputs → same bytes.

HTML never invents stages. Stages never come from renaming F0/F1 alone.
