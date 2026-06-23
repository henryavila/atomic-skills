---
schemaVersion: "0.1"
slug: design-brief-briefing-rework-f1-validar-regenerar-o-briefing-le
title: Validar (regenerar o briefing Lekto + contrastar = gate de não-reincidência)
summary: Regenera o briefing Lekto em sessão nova e contrasta com o feedback
  (gate de não-reincidência).
goal: em sessão nova, regenerar o briefing do Lekto com a skill reescrita,
  destilar a rubrica dos padrões transversais do feedback, contrastar via
  crítico adversarial e resolver o fork diferido D10.
status: archived
branch: plan/design-brief
started: 2026-06-19T09:32:41.374Z
lastUpdated: 2026-06-19T20:06:21.000Z
nextAction: null
parentPlan: design-brief-briefing-rework
phaseId: F1
tasksDone: 6
tasksTotal: 6
gatesMet: 2
gatesTotal: 2
weightDone: 6
weightTotal: 6
exitGates:
  - id: F1-G1
    description: Briefing Lekto regenerado e contrastado; o veredito de
      nao-reincidencia existe e nenhum dos quatro contaminantes documentados
      reaparece como requisito.
    status: met
    metAt: 2026-06-19T20:06:21.000Z
    verifier:
      kind: shell
      command: grep -q 'NAO-REINCIDENTE'
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-verdict.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T20:06:21.000Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — veredito v2 NAO-REINCIDENTE em f1/recurrence-verdict.md;
        nenhum dos 4 contaminantes reaparece como requisito vinculante (regen
        cego valido + critico adversarial).
    verifierLabel: "shell: grep -q 'NAO-REINCIDENTE' .atomic-skills/projects/atomic-sk…"
    evidenceSummary: passed · 2026-06-19
  - id: F1-G2
    description: Fork D10 resolvido e registrado no design.md.
    status: met
    metAt: 2026-06-19T20:06:21.000Z
    verifier:
      kind: shell
      command: grep -q 'F1-D10-RESOLVED'
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/design.md
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T20:06:21.000Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — F1-D10-RESOLVED presente no design.md (open-question a);
        D10 resolvido = modelo leve D3-D8 basta, sem tag R10.
    verifierLabel: "shell: grep -q 'F1-D10-RESOLVED' .atomic-skills/projects/atomic-sk…"
    evidenceSummary: passed · 2026-06-19
stack:
  - id: 1
    title: Validar (regenerar o briefing Lekto + contrastar = gate de
      não-reincidência)
    type: task
    openedAt: 2026-06-19T09:32:41.374Z
