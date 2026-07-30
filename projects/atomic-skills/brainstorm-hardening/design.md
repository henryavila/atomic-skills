# Design: brainstorm-hardening

## Context

O fluxo `atomic-skills:brainstorm` (Stage 2 de `project new plan`) é o front-half de DESIGN do lifecycle. Hoje ele permite **convergência prematura**: o agente frameia forks sozinho, pode **pular o painel** (`debate --gate`) quando o ladder diz “uma abordagem / barato de reverter”, e grava um `design.md` sem contrato explícito de escopo com o usuário.

Sintomas (ground truth):

- `skills/core/brainstorm.md` B1: painel **somente** se ≥2 abordagens viáveis **E** decisão cara de reverter; senão skip para B2/B3.
- B0 não entrevista o usuário — só greps/reads e inventa 3–7 decision questions.
- `scripts/lint-design.js` exige apenas `Decisions` + `Chosen approach` (+ `Blast radius` se `--migration`). `Context` e `Non-goals` são soft.
- Não existe `skills/shared/brainstorm-assets/`.
- Não há receipt de processo de DESIGN (só o doc + critic).

Referência externa: BMAD brainstorming / product-brief (facilitador + HALT + research digests + coach≠quiz) — portar **mecanismos**, não technique CSV nem meta de 100+ ideas.

Este design fixa o WHAT/WHY e a abordagem escolhida para endurecer o brainstorm **sem** mudar Stage 8 (`review-plan`) nem lanes isentas (ad-hoc / single-task / `adopt`).

## Interview

**Ratificado com o usuário (sessão `project new plan brainstorm-hardening`, 2026-07-30).**

| Campo | Conteúdo ratificado |
|-------|---------------------|
| **Problema** | Brainstorm fraco: sem entrevista, debate condicional, sem enforcer de processo |
| **In-scope** | (1) Entrevista obrigatória B0 com eco+ratify; (2) research via subagents com digests (**repo only**); (3) `debate --gate` **sempre** no multi-phase; (4) lints + enforcers zero-token; (5) lazy `brainstorm-assets/` |
| **Out-of-scope** | Technique CSV BMAD; 100+ ideas; advanced-elicitation skill; session-resume multi-dia; mudar Stage 8 review-plan; debate em ad-hoc/adopt; research **web**; skip oficial de debate no multi-phase |
| **Done-when (design)** | `design.md` lint-clean + critic Approved + user approval → handoff a decompose |
| **Stakes** | Muda o contrato de todo `new plan` multi-phase (comportamento de agente + gates); one-way door de **processo** (expectativa do operador), não de schema de dados |
| **Fork principal** | Always debate (kill skip ladder) |

Proof-of-work: slug, objetivo, multi-select IN, OUT (incl. no-web), fork de debate e síntese pós-painel ratificados via `ask_user_question` — não genérico “ok”.

## Decisions

1. **Interview first (HARD).** Antes de research e debate, o multi-phase brainstorm **entrevista** o usuário (problema, in-scope, out-of-scope/non-goals, done-when do design, stakes, fontes). Eco + ratify; genérico “ok/yes/lgtm” **não** conta. O conteúdo ratificado vira seções canônicas no `design.md` (`## Interview` e alimenta `## Context` / `## Non-goals`). Template e script de perguntas vivem em `skills/shared/brainstorm-assets/interview.md` (lazy).

2. **Debate is always-on for multi-phase DESIGN.** Remover o DESIGN gate ladder que pula o painel. Multi-phase brainstorm **sempre** invoca `atomic-skills:debate --gate` com agenda = decision questions do frame. Debate permanece **ACTOR**; critic + usuário decidem. Lanes ad-hoc / single-task / `adopt` **permanecem** isentas de DESIGN (R-ORCH-03) — sem debate forçado lá.

