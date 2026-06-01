# Plan — Project Skill Unification (v2.0.0 — unreleased)

Sessão 2026-05-31. Funde as duas skills `project-status` + `project-plan`
numa **única skill `project`** com gramática de subcomandos estilo git e
**carga sob demanda** (router fino + arquivos lazy via `{{ASSETS_PATH}}`).
Net effect: **delete 2 skills**, **create 1 skill** (`project`),
**criar N arquivos de detalhe** em `project-assets/`.

> **Versão:** v2.0.0 ainda **não foi para produção** — esta consolidação
> entra dentro da própria v2.0.0 (não há bump). Sem usuários instalados na
> 2.0.0, a rename não é breaking-em-campo; é só mais uma mudança da release
> ainda não publicada.

Pré-requisito de leitura: `docs/plan-review-skills-consolidation.md` — esta
consolidação segue o mesmo playbook (delete + rename + CHANGELOG + regenerar
catalog/README/HelpView + `HISTORICAL_ATOMIC_SKILLS_NAMES`), **exceto o bump
major** — ver D9 (v2.0.0 ainda não publicada).

## Motivação (output da análise desta sessão)

1. **Fronteira vaza.** `project-status` cita `project-plan` 17×; `project-plan`
   cita `project-status` 24×. O reconciliation gate é definido num e invocado
   pelo outro; a emergence ladder atravessa os dois. O `when_not_to_use` do
   catálogo existe só para redirecionar o usuário entre as duas — sintoma de
   fronteira artificial.
2. **Token.** Hoje invocar qualquer uma carrega ~25k tokens do corpo inteiro.
   Um monólito fundido carregaria ~50k — **pior**. A economia real vem de
   *progressive disclosure*: router fino + detalhe lazy. Padrão **já provado**
   por `skills/core/review-plan.md` neste repo (usa `{{READ_TOOL}}
   {{ASSETS_PATH}}/...`).
3. **Superfície confusa.** `new` / `new-task` / `new-phase` hifenizados +
   default que abre browser pesado. Simplificável.

## Decisões travadas

| # | Decisão | Detalhe |
|---|---|---|
| D1 | **1 skill `project`** | `atomic-skills:project`. Delete `project-status` + `project-plan`. |
| D2 | **Router fino + lazy** | `skills/core/project.md` = dispatch + invariantes; procedures por subcomando como arquivos **FLAT** em `skills/shared/project-assets/`, lidos via `{{READ_TOOL}} {{ASSETS_PATH}}/project-<x>.md`. ⚠️ **Sem subdiretório** — `install.js` copia assets files-only/não-recursivo (`if (!f.isFile()) continue`); um `project/` subdir seria ignorado. `{{ASSETS_PATH}}` resolve para um `_assets/` **único e compartilhado** entre todas as skills → nomes precisam de prefixo `project-` para evitar colisão. Padrão idêntico ao `review-plan` (assets flat). |
| D3 | **No-args = resumo compacto** | `/project` puro → 5 linhas (plano/fase ativa · iniciativa + progresso · próxima ação · linha CODEX REVIEW). **NÃO** abre browser. Browser vai para `/project status --browser`. |
| D4 | **Gramática plana (sem verbo `plan`)** | `/project status`, `/project new`, `/project done`, etc. estilo git. |
| D5 | **`new` expõe só 2 entidades** | `new plan` e `new initiative` (as duas entidades de **arquivo**). Menu = lista fixa estática em ordem de pertencimento + dica de discoverability. |
| D6 | **Fase/Task = dirigidas por intenção** | NÃO listadas no menu, mas **comandos válidos se digitados** (`new-phase`/`new-task` continuam funcionando). Criação normal via emergence ladder + ratify. |
| D7 | **`status verify` (NOVO)** | Reconciliar `.atomic-skills/` ⇄ código. Recurso novo — não existe hoje um comando único de coerência estado⇄código. |
| D8 | **Estruturais ficam top-level** | `adopt`, `discover`, `migrate`, `split-phase` — não entram em `new` (são captura/varredura/reestruturação, não criação de 1 entidade). |
| D9 | **Sem bump (fica em 2.0.0) + CHANGELOG** | v2.0.0 não publicada → a consolidação entra na própria 2.0.0. Adicionar `project-status`,`project-plan` ao `HISTORICAL_ATOMIC_SKILLS_NAMES`. |
| D10 | **Corrigir refs de asset cruas** | Bodies usam hoje `skills/shared/project-status-assets/...` (path de origem, quebra fora do repo). Migrar tudo para `{{ASSETS_PATH}}`. |