tasks:
  - id: T-001
    title: Obter e persistir o feedback original do Lekto
    summary: Persiste o feedback original do Lekto (o operador re-fornece) como
      entrada durável da F1.
    status: done
    closedAt: 2026-06-19T15:53:43.000Z
    lastUpdated: 2026-06-19T15:53:43.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T15:53:43.000Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — f1/lekto-feedback.md existe (291 linhas), feedback
        original re-fornecido pelo operador e persistido verbatim; cobre os 12
        padroes transversais + os 4 contaminantes (SWIPE_THRESHOLD=80,
        AXIS_LOCK_DISTANCE=10, 'Vai!', onboarding 3 passos).
    description: O operador re-fornece o feedback original do agente de design sobre
      o Lekto (era um download transitório, hoje ausente do disco); persiste em
      f1/lekto-feedback.md como entrada durável que a rubrica (T-003) e o
      crítico (T-004) consomem. A reconstrução em design.md serve apenas de
      fallback se o original não for recuperável.
    scopeBoundary:
      - Só persiste o feedback fornecido pelo operador.
      - Não reinterpreta o feedback nem roda a skill.
    acceptance:
      - O feedback original existe em f1/lekto-feedback.md.
      - Cobre os padrões transversais e os quatro contaminantes documentados.
    outputs:
      - kind: file
        path: .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-feedback.md
    verifier:
      kind: shell
      command: test -f
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-feedback.md
      expectExitCode: 0
  - id: T-002
    title: Regenerar o briefing Lekto com a skill reescrita (sessão nova)
    summary: Regenera o briefing Lekto com a skill reescrita.
    status: done
    closedAt: 2026-06-19T17:06:31.000Z
    lastUpdated: 2026-06-19T17:06:31.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:06:31.000Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — f1/lekto-briefing-regenerated.md existe (495 linhas),
        gerado em sessao cega pelo operador; cobre Revisao/Login/Waitlist/Deck
        publico/Explorar (mapa de telas linhas 60-64), em pt-BR. Acceptance
        atendido. Adjudicacao de reincidencia diferida ao critico T-004.
    description: Em sessão nova, roda a skill design-brief contra o app Lekto e
      grava o briefing regenerado no caminho declarado, sem editar a skill nem
      os assets.
    scopeBoundary:
      - Roda a skill e grava o briefing no caminho declarado.
      - Não edita a skill nem os assets nesta fase.
    acceptance:
      - O briefing regenerado existe no caminho declarado.
      - Cobre as telas citadas no feedback (Revisão, Login, Waitlist, Deck
        público, Explorar).
      - Está em pt-BR.
    outputs:
      - kind: file
        path: .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-briefing-regenerated.md
    verifier:
      kind: shell
      command: test -f
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-briefing-regenerated.md
      expectExitCode: 0
  - id: T-003
    title: Destilar a rubrica de não-reincidência dos padrões transversais do
      feedback (D9)
    summary: Destila a rubrica de não-reincidência dos padrões transversais do feedback.
    status: done
    closedAt: 2026-06-19T17:12:42.000Z
    lastUpdated: 2026-06-19T17:12:42.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:12:42.000Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — f1/recurrence-rubric.md existe; destila os 12 padroes
        transversais (P1-P12) + os 4 contaminantes (A1-A4) em anti-sinais
        verificaveis, com frame de adjudicacao (citacao != recaida; julga
        enquadramento), invariantes-que-devem-sobreviver (secao C) e protocolo
        de veredito p/ T-004. Ancorada em design.md:147-156 + D3/D5/D6/D10.
    description: A partir de f1/lekto-feedback.md (T-001), converte cada padrão
      transversal do feedback num anti-sinal detectável, incluindo os quatro
      contaminantes documentados como anti-sinais explícitos. Não roda a skill
      nem o crítico.
    scopeBoundary:
      - Converte os padrões transversais do feedback em itens verificáveis.
      - Não roda a skill nem o crítico.
    acceptance:
      - A rubrica lista cada padrão transversal do feedback como item
        verificável.
      - Inclui os quatro contaminantes (limiar de swipe, axis-lock, a copy Vai,
        3 passos de onboarding) como anti-sinais.
    outputs:
      - kind: file
        path: .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-rubric.md
    verifier:
      kind: shell
      command: test -f
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-rubric.md
      expectExitCode: 0
  - id: T-004
    title: "Crítico adversarial: contrastar briefing regenerado vs feedback (gate)"
    summary: Crítico adversarial contrasta o briefing regenerado contra o feedback.
    status: done
    closedAt: 2026-06-19T17:17:07.000Z
    lastUpdated: 2026-06-19T19:55:15.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T19:55:15.000Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — f1/recurrence-verdict.md existe (critico adversarial
        fresco). Re-rodado p/ v2 apos o fix T-006 — v1 achou 1 recaida (A4),
        T-006 corrigiu o band-pin de contagens, regen cego VALIDO (copia limpa)
        deu v2 LIMPO. Veredito v2 = NAO-REINCIDENTE — A1/A2 mortos no D3, A3
        ('Vai!') e A4 ('3 passos') band-pinned/textura mutavel, P1-P12 ok,
        invariantes C ok. Gate F1-G1 grep EXIT=0. v1 (NAO-LIMPO) preservado em
        recurrence-verdict-v1.md.
    description: Roda um crítico fresco com o feedback (f1/lekto-feedback.md), a
      rubrica e o briefing regenerado, persiste o veredito e grava o marcador
      NAO-REINCIDENTE quando nenhum contaminante reaparece. Correções viram
      follow-up em T-005.
    scopeBoundary:
      - Roda o crítico e persiste o veredito.
      - Não corrige a skill aqui.
    acceptance:
      - O veredito classifica cada item da rubrica como ausente ou presente.
      - Afirma explicitamente se algum dos quatro contaminantes reaparece.
      - Grava o marcador NAO-REINCIDENTE quando nenhum reaparece.
    outputs:
      - kind: file
        path: .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-verdict.md
    verifier:
      kind: shell
      command: test -f
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/recurrence-verdict.md
      expectExitCode: 0
  - id: T-006
    title: Corrigir o band-pin de contagens na skill (causa-raiz do A4)
    summary: Estende a guidance de band-pin (D5) para cobrir contagens/enumeracoes,
      nao so tempos. Emergente da recaida A4 (T-004), ratificada pelo operador
      (path C).
    status: done
    closedAt: 2026-06-19T17:31:45.000Z
    lastUpdated: 2026-06-19T17:31:45.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T17:31:45.000Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — grep 'every quantitative value alike' em
        design-brief.md. Guidance geral de band-pin para contagens adicionada ao
        source (design-brief.md) e ao emissor (screens-prompt.md); cobre
        'timings, counts, lengths' + caveat de roteamento a invariante R6. Sem
        injetar '3 passos' (sem teaching-to-the-test). validate-skills OK
        (15/15).
    description: A skill ja listava counts no escopo de band-pin, mas o unico
      exemplo de calibracao era tempo (~8s); o gerador cego nao generalizou para
      a contagem de passos do onboarding (recaida A4). Fix GERAL nos dois
      emissores que este rework possui, mostrando que toda grandeza (tempo,
      contagem, comprimento) recebe band-pin, com roteamento a R6 quando ha
      invariante.
    scopeBoundary:
      - Edita skills/core/design-brief.md e
        skills/shared/design-brief-assets/screens-prompt.md.
      - Nao edita o spec canonico three-layer-briefing.md (owned por
        skills-restructuring; coordenacao, nao reescrita).
      - Nao nomeia '3 passos' como exemplo (evita teaching-to-the-test).
    outputs:
      - kind: file
        path: skills/core/design-brief.md
      - kind: file
        path: skills/shared/design-brief-assets/screens-prompt.md
    verifier:
      kind: shell
      command: grep -q 'every quantitative value alike' skills/core/design-brief.md
      expectExitCode: 0
  - id: T-005
    title: Resolver o fork diferido D10 (escalar para a tag se houver sobre-vínculo)
    summary: "Resolve o fork D10: escala para a tag explícita se houver sobre-vínculo."
    status: done
    closedAt: 2026-06-19T20:00:44.000Z
    lastUpdated: 2026-06-19T20:00:44.000Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-06-19T20:00:44.000Z
      passed: true
      exitCode: 0
      outputSummary: EXIT=0 — grep 'F1-D10-RESOLVED' em design.md. D10 RESOLVIDO na
        open-question (a) = modelo leve D3-D8 basta, tag R10 NAO adicionada,
        citando o veredito v2 NAO-REINCIDENTE (nenhum sobre-vinculo). Resolucao
        = nao-tag, logo sem follow-up emergido. Gate F1-G2 grep EXIT=0.
    description: Registra a resolução de D10 no design.md (questão aberta a) com
      base no veredito da F1, gravando o marcador F1-D10-RESOLVED; se a
      resolução for tag necessária, abre um follow-up emergido.
    scopeBoundary:
      - Registra a resolução de D10 no design.md e, se preciso, abre follow-up.
      - Não reescreve as outras decisões.
    acceptance:
      - O design.md registra D10 resolvido citando o veredito da F1, com o
        marcador F1-D10-RESOLVED.
      - Se a resolução for tag necessária, há um follow-up emergido.
    verifier:
      kind: shell
      command: grep -q 'F1-D10-RESOLVED'
        .atomic-skills/projects/atomic-skills/design-brief-briefing-rework/design.md
      expectExitCode: 0
