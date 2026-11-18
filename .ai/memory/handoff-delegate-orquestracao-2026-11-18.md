---
name: handoff-delegate-orquestracao-2026-11-18
description: Passagem da orquestração do delegate para o Antigravity (agy) em 18/11/2026 — estado de cada tarefa, fila em ordem, regras de custo e como operar
metadata:
  type: project
---

# Passagem: orquestração do delegate (18/11/2026, 10h15 GMT-3)

O operador (Henry) passou a orquestração desta frente do Claude para um agente no **Antigravity**. O limite semanal do Claude dele está em 89% e precisa durar até quinta 20/11. Claude entra só em sessões curtas de conferência.

## Como operar

1. Abra a skill `atomic-skills:delegate` e siga o texto dela. Você é o orquestrador: escreve cartão, confere e decide; não implementa e não entrega a tarefa a um subagente da sua própria família.
2. Antes de cada leva: `python3 ~/.agent/atomic-skills/_assets/delegate.py profiles`, mostre a tabela (tarefa, papel, modelo, executor, revisor) e espere o **sim** do operador.
3. Rode tudo pelo runner (`delegate.py run`) e grave o veredito (`delegate.py record`), inclusive quando falhar. Log único: `~/.atomic-skills/delegate/runs.jsonl`. Cartões: `~/.atomic-skills/delegate/cards/<projeto>/`.
4. Nada de `push`, merge em `main` ou PR sem o operador pedir. Um worktree por tarefa, em `.worktrees/` do repo.

## Regras de custo (decisão do operador, 18/11)

- **`flash` (DeepSeek V4.1 Flash) é o executor padrão** para tudo que fizer sentido sem comprometer a qualidade. Nunca como revisor.
- Depois de **uma** falha do `flash` num cartão, suba para `codex`; não repita.
- **Nunca** use modelo caro por conta própria: nada de `gpt-6-astra`, `kimi`, Claude pelo `agy` ou esforço xhigh sem mostrar o custo e receber o sim. O `gpt-6-astra` esgotou a janela do Codex em seis execuções.
- A cota do OpenCode Go é **compartilhada** entre os modelos; a do Codex e a do Antigravity são separadas.
- Você orquestra no Antigravity: **não** use o perfil `agy` como executor (é a sua própria cota e família). Revisor de trabalho do `flash`: `codex-review`; se o Codex estiver sem cota, `hy4-review`.
- Cotas em 18/11: OpenCode Go e Codex voltam por volta de **12h44** (ambos estouraram a janela de 5 horas).

## Estado das tarefas

| Id | O quê | Onde | Estado |
|---|---|---|---|
| AS-D1, AS-D2, AS-D3 | Delegate: Codex, correção do `agy-review`, estratégia de modelos, texto neutro | `atomic-skills`, ramo `feat/delegate-skill` em `df498a97` (local, sem push), **instalado** | AS-D1 e AS-D2 revisados. **AS-D3 sem revisão**: gate verde (72 testes do runner; 1255 de 1257 na suíte). Cartão de revisão pronto: `cards/atomic-skills/AS-D3-R1-review.md` (`codex-review`) |
| MI-T1 | Efeito `textBlock` no motor | `/Volumes/External/code/minimalist-installer/.worktrees/text-block`, ramo `feat/text-block-effect` em `0e12991` | Gate verde (168 testes). Rodadas 0 e 1 revisadas. **Falta revisar a rodada 2** (commit `0e12991`, escrito pelo `agy`): `cards/minimalist-installer/T1-R3-review.md` (`codex-review`). Depois: o operador decide merge e publicação |
| RR-T3a | Núcleo do `remote-runner` | `/Volumes/External/code/remote-runner/.worktrees/core`, ramo `feat/core` | Gate no Mac 78/78 e teste real no Ultron ok. **Pendências:** (1) a suíte do projeto falha quando roda no Linux (38 de 78 passam no Ultron); (2) falta revisão de outra família do trabalho de correção (escrito por Codex e `agy`) |

