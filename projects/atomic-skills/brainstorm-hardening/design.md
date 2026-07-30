# Design: brainstorm-hardening

## Context

O fluxo `atomic-skills:brainstorm` (Stage 2 de `project new plan`) é o front-half de DESIGN do lifecycle. Hoje ele permite **convergência prematura**: o agente frameia forks sozinho, pode **pular o painel** (`debate --gate`) quando o ladder diz “uma abordagem / barato de reverter”, e grava um `design.md` sem contrato explícito de escopo com o usuário.

Sintomas (ground truth):

- `skills/core/brainstorm.md` B1: painel **somente** se ≥2 abordagens viáveis **E** decisão cara de reverter; senão skip para B2/B3.
- B0 não entrevista o usuário — só greps/reads e inventa 3–7 decision questions.
- `scripts/lint-design.js` exige apenas `Decisions` + `Chosen approach` (+ `Blast radius` se `--migration`). `Context` e `Non-goals` são soft.
- Não existe `skills/shared/brainstorm-assets/`.
- Não há receipt de processo de DESIGN (só o doc + critic).
- **`project-create-plan.md` é monólito** — carregar tudo no context aumenta a chance de o agente ignorar o meio.
- **businessIntent “must not pre-fill”** está errado de produto: o padrão correto é **draft-and-ratify** (agente drafta, user valida) — já usado em `materialize` / `new initiative`.
- **Gap maior:** o agente não segue fielmente a skill; **mais texto piora** a fidelidade. Melhora real = stages fatiados + exit codes, não mais Red Flags.

Referência externa: BMAD brainstorming / product-brief (facilitador + HALT + research digests + coach≠quiz) — portar **mecanismos**, não technique CSV nem meta de 100+ ideas.

Este design fixa o WHAT/WHY e a abordagem escolhida para endurecer o brainstorm **e** a fidelidade de execução de `new plan` **sem** mudar Stage 8 (`review-plan`) nem lanes isentas (ad-hoc / single-task / `adopt`).

## Interview

**Ratificado com o usuário (sessão `project new plan brainstorm-hardening`, 2026-07-30 + follow-up fidelidade).**

| Campo | Conteúdo ratificado |
|-------|---------------------|
| **Problema** | Brainstorm fraco + agente ignora skill; monólito + “must not pre-fill” BI errado |
| **In-scope** | (1) Entrevista B0; (2) research digests repo-only; (3) debate always; (4) lints/enforcers/receipts; (5) lazy brainstorm-assets; (6) **BI draft-and-ratify**; (7) **new-plan router fino + stage-N.md**; (8) **creation-gates.stage monotônico + assert-creation-stage** |
| **Out-of-scope** | Technique CSV BMAD; 100+ ideas; advanced-elicitation; session-resume multi-dia; mudar Stage 8; debate em ad-hoc/adopt; research web; skip debate multi-phase; “polícia” LLM re-lendo a skill inteira |
| **Done-when (design)** | design lint-clean + critic Approved + user approval |
| **Stakes** | One-way door de **processo** (expectativa do operador em todo multi-phase new plan) |
| **Fork principal** | Always debate; fidelity via **stage files + exit codes**, não mais prosa |

## Decisions

1. **Interview first (HARD).** Antes de research e debate, o multi-phase brainstorm **entrevista** o usuário (problema, in-scope, out-of-scope/non-goals, done-when do design, stakes, fontes). Eco + ratify; genérico “ok/yes/lgtm” **não** conta. Conteúdo ratificado → seções no `design.md` (`## Interview` + Context / Non-goals). Template lazy: `skills/shared/brainstorm-assets/interview.md`.

2. **Debate is always-on for multi-phase DESIGN.** Remover o ladder de skip. Multi-phase **sempre** `atomic-skills:debate --gate`. Debate = ACTOR; critic + user decidem. Ad-hoc / single-task / `adopt` **permanecem** isentos (R-ORCH-03).

