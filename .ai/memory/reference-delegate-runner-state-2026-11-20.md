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

## Como verificar

- `npm test`, `npm run test:delegate` (também com `DELEGATE_TEST_PYTHON=/usr/bin/python3`), `npm run validate-skills`, `npm run check-docs`.
- Linux: `ultron run -- 'npm run -s test:delegate'` a partir de uma pasta em `/Volumes/External/code`.

## Armadilhas encontradas

- A checagem de progresso precisa de `git --no-optional-locks status`; sem isso o `git commit` do executor falha de vez em quando com `index.lock`.
- Qualquer código que rode git entre a publicação do slot e o `try` de `wait_for_exit` abre uma janela em que um sinal de parada encerra o runner sem gravar registro. O `ProgressWatch` é criado dentro do `try` por isso.
- Em área de trabalho ligada, um link `node_modules -> ../../node_modules` não era ignorado por `node_modules/` e entrou num commit com `git add -A`; ao chegar no main substituiu a pasta real. O `.gitignore` agora tem `node_modules` sem barra (PR 63).
- Os testes usam `--timeout 1`; os ajudantes acrescentam `--allow-short-timeout`. Um teste da recusa passa `DELEGATE_TEST_STRICT_TIME`.

## O que falta

- Teste real `run --host ultron` com um executor autenticado. Em 20/11 o caminho inteiro funcionou (envio, execução, volta do resultado), mas o OpenCode no Ultron respondeu `Model unavailable`: falta o login lá, feito pelo Henry.
- `profiles --host` mostra `ready` para o OpenCode mesmo sem login, porque o `remote-runner` não consegue conferir essa sessão.
- Execução remota não tem limite por inatividade nem checkpoint.
- O `remote-runner` não está publicado no npm; no Mac ele está no PATH por um link em `~/.local/bin/remote-runner`.
- Nova versão do atomic-skills pela skill `release` depois do teste real.