## Gramática final

```
/project                                  → resumo compacto (no-args, barato)
/project status [--browser] [--terminal]  → view (compacto / dashboard / CLI)
/project status verify                    → reconciliar estado ⇄ código (NOVO)
/project new                              → menu fixo (plan | initiative) + dica
/project new plan <slug>                  → bootstrap multi-fase
/project new initiative <slug>            → iniciativa (standalone ou de fase)
/project done|push|pop|park|emerge|promote|switch|phase-done|phase-reopen|archive
/project why|re-ratify|scope-creep|review-due
/project adopt <file.md>|discover|migrate <slug>|split-phase <id>
# válidos mas NÃO listados (uso por intenção via ladder, ou digitados por power-user):
/project new-task|new-phase
```

> **Nota de invocação (F-002):** `/project` acima é abreviação. A invocação
> real instalada é **`/atomic-skills:project ...`** (namespace gerado pelo
> `install.js`/`getSkillPath`). Catalog `examples`, docs gerados, gate template
> e mensagens ao usuário DEVEM usar a forma `atomic-skills:project` — não o
> `/project` cru. (Não há alias `/project` sem namespace neste release.)

Menu do `new` (estático, em ordem de pertencimento):

```
O que você quer criar?
  1. plan        — projeto multi-fase novo (narrativa + fases + exit gates)
  2. initiative  — unidade de trabalho (standalone, ou a iniciativa de uma fase)

Fase ou tarefa? Só descreva o que surgiu — eu classifico (emerge ladder)
e confirmo com você no ratify antes de gravar.
```

## Layout de arquivos

### Router (sempre carregado ao invocar — manter ~200-300 linhas)
`skills/core/project.md` contém **apenas**:
- Tabela de dispatch (subcomando → arquivo lazy a ler).
- Lógica do no-args (resumo compacto).
- **Invariantes que valem para qualquer subcomando** (nunca lazy):
  - **Iron Law** (sem iniciativa ancorada não mexe em código).
  - **Reconciliation gate** (tasks `active >24h` antes de mutar).
  - **Gate-status invariant** (`pending`/`met`/`deferred`, nunca `done` num gate — causa nº1 de "card failed to load" no aiDeck).
  - **Ratify gate** (regras: nunca aceitar "ok" genérico).
  - **Emergence ladder**: tabela magnitude→ação + gatilho de reconhecimento *ambiente* (a intenção surge fora de comando; se o gatilho fosse lazy a skill nunca "perceberia").
- Menu do `new` (2 itens + dica).
- Schema quick-ref mínimo (campos Plan/Initiative).

### Detalhe lazy — `skills/shared/project-assets/` (FLAT; instala em `_assets/`)
Nomes prefixados `project-` (dir único compartilhado — ver D2). Ref runtime: `{{ASSETS_PATH}}/<arquivo>`.

| Arquivo | Conteúdo migrado de hoje |
|---|---|
| `project-view.md` | view terminal/list/plan/phase/stack/archived + ensure-aideck script + auto-repair STATE_ERROR |
| `project-verify.md` | **NOVO** — reconciliação estado⇄código |
| `project-setup.md` | setup 1ª vez (mkdir, CLAUDE.md gate, hooks, .gitignore, AGENTS.md) |
| `project-create-plan.md` | bootstrap 7-stage + superpowers + decompose + Stage 8 review |
| `project-create-initiative.md` | `new` standalone/in-plan |
| `project-emergence.md` | procedures por degrau: park/emerge/promote/new-task/new-phase/split-phase + proposed-mutation format |
| `project-transitions.md` | done / phase-done / phase-reopen / verifier patterns / switch / archive |
| `project-discover.md` | pipeline discover (1a/1b/2/3/4) |
| `project-migrate.md` | migrate + re-bootstrap |
| `project-drift.md` | scope-creep + why + re-ratify + codex review tracking (review-due, last-review.json) |
| templates (existentes) | `plan.template.md`, `initiative.template.md`, `PROJECT-STATUS.md.template.md`, `CLAUDE.md-gate.template.md`, `AGENTS.md.template.md`, `bootstrap-*.template.md`, `minimal-source.template.md`, `hooks/` (hooks já são tratados fora do asset-loop) |

