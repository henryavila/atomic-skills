---
name: handoff-delegate-orquestracao-2026-11-18
description: Estado da frente delegate em 18/11/2026 à noite — skill fechada e instalada, o que espera decisão do operador, regras de custo e armadilhas
metadata:
  type: project
---

# Delegate: estado ao fim de 18/11/2026 (20h GMT-3)

Tudo consolidado em `main` e instalado para os seis agentes detectados (Claude Code, Cursor, Antigravity, Codex, OpenCode, Grok Build).

- **atomic-skills:** PR #54 com merge em `main` (`ebf5007f`): skill `delegate` (AS-D1 a AS-D7), a remoção de `plan`, `implement` e aiDeck (era o PR #53, fechado como substituído) e o pin do motor em `e37ae7f`. CI verde nos nove jobs.
- **minimalist-installer:** `textBlock` em `main` (`e37ae7f`, PR #4). Sem publicação no npm; o atomic-skills consome por commit.
- **remote-runner:** `feat/core` em `main` local (`637fe0c`); o repositório não tem remoto.

## Como operar

1. Abra a skill `atomic-skills:delegate` e siga o texto dela. O orquestrador escreve cartão, confere e decide; não implementa.
2. Antes de cada leva: `delegate.py profiles`, tabela (tarefa, papel, modelo, executor, revisor) e o **sim** do operador.
3. Tudo pelo runner (`delegate.py run`, ou `pipeline`) e veredito gravado (`delegate.py record`), inclusive quando falhar. Log: `~/.atomic-skills/delegate/runs.jsonl`. Cartões: `~/.atomic-skills/delegate/cards/<projeto>/`. Saídas: `~/.atomic-skills/delegate/out/<worktree>/`.

## Regras de modelo (decisões do operador, 18/11)

- **No OpenCode, só `opencode-go/deepseek-v4.1-flash`.** Os perfis `hy4-review`, `glm-flash` e `kimi` foram removidos; o runner recusa outro modelo do OpenCode.
- Seis perfis: `flash`, `flash-review`, `codex`, `codex-review`, `agy`, `agy-review`. Famílias: `deepseek`, `openai`, `gemini`.
- **Única regra de revisor: nunca a família que escreveu o código.** O Flash revisa trabalho do Codex e do agy. Rotas: trabalho do Flash → `codex-review`, depois `agy-review`; do Codex → `flash-review`, depois `agy-review`; do agy → `codex-review`, depois `flash-review`. O `pipeline` exige `--review-route`; as rotas padrão estão só no texto da skill.
- Flash como revisor: achou defeito grave real que o Sonnet não achou (MI-T1-F5, amostra de um). É lento (18 a 66 min) e, em código de sinais, uma revisão morreu pela própria sondagem: no cartão, proibir sondagens que mandem sinais.
- Nunca modelo caro sem mostrar o custo e receber o sim: `gpt-6-astra`, Claude pelo `agy`, esforço xhigh (o `agy-review` é xhigh).
- Cotas vistas hoje: Codex estourou duas vezes a janela de 5 horas (voltou 12h44 e 17h51); Antigravity sem cota até cerca de 17h21.

## O que falta

1. **T2 — instruções globais pelo instalador do atomic-skills** (desbloqueado: o motor com `textBlock` já está pinado). Item **opcional** do instalador que grava, com `textBlock`, um bloco gerenciado no arquivo global de instruções de cada agente instalado, com a regra de delegação em papéis neutros; o texto aparece antes de gravar; a desinstalação remove só o bloco. Regra dura: reversão e `tests/install-uninstall-roundtrip.test.js`.
2. **Limitações conhecidas do `textBlock`**, sem perda de dados: recusa adotar um bloco já presente quando o mesmo plano remove outro `textBlock` do arquivo (`text-block.js:201`).
3. **Pequenos:** `delegate.py status` mostra o texto do limite do Codex misturado com saída de teste; os testes do AS-D7 não isolam o filtro de diretório do de extensão; `status` do instalador acusa "Ghost owners: 1"; o `user.name` do git neste repo é `Test`.
4. **Adiados:** `remote-runner` `setup-client`/`teardown`/`provision`, recursos de banco e carga, remoto para o `remote-runner`, detecção automática de host no delegate.
5. Worktrees já integrados, removíveis: `.worktrees/delegate-pipeline`, `delegate-flash-only`, `ci-fix`.

## Armadilhas

- **Codex não commita em worktree** (`index.lock` negado): registro com `"uncommitted": true`; leia o diff, commite e anote em `--deviation`. O sandbox dele também mostra falhas falsas de teste; vale o gate do host.
- **Codex pode bater o limite na fase de conferência** com o código já completo na árvore: rode o gate antes de repetir o cartão.
- **Executor sai do cartão:** um Flash criou uma VM Lima na home e outro gravou relatório dentro do repo. No cartão: proibir VM, instalar software e relatórios no repo. VM só em `/Volumes/External` (a `rr` está em `/Volumes/External/lima`); para Linux, `ultron run -- '<cmd>'`.
- **Matar o runner com TERM** na versão antiga deixava filhos do `opencode` vivos; a versão instalada agora mata o grupo e guarda o slot do sobrevivente.
- **zsh não divide variável em palavras:** `$D run ...` não roda; use o caminho por extenso ou função.
- **O CI pega o que o gate local não pega:** os testes importam o `delegate.py`, o Python deixa `__pycache__` ao lado e o pacote o levava junto (AS-D7); e o npm do Node 22 roda `prepare` mesmo com `--ignore-scripts`.
- **Revisão cruzada é indispensável:** com gate verde, revisores provaram perda de dados no MI-T1 e slots apagados com executor vivo no AS-D4.
- **`install --yes --force-adopt`** sobrescreve arquivos `kept-local`. Não usar sem o operador.
- O `~/.claude/CLAUDE.md` global do operador ainda cita `deepseek-pro`, `deepseek-light` e só `agy`/`agy-review`; os perfis certos são os seis acima. Avisar, não editar.