3. **Anti-theater no debate.** Receipt / synthesis exige `ready_for_validation: yes` e evidência de contrarian. **Barra objetiva (v1):** se o frame listou ≥2 abordagens, `## Rejected alternatives` deve conter ≥1 entrada nomeada **ou** a synthesis `dissent[]` deve ter ≥1 objection não vazia. Se o frame listou 1 abordagem, o contrarian ainda roda e o receipt grava `single_approach: true` + a objection do contrarian (aceita ou rejeitada com razão em Rejected alternatives ou Decisions). Três vozes que só concordam **sem** dissent/rejected **não** fecham o gate de processo.

4. **Research repo com digest (HARD no multi-phase).** Sempre ≥1 subagent de recon no repo; parent recebe digest com paths + claims (ou `assumed:` explícito). **Sem research web** neste plano. Prompt/schema do digest em `brainstorm-assets/research.md`. **Barra objetiva de digest fraco (v1):** falha se (a) zero caminhos de repo citados, **ou** (b) menos de 3 bullets não-placeholder, **ou** (c) só filler (`ok`/`lgtm`/`README`). Path canônico do digest: `projects/<id>/<slug>/research-digest.md` (referenciado no receipt).

5. **Enforcers determinísticos (presença + qualidade + receipt).**  
   - Expandir `lint-design.js`: seções **sempre** obrigatórias passam a incluir `Context`, `Non-goals`, e `Interview` (além de Decisions + Chosen approach; Blast radius continua migration-only).  
   - Novo `find-missing-design-process.js`: receipt `design-gates/<projectId>-<slug>.json` com campos mínimos (`interviewAccepted`, `debateGate`, `researchDigest`, `criticVerdict`, `userApproved`, `status`).  
   - Novo `find-weak-design.js`: soft-language G2, non-goals não eco de decisions, context/interview com comprimento mínimo, digest sem paths.  
   - **Wire:** `project new plan` Stage 4 (e handoff do brainstorm) HARD-BLOCK se lint ou process detectors falharem.

6. **Skill thin + lazy assets.** `brainstorm.md` = Iron Laws, ordem B0→B0b→B0c→B1→B2→B3→B4→B5, lista de enforcers. Detalhe de entrevista/research/receipt em `skills/shared/brainstorm-assets/{interview,research,process-receipt}.md`.

7. **Grandfathering.** Designs **novos** fail-closed. Isenções = lanes já documentadas (ad-hoc / single-task / `adopt`). Sem flag `grandfathered` setável pelo agente. Designs legados pré-skill não são migrados em massa neste plano.

8. **Sem mudança em Stage 8.** Review do plano materializado continua `review-plan` (internal / ground-truth / cross-model). Debate não substitui review-plan.

## Chosen approach

### Opções pesadas

| # | Abordagem | Resumo |
|---|-----------|--------|
| A | **Prosa-only skill rewrite** | Reescrever `brainstorm.md` com interview + always-debate; sem novos scripts | Rápido; agentes pulam — o bug original |
| B | **Lint-only** | Expandir `lint-design` (Non-goals/Context/Interview) + skill rewrite; sem receipt | Barato; não prova debate/research |
| C | **Full process package (escolhida)** | Skill rewrite + lazy assets + always debate + research digests + lint expand + design-gates receipt + find-missing/weak + wire Stage 4 | Cobre presença e processo; custo de implementação e tokens no happy path |
| D | **BMAD-port profundo** | Technique library, session resume, advanced elicitation | Fora de escopo; dilui o job de DESIGN |

### Recomendação: **C**, com mitigações do painel

- **Interview no `design.md`** (não `interview.md` irmão) — uma superfície canônica; template lazy.  
- **Stack enforcer enxuto mas real:** 1 lint de seções + 1 receipt de processo + 1 quality weak — não cinco detectors cosméticos.  
- **Research always no multi-phase** (usuário) com anti-digest-vazio (Kai/Aria).  
- **Always debate** (usuário) com anti-theater (Kai), sem escape `debate: skipped` no multi-phase.