> Os asset dirs `project-status-assets/` + `project-plan-assets/` consolidam em **`project-assets/`** (owner = a skill `project`, então `install.js` copia via o branch core-skill já existente). ⚠️ `tests/aideck-contract.test.js` (linhas 27, 34) referencia o nome `project-status-assets` — a rename do dir quebra esse teste; ver Fase 11.

## Fases (ordem obrigatória)

| # | Fase | Arquivos | Tempo |
|---|---|---|---|
| 0 | **Decidir naming + travar gramática** (este doc) — sem código | — | feito |
| 1 | Escrever `skills/core/project.md` (router): dispatch + invariantes residentes + no-args + menu `new` | novo | 1h |
| 2 | Criar FLAT em `project-assets/`: `project-view.md` (**aiDeck parametrizado: constante de contrato no topo — domínio/endpoint OU futuro entrypoint de componentes — e separar "produzir dados" de "entregar ao aiDeck"**), `project-setup.md`, e **`project-verify.md` (NOVO — escrever contrato explícito ANTES: inputs, checks read-only vs mutações, se envolve `validate-state`/scope-drift/branch-match/orphan-detection/aiDeck, mensagens de falha, testes)** | novos | 1h30 |
| 3 | Criar FLAT: `project-create-plan.md` + `project-create-initiative.md` + `project-discover.md` (de project-plan) | novos | 1h |
| 4 | Criar FLAT: `project-emergence.md` + `project-transitions.md` + `project-migrate.md` + `project-drift.md` | novos | 1h30 |
| 5 | Consolidar asset dirs em `project-assets/`; **trocar TODAS as refs cruas `skills/shared/...` por `{{ASSETS_PATH}}`** (D10) | move + edits | 45min |
| 6 | `meta/catalog.yaml`: delete 2 entradas core, add `project`; **+ corrigir `related:` órfãos em OUTRAS entradas** (ex.: `save-and-push` tem `related: [project-status, …]` → senão `validate-catalog` falha por ref pendente) | edit | 30min |
| 7 | `src/install.js`: add `'project-status','project-plan'` ao `HISTORICAL_ATOMIC_SKILLS_NAMES` (comment "Removed in v2.0.0 consolidation") | edit | 5min |
| 8 | Delete `skills/core/project-status.md` + `skills/core/project-plan.md` | 2 files | 1min |
| 9 | Atualizar refs cross-skill em outros bodies (qualquer `atomic-skills:project-status`/`-plan` em outras skills) | edits | 20min |
| 10 | `CLAUDE.md` (projeto) + **TODOS os templates/hooks com refs antigas** (grep `atomic-skills:project-status\|-plan` em `skills/shared/project-assets/` → hoje 8 arquivos: `CLAUDE.md-gate`, `AGENTS.md`, `PROJECT-STATUS.md`, `bootstrap-index` templates + `hooks/{README,session-start,pre-write,stop}`) | edits | 45min |
| 11 | Testes: fundir `tests/project-status.test.js` + `tests/project-plan.test.js` → `tests/project.test.js`; ajustar `e2e-smoke.test.js`, `validate-skills`, `tests/aideck-contract.test.js` (dir + parser), **e `tests/install.test.js`** (contagens hard-coded `files.length` 31/32/61 + "8 project-status assets + 1 project-plan asset" → novo set) | edits | 1h30 |
| 11.5 | **Deletar docs órfãos** `docs/skills/project-status.md` + `docs/skills/project-plan.md` (senão `generate-skill-docs --check` exit 1 → `validate-catalog` falha) | 2 files | 2min |
| 12 | Entrada no `CHANGELOG.md` + catalog `release_highlight` (ANTES de gerar docs — F-007) | edit | 10min |
| 13 | Regenerar docs: `npm run generate-docs` (README + HelpView + skill-docs) + `npm run check-docs` imediatamente | scripts | 15min |
| 14 | **[DEFER — não fazer agora]** Documentar o **mapa magnitude→ação (emergence ladder)** no `README.md` — o usuário marcou como "ouro". Criar como task/follow-up, não nesta entrega. | follow-up | — |
| 15 | Validação final: `npm test`, `npm run validate-catalog`, `npm run build:dashboard`, check manual do HelpView + invocação `/project` em repo limpo | scripts | 30min |