3. **Anti-theater no debate.** `ready_for_validation: yes` + contrarian. **Barra v1:** se ≥2 abordagens no frame → ≥1 `Rejected alternatives` **ou** `dissent[]` não vazio; se 1 abordagem → contrarian ainda roda + `single_approach: true` + objection registrada. Três vozes que só concordam sem dissent/rejected **não** fecham o gate.

4. **Research repo com digest (HARD no multi-phase).** ≥1 subagent repo; digest em `projects/<id>/<slug>/research-digest.md`. **Sem web.** **Fraco se:** zero paths, ou menos de 3 bullets úteis, ou só filler. Schema em `brainstorm-assets/research.md`.

5. **Enforcers determinísticos (presença + qualidade + receipt).**  
   - `lint-design.js`: sempre exige Context, Non-goals, Interview (+ Decisions, Chosen approach; Blast radius migration-only).  
   - `find-missing-design-process.js` + `design-gates/<projectId>-<slug>.json` (`interviewAccepted`, `debateGate`, `researchDigest`, `criticVerdict`, `userApproved`, `status`).  
   - `find-weak-design.js`: G2, non-goals ≠ echo, min length, digest fraco.  
   - Wire Stage 4 create-plan + brainstorm B5 HARD-BLOCK.

6. **Skill thin + lazy assets (brainstorm).** `brainstorm.md` = Iron Laws + ordem B0→B5 + lista de enforcers. Detalhe em `brainstorm-assets/{interview,research,process-receipt}.md`.

7. **Grandfathering.** Designs novos fail-closed. Isenções = ad-hoc / single-task / `adopt`. Sem flag `grandfathered` setável pelo agente. Sem migração em massa de designs legados.

8. **Sem mudança em Stage 8.** Continua `review-plan` (internal / ground-truth / cross-model). Debate ≠ review-plan.

9. **businessIntent = draft-and-ratify (HARD).** O agente **sempre** drafta a spine (`value`, `workflow`, `rules`, `outOfScope`, `doneWhen`) e apresenta via `{{ASK_USER_QUESTION_TOOL}}` para o user **Aprovar draft / Ajustar / Cancelar**. **Remover** a regra “must not pre-fill” / “user writes from blank” de `project-create-plan` Stage 6. Proof-of-work = ratify explícito do bloco (não “ok” genérico sem spine). Alinha com `materialize` / `new initiative`. Qualidade continua em `find-weak-business-intent`.

10. **new plan = router fino + stage files (HARD, anti-ignore).** `project-create-plan.md` deixa de ser monólito load-bearing. Vira **router** (~1 tela): lista de estágios 1–9 + “leia **só** `project-assets/new-plan/stage-N.md` do estágio atual”. Cada stage file: **Contract (≤5 linhas)** + asks + commands + advance. Detalhe longo (schema, rationalization walls) fica lazy ou em KB — **não** no path quente. **Motivação:** quanto mais texto no hot path, maior a chance de o agente ignorar partes.

11. **creation-gates.stage monotônico + assert-creation-stage (HARD).** O JSON `.atomic-skills/status/creation-gates/<projectId>-<slug>.json` carrega `stage` com ordem fixa (ex.: `slug → design → source → decompose-confirm → bi-ratified → materialized → summaries → reviews → ready`). Script `scripts/assert-creation-stage.js` (e helpers em `scripts/creation-gates.js` se couber):  
    - recusa avançar se o estágio atual não fechou (receipt fields / files);  
    - recusa declarar `ready` sem sequência;  
    - Stage 6/9 e resume leem esse stage como autoridade (já parcialmente previsto no creation-gate record).  
    Agente pode pular prosa; **não** fecha o plano sem o script exit 0.