### Por quê não A/B/D

- A: disciplina soft — falha sob pressão de token (pressure-tests Inc3 já mostraram escapes).  
- B: `Non-goals` no doc sem prova de interview/debate.  
- D: non-goal explícito.

## Blast radius

| Superfície | Impacto | Contenção |
|------------|---------|-----------|
| Todo `project new plan` multi-phase | Mais turns (interview + research + debate) | Só multi-phase; ad-hoc/adopt intactos |
| `lint-design.js` | Designs antigos sem Interview/Non-goals/Context falham se re-lintados no hot path | Stage 4 só no create; legado não re-lintado em massa; `adopt` isento de DESIGN |
| `project-create-plan.md` Stage 2/4 | Texto do ladder e preconditions | Diff localizado + testes de string em `project.test.js` |
| Token cost | Debate+research sempre | Digest repo-only; sem web; **v1 bound:** 1 round gate-mode (3 vozes + contrarian framing) fecha se anti-theater passa — sem 2º round obrigatório; anti-theater evita rounds extras performáticos |

Não é migração de dados/schema de plan/initiative. Processo de agente + lints + receipts.

## Non-goals

- Portar BMAD technique CSV, 100+ ideas, progressive technique flow  
- Nova skill `advanced-elicitation`  
- Session-resume multi-dia com `stepsCompleted` estilo BMAD  
- Alterar Stage 8 (`review-plan` internal/gt/cross-model)  
- Forçar debate em ad-hoc, single-task ou `adopt`  
- Research web / market recon  
- Escape hatch `debate: skipped` no multi-phase  
- Migrar em massa designs legados para o novo formato  
- Substituir o critic por consenso de painel  

## Rejected alternatives

| Alternativa | Quem | Por que rejeitada |
|-------------|------|-------------------|
| `interview.md` arquivo canônico separado | Aria | Cargo-cult + drift; usuário ratificou seções no design (Marco + síntese) |
| Lint-only no hot path (sem receipt) | Marco | Não prova interview/debate/research; usuário exigiu enforcers de processo |
| Research condicional (só se tocou repo) | Marco | Usuário ratificou research digests como IN; mitiga-se com anti-weak digest, não skip |
| Ladder invertido / skip com motivo | (opção de fork) | Usuário escolheu always debate; skip oficial reabre o buraco |
| Always-3-full-rounds de debate | — | Overkill; 1 round gate-mode com contrarian + anti-theater basta no v1 |
| BMAD-port profundo (D) | — | Non-goal; dilui DESIGN |

## Open questions

1. **Schema exato do receipt** (`design-gates/*.json`) — campos mínimos já decididos (`interviewAccepted`, `debateGate`, `researchDigest`, `criticVerdict`, `userApproved`, `status`); extensões opcionais na task de implementação. **Ordem de ship:** definir schema + fixtures **antes** de ligar HARD-BLOCK no Stage 4 (senão o gate vira no-op ou arbitrário).  
2. **Research digest path:** decidido em Decisions §4 → `projects/<id>/<slug>/research-digest.md`.  
3. **Critic tier:** **non-change** (já em Non-goals / `critic.md`); não reabrir.  
4. **Lista explícita de isenções no detector** (ad-hoc / adopt / single-task) — sim na implementação de `find-missing-design-process` para não false-positive; detalhe de wiring na task, não na decisão de produto.

## Self-review against code-quality gates

- **G1 read-before-claim:** applied — claims sobre skip ladder e lint REQUIRED citam `skills/core/brainstorm.md` B1 e `scripts/lint-design.js` REQUIRED (digest de recon 2026-07-30).  
- **G2 soft-language:** applied — 0 hedges de ban list no corpo de Decisions/Approach.  
- **G6 reference-or-strike:** applied — comportamento atual verificado por explore agents nos paths listados em Context; decisões novas marcadas como design (não “já existe no código”).