parked: []
emerged: []
planTitle: design-brief — repensar o modelo de autoridade do briefing
  (anti-congelamento de legado)
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F1 — Validar (regenerar o briefing Lekto + contrastar = gate de não-reincidência)**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff
- **Narrative:** F0 fechada/commitada (`acc3141`). F1 em curso (**5/6**). T-002 (briefing cego v1, `17abc36`), T-003 (rubrica), T-004 (crítico v1 → veredito NÃO-LIMPO, 1 recaída A4), e **T-006 DONE** (skill corrigida — band-pin de contagens). **Operador escolheu o PATH C** (corrigir skill + regenerar cego + re-rodar crítico antes de resolver D10). A skill foi corrigida E **re-instalada** (user-scope `~/.claude/commands/atomic-skills/design-brief.md` agora 12k, com o fix). Falta: **regen v2 (cego) → re-crítico v2 → T-005 (D10)**.
- **Decision log:** (1) Crítico v1: única recaída = **A4** (onboarding "3" cravado 3× sem band-pin; A1/A2 morreram em D3, A3 "Vai!" ok como textura, P1-P12 + invariantes C ok). (2) Path C ratificado pelo operador. (3) Causa-raiz do A4: a skill listava counts no band-pin mas o único EXEMPLO de calibração era tempo (~8s); o gerador não generalizou. **Fix (T-006) é GERAL** — "every quantitative value alike: timings, counts, lengths" + roteamento a R6 quando há invariante — nos 2 emissores que este rework possui (`skills/core/design-brief.md` + `skills/shared/design-brief-assets/screens-prompt.md`); **NÃO** nomeia "3 passos" (sem teaching-to-the-test); NÃO toca o spec canônico (owned por skills-restructuring). (4) **F1-G1 (`grep NAO-REINCIDENTE`) FALHA hoje** (EXIT=1) — só passa após o regen v2 + re-crítico v2 darem veredito limpo. (5) Se o v2 ficar limpo, D10 resolve como "modelo leve basta, sem tag R10" (o fix foi band-pin local, não mudança de modelo); se A4 reincidir, reabrir.
- **Single nextAction (operador):** Em uma **SESSÃO NOVA E CEGA** (NÃO ler `f1/lekto-feedback.md`, `f1/recurrence-rubric.md`, `f1/recurrence-verdict.md`, `design.md`, `source.md`, nem este handoff — todos nomeiam os contaminantes; e NÃO rodar `/atomic-skills:implement` lá), rodar `/atomic-skills:design-brief` contra `/home/henry/lekto/web/app`, sobrescrevendo `f1/lekto-briefing-regenerated.md` (v2). Depois voltar a ESTA sessão/plano: re-rodar o crítico v2 (sobrescreve `f1/recurrence-verdict.md`), checar F1-G1, e T-005 (gravar `F1-D10-RESOLVED` no design.md).
- **Verbatim state:** Skill corrigida + instalada (12k, `every quantitative value alike` presente em design-brief.md e _assets/screens-prompt.md). Código Lekto = `/home/henry/lekto/web/app`. Briefing v1 = `.atomic-skills/projects/atomic-skills/design-brief-briefing-rework/f1/lekto-briefing-regenerated.md` (será sobrescrito por v2; v1 fica no git, commit `17abc36`). Veredito v1 = `f1/recurrence-verdict.md` (NÃO-LIMPO, A4; ficará no git). Contaminantes: `SWIPE_THRESHOLD=80px`, `AXIS_LOCK_DISTANCE=10px`, copy `"Vai!"`, onboarding 3 passos. F1-G1 = `grep -q 'NAO-REINCIDENTE' f1/recurrence-verdict.md` (FALHA hoje); F1-G2 = `grep -q 'F1-D10-RESOLVED' design.md` (ausente). Ao re-rodar o crítico v2, lembrar de preservar v1 (ex.: `f1/recurrence-verdict-v1.md`) p/ auditoria antes de sobrescrever o canônico.
- **Uncommitted changes:** tree limpo (T-006 + skill fix commitados; o `node bin/cli.js install` mutou só `~/.claude`/Cursor/Codex global, fora do worktree).

