# Migração — process-map → project flow + limpeza arch-legacy

## A. Neste monorepo (atomic-skills)

### Fase 0 — Handoff (feito)

- [x] `docs/design/project-flow/**` com design, análise, dogfood, referências PDTI
- [ ] Design ratificado pelo operador (se exigir brainstorm formal, rodar gates)

### Fase 1 — Dual-read

- `find-missing-flow.js` (ou extend process detector):
  - OK se `flow/flow.json` válido + HTML sha sync **ou**
  - OK se legado `process/process.yaml` + map.html (WARN se só legado após cutoff date)
- `project process` → tenta flow path; fallback process-map render

### Fase 2 — Write path só flow

- `new plan` / `adopt` stage escreve `flow/flow.json` (+ render)
- Opcional: ainda emitir `process.yaml` projetado de `journey` por 1 release (compat leitores externos) — **default: não**, para não dual-write

### Fase 3 — Remover process-map write

- Deprecate `render-process-map` como caminho de criação (manter lib se migrator precisar)
- KB: `flow.md` canônico; `process-map.md` status superseded
- Router: Iron Law texto atualizado

### Migrator one-shot

```bash
node scripts/migrate-process-map-to-flow.js <plan-dir>
# process/process.yaml → flow/flow.json (lifecycle + journey only)
# re-render flow/map.html
```

---

## B. Repo da feature (arch-legacy worktree)

**Origem:**

```
.worktrees/sugestao-necessidade-pdti/.atomic-skills/projects/arch-legacy/sugestao-necessidade-pdti/
  docs/fluxo-*.html|json
  process/*
```

**Depois do produto AS existir:**

1. Remover `docs/fluxo-completo.html`, `fluxo-sugestao.json`, `fluxos-bpmn-interface.html`, `fluxos-usuario-sistema.html` do plan (já copiados para dogfood AS).
2. Opcional: gerar `flow/` no plan via migrator se o plano AS da feature ainda precisar de artefato local.
3. Manter `process/` até o plano ser migrado ou arquivado.
4. Não manter segunda fonte de verdade do grafo no arch-legacy.

**Não fazer agora (nesta sessão de handoff):** apagar no arch-legacy antes do commit em atomic-skills estar seguro. Ordem: **commit AS → implementar → limpar feature repo**.

---

## C. Checklist de “sumiu do repo da feature”

- [ ] Handoff AS commitado e no branch de trabalho
- [ ] PR2 render no mínimo mergeado ou utilizável localmente
- [ ] Fixture dogfood cobre o JSON
- [ ] `rm` dos arquivos `docs/fluxo*` no plan PDTI + nota no plan.md apontando para AS
- [ ] Nenhum link de CI/docs da feature apontando para o HTML local como canônico de produto AS
