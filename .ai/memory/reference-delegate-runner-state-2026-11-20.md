---
name: reference-delegate-runner-state-2026-11-20
description: Estado da skill delegate e do remote-runner em 20/11/2026 — o que entrou no main, como testar, o que falta
type: reference
---

# Skill `delegate` e `remote-runner`: estado em 20/11/2026

## O que está no main

- **Executor remoto** (PR 61): `delegate.py run --host <nome>` manda a tarefa por `remote-runner`, só um bundle git em pasta de preparo, e traz os commits de volta (avanço direto ou `refs/delegate/<id>`). O resultado só é aceito com o token da própria execução.
- **Limite por inatividade, checkpoint e retomada** (PR 62): `--idle-timeout` (20 min) grava `stalled`; `--timeout` (240 min) grava `timeout`. Uma execução local parada grava o commit `<ID>: work in progress (checkpoint by the delegate runner)` e `<ID>.resume.md`; `run --resume` continua dali. Opções de tempo aceitam `300s`, `90m`, `2h`; número sem unidade é segundo; abaixo de 60 s só com `--allow-short-timeout`.
- **Bateria dividida por área**: `tests/delegate-runner-*.test.js` com ajudantes em `tests/helpers/delegate-runner-kit.js`; `npm run test:delegate` leva cerca de 65 s.
- **Regras de cartão** na skill e no modelo: um assunto por cartão (até cinco requisitos), testes da área durante o trabalho, verificação equivalente ao CI antes do push.

- **Máquina de cada execução** (23/11): todo registro `run`/`pipeline` tem `machine` (nome do `--host` ou hostname curto local, preenchido em `append`). Execução `--host` fica listada em `delegate/running-remote/<executor>-<id>-<token>.json` enquanto roda; não é slot e não conta em `DELEGATE_MAX_*`. O `kill` só casa e sinaliza slots locais e nunca trata arquivo remoto como alvo (mas, como todo leitor de slots, dispara a limpeza de arquivo remoto velho). O runner publica e remove o arquivo sob um lock próprio (`running-remote/.lock`, nunca o `SlotLock`: um teste exige que execução `--host` nem crie `running/`). Runner morto → arquivo limpo na próxima leitura e um registro `runner_lost`, a não ser que o log já tenha registro com o mesmo `active_token` (o `started` do arquivo é anterior ao do registro e não serve de prova). Arquivo sem identidade do runner fica enquanto o pid viver e some com pid morto ou depois de `expires`. `status` mostra a máquina (coluna depois do papel) e `status --json` lista as execuções ativas para o painel.

- **Repositório e marco de cada execução** (23/11): todo registro `run`/`pipeline` tem `repo` e `milestone`, preenchidos em `append` a partir de `ATTRIBUTION`, que `run`, `pipeline` e `review-pending` definem uma vez (`set_attribution`). `repo` é `owner/name` do origin (sem host nem credenciais) ou o nome da pasta do repositório principal (pelo `--git-common-dir`, igual em toda área de trabalho ligada); `null` fora do git. `--milestone <id>` (`[A-Za-z0-9._-]{1,64}`, validado pelo argparse, saída 2) vai também para o arquivo de revisão pendente. Slots, arquivos remotos ativos e `status --json` levam os dois campos; o registro `runner_lost` usa os do slot, não os do comando que o encontrou.

## Como verificar

- `npm test`, `npm run test:delegate` (também com `DELEGATE_TEST_PYTHON=/usr/bin/python3`), `npm run validate-skills`, `npm run check-docs`.
- Linux: `ultron run -- 'npm run -s test:delegate'` a partir de uma pasta em `/Volumes/External/code`.

## Armadilhas encontradas

- A checagem de progresso precisa de `git --no-optional-locks status`; sem isso o `git commit` do executor falha de vez em quando com `index.lock`.
- Qualquer código que rode git entre a publicação do slot e o `try` de `wait_for_exit` abre uma janela em que um sinal de parada encerra o runner sem gravar registro. O `ProgressWatch` é criado dentro do `try` por isso.
- Em área de trabalho ligada, um link `node_modules -> ../../node_modules` não era ignorado por `node_modules/` e entrou num commit com `git add -A`; ao chegar no main substituiu a pasta real. O `.gitignore` agora tem `node_modules` sem barra (PR 63).
- Os testes usam `--timeout 1`; os ajudantes acrescentam `--allow-short-timeout`. Um teste da recusa passa `DELEGATE_TEST_STRICT_TIME`.

## Teste real no Ultron (20/11)

`run --host ultron` com uma tarefa mínima passou com `flash` (18 s), `codex` (21 s) e `agy` (35 s): commit feito lá e trazido como avanço direto. O Antigravity 1.5.13 (Ultron) passou a tratar o argumento seguinte a `-p` como prompt; o runner agora chama `agy --model … --output-format text` sem `-p` e manda o prompt pela entrada padrão, o que funciona na 1.5.12 (Mac) e na 1.5.13.

## O que falta

- `profiles --host` mostra `ready` para OpenCode e Antigravity mesmo sem login, porque o `remote-runner` não consegue conferir essas sessões.
- Execução remota não tem limite por inatividade nem checkpoint.
- O `remote-runner` não está publicado no npm; no Mac ele está no PATH por um link em `~/.local/bin/remote-runner`.
- Nova versão do atomic-skills pela skill `release`.
