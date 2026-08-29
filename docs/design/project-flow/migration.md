# Migração — descarte process-map → project flow

Operador 2026-08-12: process-map **descartado por completo**. Não há dual-read de produto. `process.yaml` **não** cumpre o detector de flow. Iron Law nova (PR4): **NO IMPLEMENT WITHOUT VALIDATED FLOW** — não “no plan without flow”.

---

## A. Neste monorepo (atomic-skills)

### Fase 0 — Handoff (feito)

- [x] `docs/design/project-flow/**` com design, análise, dogfood, referências PDTI
- [x] Design ratificado pelo operador (descarte process-map, obrigação = implement HARD + comando, cascata PR1→PR5)
- [x] Código PR1…PR4 (renderer/detector/schema/sketches/`map.html` apagados)

### Fase 1 — PR1+PR2 (sem tocar Iron Law)

- Schema + validate + render existem.
- Process-map **continuava** no repo até PR3. Apagado depois da PR4.

### Fase 2 — PR3 (comando + process-map sai da criação)

- **Sem** stage `flow` inescapável. Criação: `summaries` → `reviews` (stage `process-map` removido).
- `new plan` / `adopt` **não** bloqueiam ready sem flow. Draft de `flow.json` é opcional.
- `project flow` = generate / update / show / ratify / `--check`.
- Alias `process` chama **somente** flow.
- Detector: OK só com `flow.json` válido + `flow.html` sha + `ratifiedAt` + `ratifiedGraphSha`. Nunca `map.html`.
- Planos mid-creation parados no gate `process-map`: avançar para `reviews` **sem** cards. Flow só via comando.

### Fase 3 — PR4 (implement HARD + remoção)

- Iron Law = **NO IMPLEMENT WITHOUT VALIDATED FLOW** (texto em `CLAUDE.md`, `project.md`, implement.md Step 1, KB).
- `docs/kb/flow.md` canônico; `docs/kb/process-map.md` superseded + redirect.
- Apagados: `render-process-map.js`, `find-missing-process-map.js`, `process-map.schema.json`, `process-map-sketches/`, `stage-process-map.md`, dogfood `process.yaml`/`process-map.html`.
- `process.yaml` existente: **não** migrar para journey/cards. Ready pode ficar. Primeiro `implement` recusa até `project flow` draftar + ratificar o graph. Copiar só `actor` / `scenario` / `audience` se úteis.

### Não fazer

- Dual-write `process.yaml` + `flow.json`.
- Aceitar legado como P1 “por um minor”.
- Gerar Mermaid a partir de `edges[]` de cards.

---

## B. Repo da feature (arch-legacy worktree)

**Origem:**

```
.worktrees/sugestao-necessidade-pdti/.atomic-skills/projects/arch-legacy/sugestao-necessidade-pdti/
  docs/fluxo-*.html|json
  process/*
```

**Depois do produto AS existir (PR5):**

1. Remover `docs/fluxo-completo.html`, `fluxo-sugestao.json`, `fluxos-bpmn-interface.html`, `fluxos-usuario-sistema.html` do plan (já copiados para dogfood AS).
2. Gerar `flow/` no plan via `project flow` se a feature ainda precisar de artefato local.
3. `process/` do plano PDTI pode apagar quando o flow existir — não manter segunda SoT.
4. Não manter viewer de produto no arch-legacy.

**Não fazer agora:** apagar no arch-legacy antes do código AS existir. Ordem: **persistir handoff AS → implementar cascata → limpar feature repo**.

---

## C. Checklist de “sumiu do repo da feature”

- [ ] Handoff AS no disco (e commit quando o operador pedir)
- [ ] PR2 render utilizável
- [ ] Fixture dogfood cobre o JSON
- [ ] `rm` dos arquivos `docs/fluxo*` no plan PDTI + nota no plan.md apontando para AS
- [ ] Nenhum link de CI/docs da feature apontando para o HTML local como canônico de produto AS