**Total: ~10h30** sequencial (estimativa pós-review; phase 14 é follow-up explícito).

> **Reviews:** ver `## Reviews` ao final — review-plan `--mode=both` rodado
> em 2026-05-31 (local: 6 findings aplicados; codex gpt-5-codex blind:
> 1 critical + 5 major + 1 minor, todos aplicados ou rebatidos no plano).

## ⚠️ Contrato cross-repo: `project-status` NÃO é só o nome da skill (F2)

A string `project-status` é **sobrecarregada**. Antes de qualquer find-replace global:

- **Nome da skill** (`atomic-skills:project-status`) → **renomear** para `project`.
- **Domínio de estado do aiDeck** → **NÃO renomear cegamente.** O aiDeck tem um
  parser `aideck/dist/server/parsers/project-status.js` (`tests/aideck-contract.test.js:21`),
  e o corpo da skill faz `curl .../api/projects/$pid/state/project-status`
  (`project-status.md:168`). Esse `project-status` é a **chave de domínio do aiDeck**,
  um contrato do repo-irmão — trocar para `state/project` quebra o default view +
  auto-repair STATE_ERROR a menos que o aiDeck seja alterado em conjunto.

**Ação:** decidir explicitamente — (a) manter a chave de domínio `project-status`
no curl (skill renomeia, contrato aiDeck preserva), ou (b) PR coordenado no aiDeck
para renomear o parser/domínio. Default recomendado: **(a)** — desacopla o rename
da skill do contrato aiDeck. Adicionar uma fase de verificação `aideck-contract`.

> **aiDeck está em refatoração completa (info 2026-05-31).** O aiDeck hoje está
> embutido no atomic-skills (sem dep externa) e será **totalmente reescrito**;
> depois, `project` será reconectado ao novo aiDeck. Implicação para ESTE plano:
> **quarentenar TODO acoplamento aiDeck num único arquivo lazy** (`project-view.md`
> — ensure-aideck script, STATE_ERROR auto-repair, browser) + a string de domínio.
> Assim, quando o novo aiDeck pousar, a re-conexão toca **1 arquivo**, não o router
> nem os demais lazies. A arquitetura de progressive-disclosure ajuda exatamente
> aqui. Sequenciamento sugerido: consolidar agora com aiDeck quarentenado →
> re-conectar como follow-up localizado pós-refactor do aiDeck.
>
> **PROJETAR PARA A MUDANÇA (decisão 2026-05-31).** A direção do aiDeck novo
> ainda é incerta (possível migração de "REST `/state/project-status`" para
> "importar/chamar componentes do aiDeck e passar dados+layout"). Portanto o
> contrato aiDeck **não é hardcoded inline**: `project-view.md` declara no topo
> uma **constante única** (ex.: `AIDECK_STATE_DOMAIN="project-status"` e o
> endpoint base) que todo o resto do arquivo referencia. Se o contrato virar
> uma API de componentes, troca-se **um bloco no topo de 1 arquivo** — o restante
> do skill é agnóstico a como o aiDeck renderiza. O `project-view.md` deve
> separar explicitamente: (a) **produzir os dados** de `.atomic-skills/`
> [estável], de (b) **entregar ao aiDeck** [parâmetro que pode virar curl OU
> import de componentes].

## Raio de impacto (rename — já levantado por grep nesta sessão)

`CHANGELOG.md`, `TODO.md`, `README.md`, `CLAUDE.md`, `HANDOFF*.md`,
`meta/catalog.yaml`, `tests/{project-status,project-plan,e2e-smoke,validate-state}.test.js`,
`tests/hooks/*`, `meta/schemas/*` (referências em descrições), `docs/plan-*.md`,
`src/install.js` (HISTORICAL set), HelpView (dashboard), e as **memórias do usuário**
(`feedback-*`/`project-*` citam `atomic-skills:project-status`) — estas últimas
ficam como nota; atualizar slugs de memória é opcional e fora do escopo de código.

## Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Router incha e a economia de token evapora | Teto ~300 linhas; só dispatch + invariantes + no-args ficam residentes. |
| Carga lazy é "soft": modelo age sem ler o detalhe | Instruções imperativas no router ("Para `X`: PARE. {{READ_TOOL}} ... antes de agir") — padrão do review-plan. |
| Intenção emergente não é percebida porque o gatilho ficou lazy | Ladder-trigger + tabela magnitude→ação ficam **residentes** no router. |
| "adicionar seção ao plano" tratado como fase por default | Instrução explícita: classificar principle/glossary/reference (edição de body) vs fase (ritual pesado `new-phase`). Nunca defaultar para fase. |
| Asset refs cruas quebram fora do repo de origem | Fase 5 troca tudo por `{{ASSETS_PATH}}`; `validate-skills` checa existência dos refs. |
| Usuário não descobre que pode criar fase/task por intenção | Dica no menu do `new` (D5). |
| Quebra silenciosa de instalações existentes na atualização | `HISTORICAL_ATOMIC_SKILLS_NAMES` reconhece os nomes antigos no cleanup; documentar a rename no CHANGELOG. |
| Find-replace global de `project-status` quebra contrato aiDeck (F2) | Preservar a chave de domínio `state/project-status` no curl; renomear só o nome de invocação. Verificar com `aideck-contract.test.js`. |
| Router estoura o teto de ~300 linhas (invariantes residentes são volumosos: ladder + ratify + reconciliation gate + gate-status) (F6) | Aceitar teto realista ~350-400 ou comprimir invariantes em tabelas; medir após Fase 1 e cortar o que puder virar lazy sem perder o gatilho ambiente. |

## Decisões em aberto (confirmar antes da Fase 1)

- **Nome da skill**: `project` (→ `atomic-skills:project`). Assumido. Alternativa: manter compat alias.
- ✅ **RESOLVIDO** — `adopt` fica **separado** (verbo top-level próprio), não vira `new plan --from`. É o caminho de maior risco e merece nome próprio.
- ✅ **RESOLVIDO** — sem bump de versão; consolidação entra na v2.0.0 ainda não publicada (D9).
- **Alternativa não escolhida**: "2 skills finas (cada uma router+lazy) em vez de 1 skill". Descartada por D1 (fronteira vaza). Reabrir via `/debate` se quiser estressar.

## Reviews

`atomic-skills:review-plan --mode=both` — 2026-05-31.

**Local pass (6 findings, aplicados inline):** F1 asset subdir→flat+prefix (D2/layout), F2 contrato aiDeck `project-status` (seção dedicada), F3 aideck-contract.test (Fase 11), F4 catalog `related:` órfãos (Fase 6), F5 wording bump (prereq), F6 teto router (riscos).

**Codex pass (gpt-5-codex, blind) — needs_changes, 1C/5M/1m:**
- F-001 (critical): D2 corrigido mas Fases 2-4 ainda descreviam subdir/sem-prefixo → **aplicado** (Fases 2-4 reescritas flat+prefixo).
- F-002 (major): grammar `/project` ≠ invocação real `/atomic-skills:project` → **aplicado** (nota de invocação).
- F-003 (major): docs órfãos `docs/skills/project-{status,plan}.md` quebram `generate-skill-docs --check` → **aplicado** (Fase 11.5).
- F-004 (major): `tests/install.test.js` contagens hard-coded → **aplicado** (Fase 11).
- F-005 (major): 8 templates/hooks com refs antigas além do gate → **aplicado** (Fase 10).
- F-006 (major): `status verify` sem contrato executável → **aplicado** (Fase 2 exige spec antes).
- F-007 (minor): changelog/catalog antes de generate-docs → **aplicado** (Fases 12/13 reordenadas).

Artifact: `.atomic-skills/reviews/2026-05-31-project-skill-unification-codex-blind.md`.

## Self-review against code-quality gates

- G1 read-before-claim: toda alegação sobre código existente verificada por grep/read nesta sessão (install.js files-only, ASSETS_PATH shared, aiDeck parser, install.test counts, generate-skill-docs orphan check, catalog related).
- G2 soft-language: ban-list grep no plano → 0 ocorrências.
- G6 reference-or-strike: alegações carregam `file:line` (project-status.md:168, install.js loop, install.test.js:39/84/145/227, generate-skill-docs.js:49-57, catalog save-and-push related).
