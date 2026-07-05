# project — `help` (GPS de terminal · lazy detail)

Loaded by the `project` router for: `help`, `help --html`, and the alias `next`.

`help` responde numa tela *"onde estou e qual o próximo passo?"* — o padrão BMAD, mas **derivado do estado real** (`.atomic-skills/`) e do grafo de transições, não de um roteiro codificado. É a camada "GPS" de terminal: complementa o HTML (que ensina o sistema) e o aiDeck (que mostra o estado vivo). `help` e o guia visual são o MESMO conceito em dois renderizadores — por isso `help --html` abre a versão visual.

> **Status desta fase (F0 — contrato + esqueleto).** Este arquivo estabelece o **contrato** e o esqueleto do comando. A classificação estado→próximo-passo (`scripts/compute-help.js`) chega em F1; o render do bloco de ensino + o mini-mapa ASCII + a flag `--html` chegam em F2. Até lá, `help` cai no resumo no-args (fail-open, abaixo).

---

## Contrato (não-negociável)

`help` é **read-only, zero-mutação, fail-open** — como o resumo no-args:

- **Read-only / zero-mutação.** Nunca escreve estado, nunca roda um verifier, nunca toca o aiDeck nem gera o HTML. Toda leitura usa `{{READ_TOOL}}` / `{{BASH_TOOL}}` sobre `.atomic-skills/`.
- **Fail-open.** Qualquer erro de leitura → emite o que conseguiu e sai `0`; nunca aborta.
- **Não recomputa o comando.** O próximo passo (`nextStep.command`) vem **exclusivamente** do campo `nextAction` persistido — que `project-transitions.md` step 3b já autora a cada `done`/transição. `help` **lê** esse ponteiro verbatim; a lista de precedência só fornece o comando quando `nextAction` está ausente/vazio (marcado como fallback). Isso garante que `help` e a linha `NEXT` do no-args **nunca divirjam**.
- **Não substitui o no-args.** O resumo de 5 linhas continua sendo o resumo barato; `help` é a view de ensino mais rica (mini-mapa + porquê + escapes) — chega em F2.

## Resolução do alvo

Resolve o projeto/plano/fase **ativos** com a mesma resolução do `status` / no-args (nested-first, flat-fallback): enumera `.atomic-skills/projects/*/`, lê o `PROJECT-STATUS.md` do projeto, acha o plano ativo + `currentPhase` e a initiative da fase. Ambíguo (>1 projeto/plano no branch) → cai na disambiguation já existente em `project-view.md`. Sem `.atomic-skills/` → estágio *setup*.

## Render (esqueleto — implementado em F2)

O bloco de ensino de terminal + o mini-mapa ASCII da espinha (com "você está aqui") são renderizados a partir do JSON de `scripts/compute-help.js` (F1) por um formatador puro `formatHelp(json)` (F2). Forma-alvo:

```
VOCÊ ESTÁ AQUI   <plano-slug> · <fase-id> (<fase-summary>) — estágio <N>/<M> do ciclo
FEITO            fases <done>/<total> · tasks <done>/<total> · <B> blocked
PRÓXIMO PASSO    → <nextAction>            <razão de 1 linha>
POR QUÊ          <o gate/condição que esse passo satisfaz>
SE TRAVAR        → project why <id>   ·   project status --browser   ·   project help
GUIA VISUAL      → project help --html      (abre a doc visual no navegador)
```

Enquanto F2 não landa, `help` imprime o resumo no-args (a fonte barata já correta) e diz que o render completo está por vir.

## `help --html` (esqueleto — implementado em F2)

Abre o guia visual pelo **caminho de contrato fixo** `docs/design/project-onboarding/index.html` (a mesma doc que `help` ensina, noutro renderizador). Resolução: caminho fixo presente → abre com o mecanismo de `status --browser` (`open`/`xdg-open`) atrás de uma checagem de existência; ausente → mensagem clara apontando o caminho esperado + exit `0` (fail-open, nunca erro). Sem fallback configurável, sem dependência de rede. A linha GUIA VISUAL só aparece no `help` sem-flag quando o arquivo existe.