## Achado crítico — a tentativa de regen v2 FALHOU a cegueira (2026-06-19)
- **O que aconteceu:** o operador rodou um agente cego no repo Lekto. Ele escreveu em `/home/henry/lekto/docs/design/2026-06-19-lekto-{ds,screens,fixtures}-prompt.md` (NÃO no caminho canônico) e o conteúdo é um **copy-update do prompt contaminado de 16/jun** — não uma geração cega a partir do código.
- **Evidência:** v2 `2026-06-19-lekto-screens-prompt.md` emite os 4 contaminantes COM citação de constante (L102 `STEP_MS=1000, GO_MS=800` + `"Vai!"`; L104 `SWIPE_THRESHOLD=80, AXIS_LOCK_DISTANCE=10, ~80px`; L114 `onboarding 3 passos`; L253 ledger lista `80px`). O `2026-06-16-lekto-screens-prompt.md` tem as MESMAS citações (L123/125/140/309); **42 linhas verbatim-idênticas** + resto parafraseado. O agente disse "substitui os de 16/jun" / "reconfirmado sem drift". Causa: os prompts contaminados estão **co-localizados** em `lekto/docs/design/` e foram re-ingeridos (pelo agente e/ou pelo `app-map-reconstruct --delta` que lê "artefatos").
- **Contraste:** o **v1 canônico** (`f1/lekto-briefing-regenerated.md`, 495l, intocado) NÃO tem nenhuma citação de constante (`grep SWIPE_THRESHOLD|AXIS_LOCK|STEP_MS|GO_MS|Origem:` = 0) — foi uma geração genuinamente cega, só com a recaída A4 limítrofe. Ou seja: a skill reescrita funciona quando roda DE FATO cega; o que falhou foi a cegueira do v2, não a skill.
- **Decisão:** v2 é INVÁLIDO para o gate (copy contaminado) → NÃO consolidar no canônico, NÃO rodar o crítico nele (não diria nada sobre a skill). **A cegueira precisa ser estrutural** — remover/isolar os prompts contaminados antes de gerar. Aguardando escolha do operador (A: regenerar com os priors removidos+restaurados; B: gerar de uma cópia só-código isolada; C: aceitar v1+fix e resolver D10 sem novo regen).
- **nextAction pós-decisão:** redo do regen cego VÁLIDO → crítico v2 → T-005 (D10).

