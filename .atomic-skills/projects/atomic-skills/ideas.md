# 💡 Ideas — atomic-skills

> Inbox de ideias cruas. Capture com `/atomic-skills:project idea`; promova com `idea promote <n>`. Não edite os ids.

## #1 · Mode 2 — tier de executor Anthropic (Sonnet/Haiku)
`2026-06-09 · branch:main · status:pending · scope:skills/shared/mode2-codex-lane.md + implement/parallel-dispatch; sem mudança de schema · context:Só vale construir quando houver regime justificador: billing por token no Claude, OU decisão de adicionar hint de model-tier por task ao parallel-dispatch`

Adicionar o tier de subagent Anthropic (Sonnet/Haiku) ao Mode 2, por cima da lane Codex v1 — Opus nunca executa, tier barato nunca se auto-certifica (verify-on-done), lane atrás do condicional Claude-Code-only (investigator do Gemini é read-only). Plano original arquivado em .atomic-skills/projects/atomic-skills/mode2-anthropic-subagent-tier/ (3 tasks esboçadas: confirmar regime, decidir parallel-dispatch-hint vs lane própria, construir). Migrado de plano para ideia em 2026-06-09: era um tracker de deferimento sem trabalho iniciado.

## #2 · Reavaliar porting BMAD (party-mode / doc-architect)
`2026-06-09 · branch:main · status:pending · context:Premissas: debate cobre party-mode parcialmente; refactor-doc-architect segue pausado — se ambos morrerem, esta ideia volta a crescer`

Pesquisa de viabilidade/design/custo de portar party-mode e absorver conceitos do doc-architect como skills atômicos. Plano original arquivado em .atomic-skills/projects/atomic-skills/bmad-porting-research/ (gates: design doc do party-mode skill; mapeamento doc-architect → review-code/hunt/review-plan). Migrado de plano para ideia em 2026-06-09: 0/2 tasks após 2 semanas, e o escopo foi parcialmente superseded — o skill atomic-skills:debate já cobre o conceito party-mode (multi-persona com subagents reais) e refactor-doc-architect é um plano dedicado. Resta avaliar se sobra algo do BMAD que ainda valha portar.
