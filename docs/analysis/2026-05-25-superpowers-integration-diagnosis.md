# Diagnóstico: Integração project-plan ↔ superpowers

**Data:** 2026-05-25
**Status:** 3 bugs identificados, implementação pendente

## Contexto

Ao rodar `project-plan` para criar o plano `aideck-multi-project`, o Stage 2 detectou superpowers como "absent" e pulou toda a integração. Investigação revelou que superpowers **está instalado** (v5.1.0) mas a integração tem 3 bugs que impedem o funcionamento.

## 1. superpowers ESTÁ instalado

```
~/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/
├── skills/brainstorming/SKILL.md
├── skills/writing-plans/SKILL.md
├── skills/executing-plans/SKILL.md
├── skills/dispatching-parallel-agents/SKILL.md
├── skills/subagent-driven-development/SKILL.md
├── skills/systematic-debugging/SKILL.md
├── skills/test-driven-development/SKILL.md
├── skills/using-git-worktrees/SKILL.md
├── skills/verification-before-completion/SKILL.md
├── skills/finishing-a-development-branch/SKILL.md
├── skills/receiving-code-review/SKILL.md
├── skills/requesting-code-review/SKILL.md
├── skills/using-superpowers/SKILL.md
├── skills/writing-skills/SKILL.md
└── (14 skills total)
```

Confirmado via `~/.claude/plugins/installed_plugins.json` (entry `superpowers@claude-plugins-official`).

## 2. Bug 1: Detecção quebrada (path errado)

**Arquivo:** `skills/core/project-plan.md` linha 223

**Comando atual:**
```bash
test -d "$HOME/.claude/plugins/superpowers" \
  || command -v superpowers >/dev/null 2>&1 \
  && echo "superpowers: available" \
  || echo "superpowers: absent"
```

**Problema:**
- Check 1: testa `~/.claude/plugins/superpowers/` — path não existe. O real é `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/`
- Check 2: `command -v superpowers` — superpowers não é um CLI executável, é um plugin com skills .md

**Fix proposto:**
```bash
test -f "$HOME/.claude/plugins/installed_plugins.json" \
  && grep -q '"superpowers@claude-plugins-official"' "$HOME/.claude/plugins/installed_plugins.json" \
  && echo "superpowers: available" \
  || echo "superpowers: absent"
```

## 3. Bug 2: Nomes de skills errados

**Arquivo:** `skills/core/project-plan.md` linhas 252-253

| project-plan referencia | Nome real no plugin |
|---|---|
| `superpowers:brainstorm` | `superpowers:brainstorming` |
| `superpowers:write-execution-plan` | `superpowers:writing-plans` |

**Fix:** Renomear as referências para os nomes corretos.

## 4. Bug 3: Incompatibilidade de formato de saída

**Problema arquitetural — requer adapter.**

O superpowers `writing-plans` gera planos em formato próprio:
- Tasks em checkbox syntax (`- [ ] Step 1: ...`)
- Salvos em `docs/superpowers/plans/YYYY-MM-DD-<name>.md`
- Estrutura: Goal → Architecture → Tech Stack → Tasks com steps de 2-5 min
- Sem conceito de phases `## F0 — Title`

O `decomposePlan()` do project-plan espera:
- Phases com heading `## F0 — Title` (regex `^(F\d+)\b`)
- Exit gates em YAML fenced blocks
- Tasks em H3 ou bullet list com formato `**T-001 — Title.**`
- Principles/Glossary em seções específicas

**Sem um adapter, o output do superpowers não é parseável pelo decomposer.**

### Opções de solução

**Opção A: Adapter superpowers→decompose**
- Criar `src/adapt-superpowers-plan.js` que transforma o formato superpowers em formato decomposePlan
- Map checkbox groups → phases, individual checkboxes → tasks
- Gerar exit gates defaults

**Opção B: Post-processing no brainstorming**
- Usar `superpowers:brainstorming` para o design doc/spec
- Mas gerar o plan source no formato decomposePlan via project-plan (não via `writing-plans`)
- O superpowers faz o brainstorm, project-plan faz a materialização

**Opção C: Bypass decomposePlan para superpowers plans**
- Quando o source vem do superpowers, não usar decomposePlan
- Materializar direto do formato superpowers para .atomic-skills/ com adapter dedicado

**Recomendação:** Opção B — menor superfície de mudança. O superpowers é excelente para brainstorming e spec; a materialização em .atomic-skills/ fica com o project-plan que já tem o decomposer testado.

## 5. Ganho potencial

Se funcionasse, o pipeline seria:

1. `superpowers:brainstorming` — exploração interativa de requisitos, 2-3 approaches com trade-offs, design doc, self-review, aprovação
2. project-plan usa o spec/design doc como input para gerar o source plan no formato correto
3. `decomposePlan()` materializa em .atomic-skills/

**Ganhos vs fluxo atual (template mínimo):**
- Brainstorming interativo antes de planejar (vs pular direto para phases)
- Design doc persistido em `docs/superpowers/specs/` (rastreabilidade)
- Validação de requisitos antes da decomposição
- Mais contexto para tasks (o spec alimenta descrições mais ricas)

## 6. Resumo de ações

| # | Ação | Esforço | Arquivo |
|---|------|---------|---------|
| 1 | Fix detecção (installed_plugins.json) | 5 min | `skills/core/project-plan.md:223` |
| 2 | Fix nomes de skills | 5 min | `skills/core/project-plan.md:252-253` |
| 3 | Redesenhar Stage 3 Branch A | ~2h | `skills/core/project-plan.md:239-260` |
| 4 | Atualizar test C.T-003 | 30 min | `tests/project-plan.test.js` |
| 5 | Testar end-to-end | 1h | manual |