## Fila, em ordem de prioridade

1. **AS-D4 — modo encadeado, `status`, `pause`, limite de simultâneos.** Cartão pronto: `cards/atomic-skills/AS-D4-pipeline-status.md`. Executor `flash`; revisor `codex-review`. Criar worktree `feat/delegate-pipeline` a partir de `feat/delegate-skill`, com `npm ci`. Gate: `npm test`, `npm run validate-skills`, `npm run check-docs`. É o que reduz os turnos de qualquer orquestrador a um por tarefa; depois de entrar, **use `pipeline`** nas tarefas seguintes e reinstale com `node bin/cli.js install --yes` na raiz do repo.
2. **Revisões pendentes** (AS-D3, MI-T1 rodada 2, RR-T3a) com `codex-review` quando o Codex voltar; achados reais voltam como cartão de correção para `flash`.
3. **RR-T3a: suíte no Linux.** Cartão a escrever: reproduzir com `ultron run -- 'npm test'` (ou o próprio `remote-runner`), achar a causa (os dublês de `ssh`, `ps`, `setsid`, `timeout` em `test/fixtures/bin/` foram escritos no macOS) e corrigir sem mudar comportamento. Executor `flash`.
4. **T2 — instruções globais pelo instalador do atomic-skills.** Cartão a escrever. Depende do MI-T1 revisado, com merge e com o pin do motor atualizado em `package.json` (`@henryavila/minimalist-installer` é fixado por commit). O que se quer: item **opcional** no instalador que grava, com o efeito `textBlock`, um bloco gerenciado no arquivo global de instruções de cada agente instalado (Claude `~/.claude/CLAUDE.md`; os dos outros hosts precisam ser confirmados na documentação de cada um), com a regra de delegação em papéis neutros; o texto aparece antes de gravar; a desinstalação remove só o bloco. **Regra dura do repo:** toda mutação do instalador tem reversão e passa em `tests/install-uninstall-roundtrip.test.js` (ver `CLAUDE.md`, "Install / Uninstall parity").
5. **Adiados:** `remote-runner` `setup-client`/`teardown`/`provision` (T3b, T3c) e a detecção automática de host no delegate. O comando `ultron` atual atende por ora.

## Armadilhas vistas hoje

- **Codex não commita em worktree** (o sandbox nega o `index.lock`): o registro vem com `"uncommitted": true`; leia o diff, commite e anote em `--deviation`.
- **Antigravity em modo plano** devolveu um plano pedindo aprovação em vez da revisão. O AS-D3 tirou o `--mode plan` e passou a exigir a linha `TOTAL major=… medium=… minor=…`.
- **Revisão cruzada é indispensável:** no MI-T1, com gate verde, o revisor provou que a desinstalação apagava um arquivo que o instalador não criou.
- **Dublê de `ssh` não substitui host real:** o RR-T3a passava em 53 testes e falhava na primeira sincronização contra o Ultron (raiz remota é link simbólico).
- **`install --yes --force-adopt` sobrescreveu 8 arquivos `kept-local`** do provedor `agy` no Cursor, Antigravity e Grok. Não usar sem o operador.
- O `~/.claude/CLAUDE.md` global do operador ainda cita `deepseek-pro` e `deepseek-light`; o perfil certo agora é `flash`. Avisar, não editar.

## Pesquisa de modelos (18/11), resumo

Terminal-Bench 4.1 independente: `gpt-6.1-sol` 60,9%; `gpt-6-astra` 60,3% (5x os créditos); `gemini-4-hydrogen` 56,4%; `deepseek-v4.1-flash` 38,5% (cerca de US$ 0,035 por sessão, teto de US$ 20 por janela); `glm-5.3-flash` 37,0%; `hy4` 37,9%; `kimi-k3.1-pro` 59,7% (3 sessões por janela); `deepseek-v4-pro` 6,7% (removido). Não liberar no painel do OpenCode modelos que treinam com os dados (`muse-spark`, `iceman`, `big-pickle`, `inkling`, `flint`, `nemotron`).
