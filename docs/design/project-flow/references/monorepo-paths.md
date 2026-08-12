# Referências monorepo — atomic-skills

Package root: `/home/henry/atomic-skills`  
(`cat ~/.atomic-skills/package-root`)

## Process map (legado a evoluir)

| Artefato | Path |
|----------|------|
| KB canônico | `docs/kb/process-map.md` |
| Schema | `meta/schemas/process-map.schema.json` |
| Render CLI | `scripts/render-process-map.js` |
| Render lib | `scripts/lib/render-process-map.js` |
| Detector | `scripts/find-missing-process-map.js` |
| Tests | `tests/render-process-map.test.js`, `tests/find-missing-process-map.test.js` |
| Stage | `skills/shared/project-assets/new-plan/stage-process-map.md` |
| Day-2 | `skills/shared/project-assets/project-process-map.md` |
| Sketches | `docs/design/process-map-sketches/` |
| DS CSS | `site/assets/ds.css` |

## Project skill

| Artefato | Path |
|----------|------|
| Router monorepo | `skills/core/project.md` |
| Plugin mirror | `~/.grok/plugins/atomic-skills/skills/project/SKILL.md` |
| Plugin assets | `~/.grok/plugins/atomic-skills/_assets/project-process-map.md` |

## Creation / gates

| Artefato | Path |
|----------|------|
| Creation stages | `scripts` + status `creation-gates` |
| assert stage | `scripts/assert-creation-stage.js` |
| Verify procedure | `skills/shared/project-assets/project-verify.md` |
| Implement | `skills/core/implement.md` |

## Comandos atuais

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root")"
node "$PKG_ROOT/scripts/render-process-map.js" path/to/process.yaml -o path/to/map.html
node "$PKG_ROOT/scripts/find-missing-process-map.js" path/to/plan.md --strict-html
```

## Alvo (a criar)

```bash
node "$PKG_ROOT/scripts/render-flow.js" path/to/flow.json -o path/to/map.html
node "$PKG_ROOT/scripts/find-missing-flow.js" path/to/plan.md --strict-html
```

## Dogfood neste design pack

`docs/design/project-flow/dogfood/`

## Feature de domínio (referência apenas)

Cópias em `docs/design/project-flow/references/pdti-feature-*.md`  
Plano real da feature continua no arch-legacy até limpeza (`migration.md`).