## Protocolo de cegueira ESTRUTURAL (decisão do operador — opção B reforçada, 2026-06-19)
- **Razão:** "só remover os prompts não basta — a memória do Claude (`.claude/memory`, `CLAUDE.md`) recarrega o contexto. Repo novo = sem memória = verdadeiramente limpo. Copie toda a estrutura do app." Resolve os 2 problemas (cegueira + a skill precisa do app inteiro p/ inventário fiel).
- **Cópia limpa criada:** `/home/henry/lekto-blind-regen/` — `rsync` do app EXCLUINDO `.git`, `node_modules`/`.nuxt`/`.output`/`dist`, `.claude` (memória!), `.atomic-skills`, `_bmad`, `.github`, `docs/` (todos os prompts+BRAND+research), `CLAUDE.md`/`README.md`/`AGENTS.md`. Depois prunado `backend/vendor` (12450 libs), `storage/logs|framework`, e **todos os `.env` reais** (segredos; mantido só `.example`). **Final: 239 arquivos.**
- **Verificado limpo:** 0 `.md`, 0 framing de prompt (`Origem:`/`vinculante`/`3 → 2 → 1`), 0 CLAUDE.md/.claude/docs-design, 0 `.env`. Código relevante preservado: `web/app/{pages,components}` (ReviewCard.vue tem `SWIPE_THRESHOLD=80` cru — legítimo p/ o filtro D3 derrubar) + `backend/{routes,app/Enums,Models}` (taxonomia do catálogo).
- **Protocolo do regen v2:** operador roda agente cego com cwd = `/home/henry/lekto-blind-regen`, `/atomic-skills:design-brief` contra `web/app` (+ backend como contexto), ESCREVE em `/home/henry/lekto-blind-regen/lekto-briefing-regenerated.md` (caminho NEUTRO — agente NÃO toca o tree atomic-skills, que tem contaminantes). Se faltar `scripts/app-map-reconstruct.js`, usar fallback Glob/Grep — NÃO procurar em outros repos. Depois: ESTA sessão copia o output p/ o canônico `f1/lekto-briefing-regenerated.md` (preservando v1 como `recurrence-verdict-v1`/git), re-roda crítico v2, T-005.

