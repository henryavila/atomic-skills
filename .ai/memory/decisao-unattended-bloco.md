# Decisão consolidada — `implement --automate`

**Status:** consolidado em 2026-09-24, a partir da conversa com o Henry. Direção aprovada. Ainda não é skill, nem programa, nem hook. O próximo passo é refinar este texto. Não construir em cima dele antes disso.

O nome do arquivo é histórico (`unattended`). A flag chama-se `--automate`. Não existe `--unattended`.

## Dois comandos

| Comando | O que é |
|---|---|
| `implement` sem flag | A sessão escreve o código. É o que acontece hoje, com ou sem `--mode=automate`. |
| `implement --automate` | Um programa em primeiro plano, um plano, nesta máquina. A sessão do chat não é esse programa. |

Hoje os dois são a mesma coisa. `isAutomateActive` já é true quando não há flag (`src/implement-mode.js`). A sessão escreve. O carimbo `executionMode: automate`, quando alguém lembra de gravar, só acrescenta paradas que a skill pede. Por isso não se sente diferença. `--automate` só passa a valer quando for o programa.

## Por que a skill não segura

O gate atual é uma função que o modelo precisa chamar (`assert-automate-gate`). Se a sessão codifica e não chama, nada trava. O PreToolUse instalado é dry-run no Soft, fail-open no Grok sem hooks-trust, e só olha proveniência de `plan.md`. Arquivo de produto passa. “A sessão só orquestra” aconteceu por exceção.

Mais texto na skill não entra. Daemon multi-host, fila e spawn adapter também não.

## Antes do programa partir

Quatro portas, nesta ordem. As três primeiras já têm detector. A quarta entra quando o detector existir. Até lá `--automate` não abre.

1. **Flow.** `find-missing-flow.js --strict`. Obrigatório em qualquer `implement`, inclusive este. Sem waiver. Pergunta do flow: “é assim que o trabalho acontece?” Não escolhe a estrutura.
2. **Revisão do plano.** O programa dispara o CLI que não é o harness aberto, espera o processo e grava o arquivo de status com comando, exit, stderr e veredito. A linha `- internal:` escrita pela sessão não abre a partida. Saída sem veredito não conta. Ratificado em 2026-09-25.
3. **Ground truth.** `find-plans-missing-ground-truth.js`. Plano contra o código que já existe.
4. **Arquitetura e protótipo.** Carimbos abaixo. `userApproved` no `design.md` não substitui nenhum dos dois.

Nenhuma dessas portas substitui as outras.

## Arquitetura — o desenho do bloco

O cartão são dois esboços. Não é pergunta de consequência.

Caso que fixa o corte: `titan-chordpro-ui` / `versoes-cifra`, branch `backup/pre-format-2026-09-24-multiverson`. A IA deixou título, artista, YouTube e áudio num header fora de `{start_of_x_chart}`, e o `parse` colou esse header de volta em cada cifra. `{key:}` já estava dentro do bloco, então “quando eu mudo o tom da Oferta” não pega o erro. A revisão que resolveu: no mesmo arquivo, `{start_of_x_chord}` … `{end_of_x_chord}`, nada fora.

Cada cartão tem:

1. Nome do bloco e o delimitador.
2. O que ficou fora.
3. A mistura: o passo que junta fora + dentro no objeto editado, ou a linha “não mistura”.
4. O segundo esboço, com a lista de fora vazia.

“Nada fora” é opção, não default. Curta `revisao-2-camadas`: a música fica fora do corte de propósito. Cortar o áudio para caber é a mistura proibida.

Proibido no cartão: “se eu mexer nisto”, “a outra”, “consistente”, “isolado” sem o desenho. Moldes de cena (irmãos, quem cede, eixo, onde grava, dono do gesto) não são esta camada.

Quem implementa recebe o esboço escolhido. Pôr um campo fora, ou colar o de fora de volta dentro, é mudança grande.

## Flow no audit

