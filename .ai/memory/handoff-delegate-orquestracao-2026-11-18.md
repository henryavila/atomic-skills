---
name: handoff-delegate-orquestracao-2026-11-18
description: Estado da frente delegate em 18/11/2026 à noite — skill fechada e instalada, o que espera decisão do operador, regras de custo e armadilhas
metadata:
  type: project
---

# Delegate: estado ao fim de 18/11/2026 (18h30 GMT-3)

O Claude reassumiu a orquestração à tarde e fechou a fila. Nada foi enviado (`push`), nenhum PR, nenhum merge em `main`, nenhuma publicação: isso é decisão do operador (Henry).

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

## Estado das tarefas

| Id | O quê | Onde | Estado |
|---|---|---|---|
| AS-D1 a AS-D6 | Delegate: `pipeline`, `status`, `pause`, `resume`, `kill`, limite de simultâneos, OpenCode só Flash, Flash como revisor | `atomic-skills`, ramo `feat/delegate-skill` em `6028a57c` (merge de `feat/delegate-pipeline` `a33481bd`), local, **instalado** | **Fechado.** Runner 165/165, `npm test` 1348/1350 (2 pulados de plataforma), `validate-skills` e `check-docs` ok. AS-D4 levou quatro rodadas de correção (F1 a F4); AS-D5 e AS-D6 revisados por `codex-review` sem achado grave. Espera: `push` e PR |
| MI-T1 | Efeito `textBlock` no motor | `minimalist-installer/.worktrees/text-block`, ramo `feat/text-block-effect` em `2504b3d` | **Pronto para decisão.** 512/512; contrato estreitado em nove pontos (F5); sete revisões, a última (Flash) sem achado grave. Limitações conhecidas, sem perda de dados: (1) recusa adotar um bloco já presente quando o mesmo plano remove outro `textBlock` do arquivo (em duas execuções funciona; `text-block.js:201`); (2) journal gravado por commits antigos do ramo, nunca publicados, pode deixar arquivo vazio. Espera: merge e publicação |
| RR-T3a | Núcleo do `remote-runner` | `remote-runner/.worktrees/core`, ramo `feat/core` em `637fe0c` | **Fechado no código.** 80/80 no Mac e no Linux (`ultron run -- 'npm test'`), revisado por duas famílias. Espera: merge em `main` |

Worktrees que podem ser removidos depois do merge: `atomic-skills/.worktrees/delegate-pipeline` e `delegate-flash-only`.

## O que falta, na ordem

1. **Decisões do operador:** `push`/PR do `feat/delegate-skill`; merge e publicação do MI-T1; merge do RR-T3a.
2. **T2 — instruções globais pelo instalador do atomic-skills.** Depende do MI-T1 com merge e do pin do motor atualizado em `package.json`. Item **opcional** do instalador que grava, com `textBlock`, um bloco gerenciado no arquivo global de instruções de cada agente instalado, com a regra de delegação em papéis neutros; o texto aparece antes de gravar; a desinstalação remove só o bloco. Regra dura: reversão e `tests/install-uninstall-roundtrip.test.js`.
3. **Adiados:** `remote-runner` `setup-client`/`teardown`/`provision` (T3b, T3c), recursos de banco e carga (decidir se entram no `remote-runner`), detecção automática de host no delegate.

## Armadilhas

- **Codex não commita em worktree** (`index.lock` negado): registro com `"uncommitted": true`; leia o diff, commite e anote em `--deviation`. O sandbox dele também mostra falhas falsas de teste; vale o gate do host.
- **Codex pode bater o limite na fase de conferência** com o código já completo na árvore: rode o gate antes de repetir o cartão.
- **Executor sai do cartão:** um Flash criou uma VM Lima na home e outro gravou relatório dentro do repo. No cartão: proibir VM, instalar software e relatórios no repo. VM só em `/Volumes/External` (a `rr` está em `/Volumes/External/lima`); para Linux, `ultron run -- '<cmd>'`.
- **Matar o runner com TERM** na versão antiga deixava filhos do `opencode` vivos; a versão instalada agora mata o grupo e guarda o slot do sobrevivente.
- **zsh não divide variável em palavras:** `$D run ...` não roda; use o caminho por extenso ou função.
- **Revisão cruzada é indispensável:** com gate verde, revisores provaram perda de dados no MI-T1 e slots apagados com executor vivo no AS-D4.
- **`install --yes --force-adopt`** sobrescreve arquivos `kept-local`. Não usar sem o operador.
- O `~/.claude/CLAUDE.md` global do operador ainda cita `deepseek-pro`, `deepseek-light` e só `agy`/`agy-review`; os perfis certos são os seis acima. Avisar, não editar.