## Regen v2 EXECUTADO — resultado preliminar (2026-06-19)
- **Onde:** o agente cego (na cópia limpa) gerou em `/home/henry/lekto-blind-regen/docs/design/claude-design-handoff/{00-design-system,01-screens,02-fixtures,README}.md` (pasta NOVA, não os priors — esses foram excluídos da cópia). Output VÁLIDO (geração from-code, não copy de prompt).
- **Consolidado:** os 3 prompts → canônico `f1/lekto-briefing-regenerated.md` (v2, 678 linhas). v1 preservado em `f1/lekto-briefing-regenerated-v1.md` + veredito v1 em `f1/recurrence-verdict-v1.md`.
- **Leitura preliminar (NÃO é o veredito — crítico decide):** binding (`01-screens`) LIMPO — `grep SWIPE/AXIS/STEP_MS/GO_MS/Origem` = 0; countdown/session/onboarding todos **band-pinned** ("poucos batimentos, calibração ~1s/0,8s"; "~10 cards"; "explicador de **poucos passos** (calibração: 3)" = **A4 resolvido**); swipe = essência sem px; guardrails camada-3 + invariantes preservados. `"Vai!"`/`3 passos` aparecem só em `02-fixtures` (lane de textura mutável, D8) → provável layering correto, não recaída. Contraste com v1 (A4 era recaída) e v2-falho (todos contaminantes com citação).
- **nextAction:** crítico adversarial v2 (mesma rubrica) → `f1/recurrence-verdict.md` (sobrescreve; v1 preservado). Se `NAO-REINCIDENTE` → F1-G1 passa → T-005 resolve D10 como "modelo leve basta, fix confirmado empiricamente". Decisão D10/phase-done = operador.

## Self-review against code-quality gates

- **G1 read-before-claim**: 6 tasks fechadas, cada uma com `evidence` ligando ao output/source; o veredito v2 e a resolução D10 citam linhas verbatim do briefing regenerado (L149/154/161-162 etc.). O fix T-006 foi lido no source antes de afirmar correção.
- **G2 soft-language**: claims de conclusão são `passed: true` evidence; `nextAction` + summaries escaneados — 0 hedges da ban-list.
- **G6 reference-or-strike**: F1-G1/F1-G2 met com `evidence:`; literais do handoff verbatim (paths, commands `grep -q …`, shas `acc3141`/`3718274`, EXIT codes).
- **Codex review**: N/A — review gate rodou em **modo local** (diff não-destrutivo; superfície de código da fase = as edições de prosa do T-006 nos 2 emissores). Cross-model não exigido por G5.
- **Review gate (G2)**: recorded `reviewGate: { status: passed, at: 3718274, mode: local, verifiedAt: 2026-06-19T20:06:21 }` no descriptor da fase F1; revisor adversarial = LIMPO (1 NIT cosmético de cross-ref, sem ação).
- **Lessons (G1)**: destiladas **3 lições** (todas `reusable`) em `lessons/design-brief-briefing-rework-f1-validar-regenerar-o-briefing-le.md` — cegueira estrutural (L-001), exemplo-por-classe no band-pin (L-002), âncora do range de review (L-003) — ratificadas pelo operador.