Hoje o flow **não** entra no audit. `audit-delivery` monta um Intent Package a partir de `businessIntent` (`value`, `workflow`, `rules`, `outOfScope`, `doneWhen`), do plano e do handoff (`skills/shared/audit-delivery-assets/intent-package.md`). `flow.json` não é lido. A própria lei do flow diz que ele é gate de **implement**, não de review (`docs/kb/flow.md`).

Isso muda. O grafo ratificado é a fonte de verdade do comportamento da aplicação, no audit de cada fase e de novo na página final.

- O audit lê `flow/flow.json` no `ratifiedGraphSha`. Sha divergente aborta: o fluxo mudou e não foi re-carimbado.
- Cada máquina (estado → estado) e cada escolha exclusiva (xor) vira uma linha: a aplicação faz isso, faz pela metade, ou não faz. Evidência é teste ou caminho no código, não a prosa do `businessIntent`.
- Comportamento que toma o outro braço do xor, ou que não está no grafo e muda o que a pessoa faz, é achado. Não é “extra aceitável”.
- `businessIntent` continua a dizer o porquê e o `doneWhen` da fase. Onde ele e o grafo discordam, vale o grafo: foi o que o operador carimbou.
- O brief do writer e o da review levam o mesmo grafo. O audit não espera o fim do plano para a primeira checagem.

O flow não substitui o cartão de bloco (estrutura) nem a review de código (bug). Ele responde “a aplicação faz o trabalho do jeito carimbado?”.

## Protótipo

Depois do esboço escolhido. Cada tela que o plano muda aponta para um protótipo que o operador abre. O protótipo declara qual esboço obedece. Sha do esboço diferente invalida o carimbo da tela.

Plano sem superfície visível carimba “sem tela”. “Sem tela” com task que toca Vue, sheet, viewer ou editor é recusado.

## O que o programa faz

1. Recusa a partida se alguma porta acima falha.
2. Cria o worktree e dispara o writer como subprocesso do CLI do host, com lease. A sessão do chat não é o writer.
3. Espera, valida o claim, faz o merge.
4. Antes da primeira fase, pergunta uma vez o CLI externo e grava `reviewExternalCli` no plano. Both é a review local mais esse CLI. No meio da corrida ninguém pergunta de novo. O recibo traz comando, exit, stderr e veredito. A linha `- internal:` não abre. Externo ausente só vale com a falha real do comando (binário ou auth) gravada nesse recibo. Aí desce para local. “Sem token” dito no chat não passa. `overrideReason` sem essa falha não passa. O brief leva o grafo ratificado e o esboço escolhido. Task complexa entra na review do fim da fase, antes do fechamento. Fase sem task complexa também revisa nesse momento, uma vez.
5. Loop: review com critical ou major → agente isolado corrige → review de novo. Teto: 3 reviews. Menor não bloqueia e fica no relatório final. Na terceira, critical ou major abre “travei”. Achado “isto mistura o bloco carimbado” não entra no loop: abre “mudança grande” na hora.
6. Roda `audit-delivery` antes de fechar a fase, e de novo no fim do plano com o mesmo loop. Review verde, suite verde e `intentVsDelivered` não substituem. `operatorSkip` é ilegal.
7. Um agente isolado fecha a fase, valida o claim, passa no product fence e abre a seguinte. A sessão que iniciou só orquestra. Grava `said` e `saw`. No fim do plano: review completa com o mesmo loop, audit com o mesmo loop, PR sem merge, relatório para o usuário validar.

Cada passo acima é uma porta em `scripts/automate-run.js`. Exit diferente de 0 impede o seguinte. O seguinte lê o status que só a porta grava. Texto na skill não conta. `find-unreviewed-plans.js` sem `--require-external` não conta, porque aceita `- internal:`. O teste de cada fase do plano `real-automate` é a porta de que o código segue esse pedaço. Sem exit 0 nesse teste, a fase não fecha.
8. Se o processo cai, o cursor em `.atomic-skills/status/automate/<slug>.json` é o resume.

O JSONL de decisões continua o registro da máquina (`id`, `category`, `evidencePath`, `at`). `said` e `saw` são o que a página lê. Entrada sem essas duas frases não conta como apresentada.

