# project — `help` (GPS de terminal · lazy detail)

Loaded by the `project` router for: `help`, `help --html`, and the alias `next`.

`help` responde numa tela *"onde estou e qual o próximo passo?"* — o padrão BMAD, mas **derivado do estado real** (`.atomic-skills/`) e do grafo de transições, não de um roteiro codificado. É a camada "GPS" de terminal: complementa o HTML (que ensina o sistema) e o aiDeck (que mostra o estado vivo). `help` e o guia visual são o MESMO conceito em dois renderizadores — por isso `help --html` abre a versão visual.

> **Status desta fase (F2 — render de terminal).** `help` chama
> `scripts/compute-help.js --render` e imprime o bloco de ensino derivado do
> estado real. `help --html` abre o guia visual pelo caminho de contrato fixo.

---

## Contrato (não-negociável)

`help` é **read-only, zero-mutação, fail-open** — como o resumo no-args:

- **Read-only / zero-mutação.** Nunca escreve estado, nunca roda um verifier, nunca toca o aiDeck nem gera o HTML. Toda leitura usa `{{READ_TOOL}}` / `{{BASH_TOOL}}` sobre `.atomic-skills/`.
- **Fail-open.** Qualquer erro de leitura → emite o que conseguiu e sai `0`; nunca aborta.
- **Não recomputa o comando.** O próximo passo (`nextStep.command`) vem **exclusivamente** do campo `nextAction` persistido — que `project-transitions.md` step 3b já autora a cada `done`/transição. `help` **lê** esse ponteiro verbatim; a lista de precedência só fornece o comando quando `nextAction` está ausente/vazio (marcado como fallback). Isso garante que `help` e a linha `NEXT` do no-args **nunca divirjam**.
- **Não substitui o no-args.** O resumo de 5 linhas continua sendo o resumo barato; `help` é a view de ensino mais rica (mini-mapa + porquê + escapes) — chega em F2.

## Resolução do alvo

Resolve o projeto/plano/fase **ativos** com a mesma resolução do `status` / no-args (nested-first, flat-fallback): enumera `.atomic-skills/projects/*/`, lê o `PROJECT-STATUS.md` do projeto, acha o plano ativo + `currentPhase` e a initiative da fase. Ambíguo (>1 projeto/plano no branch) → cai na disambiguation já existente em `project-view.md`. Sem `.atomic-skills/` → estágio *setup*.

## Render

Para `help` normal e o alias `next`, execute com {{BASH_TOOL}} a partir da raiz
do repo e imprima `stdout` verbatim:

```bash
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/compute-help.js" --render "$PWD"
```

Esse comando é read-only, sempre sai `0`, e formata o JSON de
`scripts/compute-help.js` pelo formatador puro `formatHelp(json)`. O
`PRÓXIMO PASSO` exibido vem de `nextStep.command` verbatim; o render não deriva
fase, task nem comando a partir de fallback quando o helper já produziu um
comando persistido.

Forma-alvo do bloco:

```
VOCÊ ESTÁ AQUI   <plano-slug> · <fase-id> (<fase-summary>) — estágio <N>/<M> do ciclo
FEITO            fases <done>/<total> · tasks <done>/<total> · <B> blocked
PRÓXIMO PASSO    → <nextAction>            <razão de 1 linha>
POR QUÊ          <o gate/condição que esse passo satisfaz>
SE TRAVAR        → project why <id>   ·   project status --browser   ·   project help
GUIA VISUAL      → project help --html      (abre a doc visual no navegador)
```

Quando o plano ativo tem `executionMode: automate`, `help` / status **podem**
acrescentar uma linha read-only de **PLAN-END REVIEW** (receipt ausente /
`userValidatedAt` pendente / ok) — ver `{{ASSETS_PATH}}/project-drift.md`
§ *Plan-end receipt visibility*. Nunca muta; o HARD-BLOCK de
finalize/archive vive em `project-finalize.md` Step 1.7 e
`project-transitions.md` `archive` step 1b (`planEndReviewOk` +
`userValidationOk`; `--skip-plan-end-review` exige reason não-vazio).

Se a chamada acima não puder rodar ou produzir saída vazia, aplique fail-open:
imprima o resumo no-args quando ele já estiver disponível no contexto da
invocação, acrescente uma linha `SE TRAVAR` apontando para `project why`,
`project status --browser` e `project help`, e mostre o comando que falhou sem
interromper a sessão.

## `help --html`

Para `help --html`, execute com {{BASH_TOOL}} a partir da raiz do repo e imprima
`stdout` verbatim:

```bash
node "$(cat "$HOME/.atomic-skills/package-root" 2>/dev/null || echo .)/scripts/compute-help.js" --html "$PWD"
```

O caminho é fixo: `docs/design/project-onboarding/index.html`. O helper checa a
existência antes de abrir; arquivo ausente imprime o caminho esperado e sai `0`.
Falha do opener também sai `0` e imprime `Open manually: <file-url>`.

A abertura usa o mesmo contrato WSL-aware `open_url()` de `project-view.md`:
prefere `wslview`, usa `open` no macOS, cai para Windows `start` no WSL e só usa
`xdg-open` detached no Linux nativo. Não chame opener de plataforma fora desse
helper. Sem fallback configurável, sem dependência de rede. A linha GUIA VISUAL
só aparece no `help` sem-flag quando esse arquivo existe.