12. **Fidelidade = prova, não volume de Red Flags.** Não adicionar paredes de rationalization como mecanismo principal. Cada Iron Law nova deste plano tem **1 exit code** ou **1 campo de receipt**. Pressure-tests documentam escapes (skip interview, skip debate, skip stage, more-text-worse) mapeados a detector/fail — não a “lembre-se do parágrafo”.

## Chosen approach

### Opções pesadas

| # | Abordagem | Resumo |
|---|-----------|--------|
| A | Prosa-only skill rewrite | Mais instruções; agentes pulam |
| B | Lint-only | Doc ok, processo não |
| C | **Full process + fidelity package (escolhida)** | Interview/debate/research + lints/receipts + **router/stage files** + **assert-creation-stage** + **BI draft-and-ratify** |
| D | BMAD-port profundo | Non-goal |
| E | Subagent “polícia” re-lê skill | Caro, não prova estado; rejeitado |

### Recomendação: **C**

- Interview em seções do `design.md`; template lazy.  
- Enforcer enxuto: lint + design-gates + weak + **creation stage assert**.  
- Research always multi-phase (repo-only) + anti-digest-vazio.  
- Always debate + anti-theater.  
- **Menos monólito, mais stage file + exit code.**

## Blast radius

| Superfície | Impacto | Contenção |
|------------|---------|-----------|
| Todo `project new plan` multi-phase | Mais turns + stage discipline | Só multi-phase; adopt/ad-hoc intactos |
| `lint-design.js` | Designs re-lintados no hot path | Stage 4 create; legado sem mass re-lint; adopt isento DESIGN |
| `project-create-plan.md` | Split em router + stage-N | Diff grande mas localizado; testes de string/wiring |
| creation-gates schema | Campo `stage` monotônico | Versionar schema 0.1; resume lê stage |
| Token / context | Stage file só do passo atual | **Reduz** carga vs monólito |
| BI UX | Draft agent + ratify user | Mais barato que blank prompt |

## Non-goals

- Portar BMAD technique CSV, 100+ ideas, progressive technique flow  
- Nova skill `advanced-elicitation`  
- Session-resume multi-dia estilo BMAD  
- Alterar Stage 8 (`review-plan`)  
- Forçar debate em ad-hoc / single-task / `adopt`  
- Research web  
- Escape `debate: skipped` no multi-phase  
- Migrar em massa designs legados  
- Substituir critic por consenso de painel  
- LLM-polícia que re-lê a skill inteira a cada turno  
- Engordar Red Flags como substituto de detector  

## Rejected alternatives

| Alternativa | Por que rejeitada |
|-------------|-------------------|
| `interview.md` canônico separado | Drift; seções no design.md |
| Lint-only / prosa-only | Não prova processo |
| Research condicional | User ratificou always repo digest |
| Ladder / skip debate | User chose always |
| BI blank-prompt (“must not pre-fill”) | Errado de produto; draft-and-ratify |
| Manter create-plan monólito + mais seções | Aumenta ignore rate |
| Polícia LLM re-read skill | Sem prova; custo alto |

## Open questions

1. **Nomes exatos dos stages** no enum monotônico — fechar na task de `assert-creation-stage` com fixture.  
2. **Quantos stage-N.md** (um por Stage 1–9 vs agrupar 8a/8a2/8b) — preferência v1: **um arquivo por Stage 1–9**; 8a/8a2/8b seções no `stage-8.md` (um load).  
3. **Onde mora o router** — `project-create-plan.md` vira o router (in-place) vs novo `project-create-plan-router.md` + shim; preferência: **in-place thin** + `project-assets/new-plan/stage-*.md` para não quebrar paths de teste existentes.  

## Self-review against code-quality gates

- **G1 read-before-claim:** applied — sintomas citam brainstorm B1, lint-design REQUIRED, create-plan monólito (sessão 2026-07-30).  
- **G2 soft-language:** applied.  
- **G6 reference-or-strike:** decisões novas = design; comportamento atual verificado na sessão de create.