## Quando o programa para e chama o operador

Três casos, na página. A confirmação entra no log. O programa retoma sozinho. A confirmação não reinstala parada por fase.

| Parada | O que houve |
|---|---|
| Travei | A terceira review ainda tem critical ou major, ou o verifier falhou e o teto de 3 reviews acabou. |
| Não avanço | Lease, fence, sha de flow / arquitetura / tela mudou, audit ausente, claim que não fecha. |
| Mudança grande | Contradiz o esboço, muda o que a pessoa guarda sem volta, ou o esboço não cobre os dois caminhos. |

Bug dentro do esboço o programa corrige e segue.

## Página

Servidor no hábito do `serve-flow.js --up`. Nunca `file://`. Fica no ar durante o run. Olhar no meio é opcional. Agir é obrigatório na parada e no fim.

Vistas: flow, arquitetura, protótipo, o que já foi decidido, a parada (quando existe), o fim.

A vista final, nesta ordem: o que já estava carimbado, as frases `said` / `saw`, a tela ao lado do que foi construído (ou “sem tela”), o que ficou de fora. O botão “está válido” grava `userValidatedAt`. Chat “ok” não grava. O botão só acende com todo `deliveryAuditGate` da fase em `passed`. O audit não muda para “só no fim”: uma fase ruim encadearia.

O programa entrega o branch. Archive continua depois desse botão.

## Caneta do chat

Enquanto o pid do programa está vivo, um PreToolUse com exit 2 recusa Write, Edit e bash que grava no produto. A exceção é o worktree do writer, com o lease. Sem dry-run.

No Grok, hooks-trust desligado continua a não rodar o hook. O programa mesmo assim faz o trabalho. O hook é o que impede o chat de codar por cima.

## Fora deste corte

- `--unattended` como segunda flag.
- Tratar o `--automate` de hoje como se já fosse este programa.
- Mais parágrafos na skill no lugar do processo.
- Daemon, fila, vários hosts.
- Campo novo em `businessIntent` para o desenho ou para o mockup.
- “Nada fora” como resposta automática de todo plano.
- Pergunta “quando eu mudo o campo” como cartão de arquitetura.

## Primeiro corte (entrevista, 2026-09-24)

Três respostas. O resto deste texto continua sendo a visão. Não entra neste corte.

1. **Caneta ou não parte.** Se o PreToolUse não der exit 2 de verdade no host em que a sessão está, `--automate` recusa a partida. Vale para Claude Code, Codex e Grok.
2. **Fechado até o cartão e o protótipo.** Flow, revisão do plano e ground truth são necessários e não bastam.
3. **Um writer, merge, e para.** Review both, audit contra o flow, página, `said`/`saw`, loop e fase seguinte ficam para o corte de depois.

## Hosts

Claude Code, Codex e Grok. O mesmo programa. Cursor e Gemini ficam de fora: neles o hook de projeto é no-op.

| Host | Hook | A caneta recusa |
|---|---|---|
| Claude Code | `.claude/settings.local.json` | `Write`, `Edit`, `MultiEdit`, `Bash` |
| Codex | `.codex/hooks.json` | `apply_patch`, `shell` |
| Grok | `.grok/plugins/atomic-skills/hooks/hooks.json` | `write`, `search_replace`, `run_terminal_command` |

Entrada do programa: `node scripts/automate-run.js --host <claude-code|codex|grok> --plan <plan.md>`. Recusa se o hook desse host não chama `automate-pen.sh` com essas ferramentas, se flow / revisão / ground truth falham, ou se faltam `scripts/find-missing-architecture.js` e `scripts/find-missing-ui.js`. Sem o lock `.atomic-skills/status/automate/pen.lock`, a caneta não bloqueia o uso normal. Com o lock, escrita fora do worktree do writer e qualquer shell saem exit 2. O spawn do writer ainda não está neste build: mesmo com os gates verdes o script para antes de disparar.

## Ainda aberto, de propósito

A visão acima deste corte segue refinável. O spawn do writer, o cartão e o protótipo ainda não existem.
