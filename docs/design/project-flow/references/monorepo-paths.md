# Referências monorepo — atomic-skills

Package root: `cat ~/.atomic-skills/package-root`

## Process map — deleted

Renderer, detector, schema, sketches, and `process/map.html` are gone.
Canon: `docs/kb/flow.md`. L2: `flow/flow.html` via `scripts/render-flow.js`.
Leftover creation-gate stage `process-map` remaps to `reviews`.

## Project skill

| Artefato | Path |
|----------|------|
| Router monorepo | `skills/core/project.md` |
| Plugin mirror | `~/.grok/plugins/atomic-skills/skills/project/SKILL.md` |
| Day-2 flow | `skills/shared/project-assets/project-flow.md` |

## Creation / gates

| Artefato | Path |
|----------|------|
| Creation stages | `scripts/creation-gates.js` |
| assert stage | `scripts/assert-creation-stage.js` |
| Verify procedure | `skills/shared/project-assets/project-verify.md` |
| Implement | `skills/core/implement.md` |

## Comandos

```bash
PKG_ROOT="$(cat "$HOME/.atomic-skills/package-root")"
node "$PKG_ROOT/scripts/render-flow.js" path/to/flow.json -o path/to/flow.html
node "$PKG_ROOT/scripts/find-missing-flow.js" path/to/plan.md --strict
node "$PKG_ROOT/scripts/serve-flow.js" --up path/to/flow.html
```

## Padrão AJV a copiar (PR1)

`src/app-map/validate.js` + `meta/schemas/app-map.schema.json`
