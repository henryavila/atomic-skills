# HANDOFF — Project Flow (substitui process map)

**Ler este arquivo primeiro** em qualquer sessão que implemente ou desenhe o produto flow.

| Campo | Valor |
|-------|--------|
| **Status** | Handoff + design draft — **não implementado** no monorepo ainda |
| **Data** | 2026-08-12 |
| **Repo canônico** | `/home/henry/atomic-skills` (este) |
| **Origem dogfood** | worktree arch-legacy `sugestao-necessidade-pdti` (feature PDTI — **não** é o destino do produto) |
| **Pasta** | `docs/design/project-flow/` |

---

## TL;DR

1. O **process map** atual (`process/process.yaml` → `map.html`) é Iron Law P1, mas a UI é lista de cards e **não desenha** `edges[]` — insuficiente para validar fluxos com XOR, mensagens e status.
2. No plano PDTI nasceu um protótipo **fora** do AS: `fluxo-sugestao.json` + `fluxo-completo.html` (Sequência + Fluxo + Estados, Mermaid, pan/zoom). Funciona como validação de PO; está **acoplado ao domínio PDTI**.
3. **Produto alvo:** subcomando `/atomic-skills:project flow` no monorepo que:
   - valida o plano/grafo,
   - autor (agente) + ratifica (humano) o grafo,
   - **script determinístico** gera a UI polida a partir do grafo.
4. Tudo o que foi criado no arch-legacy para esse viewer deve **viver aqui** (fixtures + design). O trabalho de produto **não** continua no repo da feature.

---

## Mapa desta pasta

```
docs/design/project-flow/
  HANDOFF.md                 ← você está aqui
  design.md                  ← decisões + approach + PR plan (implementável)
  research-digest.md         ← evidência de código AS + dogfood
  migration.md               ← cut-over process-map → flow + limpeza arch-legacy
  analysis/
    01-impl-audit.md         ← o que é genérico vs hardcoded no protótipo
    02-as-integration.md     ← lifecycle, scripts, skills, gates
    03-schema-comparison.md  ← process.yaml vs fluxo JSON vs unificado
  dogfood/
    PROVENANCE.md
    SHA256SUMS
    fluxo-sugestao.json      ← fixture canônica (grafo N2)
    fluxo-completo.html      ← viewer a productizar (extrair builders)
    process.yaml             ← L1 process-map do mesmo plano (comparar)
    process-map.html         ← L2 cards (limitações)
    fluxos-*.html            ← não-canônicos (referência só)
  references/
    monorepo-paths.md        ← paths, Iron Laws, comandos AS
    pdti-feature-*.md        ← design/plan/source da feature modelada no grafo
    pdti-decisions/          ← decisões de fase (status 10/1/11 etc.)
```

---

## Objetivo final (contrato de produto)

| Etapa | Quem | Artefato |
|-------|------|----------|
| 1. Draft do grafo | Agente a partir de design/source | `flow/flow.json` (nome no `design.md`) |
| 2. Validar | Script + schema AJV | exit ≠ 0 bloqueia |
| 3. Show + ratify | Humano (AskUserQuestion, não skippable) | `ratifiedAt` |
| 4. Render | `scripts/render-flow.js` **determinístico** | `flow/map.html` (self-contained) |
| 5. Day-2 | `/project flow` / `--check` | re-render + open |

**Não confundir com:**

- `app-map` — inventário de páginas (design-brief)
- Process map legado — journey macro; vira projeção **L0** do flow unificado ou legacy dual-read

---

## Estado do monorepo (baseline)

| Peça | Path |
|------|------|
| Package root | `~/.atomic-skills/package-root` → `/home/henry/atomic-skills` |
| Process map schema | `meta/schemas/process-map.schema.json` |
| Render process map | `scripts/render-process-map.js` + `scripts/lib/render-process-map.js` |
| Detector | `scripts/find-missing-process-map.js` |
| Stage criação | `skills/shared/project-assets/new-plan/stage-process-map.md` |
| Day-2 | `skills/shared/project-assets/project-process-map.md` |
| KB | `docs/kb/process-map.md` |
| Router | `skills/core/project.md` (plugin: `~/.grok/plugins/atomic-skills/skills/project/SKILL.md`) |

Commits recentes relevantes: `feat(project): process map L1/L2…`, `fix(project): show process map before ratify`.

**Ainda não existe:** `flow.schema.json`, `render-flow.js`, subcomando `flow`, stage `flow`.

---

## Próximos passos (agente no atomic-skills)

1. Ler `design.md` completo (Key Decisions + PR Plan).
2. Confirmar com operador se há open questions no design (se restarem).
3. Abrir plano AS multi-phase **neste** repo (`project new plan …`) **só após** design ratificado pelo usuário, **ou** implementar por PRs do `design.md` se o operador pedir execute-plan direto.
4. PR1 = schema + validate core + fixture dogfood (sem UI ainda).
5. **Não** editar arch-legacy para “melhorar” o viewer; mudanças de produto aqui; limpeza lá após cut-over (`migration.md`).

---

## Anti-padrões

- Continuar iterando fills/níveis de alt no HTML dogfood (adiado explicitamente pelo operador).
- Validação core com “exatamente 3 decisões / D1 / D_edit / D2 / status 10”.
- Gerar grafo renomeando `phases[]` (Iron Law P2 permanece).
- Hand-edit de HTML gerado.
- Scripts só no plugin Grok — runtime é o monorepo.

---

## Origem da sessão

Análise paralela (3 agents explore) + protótipo construído no worktree:

`arch-legacy/.worktrees/sugestao-necessidade-pdti/.atomic-skills/projects/arch-legacy/sugestao-necessidade-pdti/docs/`

Operador: *pare com experimentos de UI de nível; produto genérico em atomic-skills; handoff com contexto completo; o que foi criado no repo da feature deve migrar e sumir de lá.*
