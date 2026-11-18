# real-automate

`implement` sem flag e `--mode=automate` hoje são a mesma sessão: `isAutomateActive` já nasce ligado, e a sessão escreve o produto. A skill pede orquestração, mas o gate só corre se o modelo chamar `assert-automate-gate`. Este plano troca isso por um programa. O nome da flag continua `--automate`. Não existe `--unattended`.

A decisão de origem está em `.ai/memory/decisao-unattended-bloco.md` (o nome do arquivo é histórico). O caso que fixa o cartão de arquitetura é `titan-chordpro-ui` / `versoes-cifra`: a IA deixou título, artista, YouTube e áudio fora de `{start_of_x_chart}` e o parse colou esse header de volta. `{key:}` já estava dentro do bloco, então uma pergunta de consequência sobre o tom não pega o erro. A revisão que resolveu é `{start_of_x_chord}` … `{end_of_x_chord}`, nada fora.

## Princípios

### P1 Dois comandos

`implement` sem flag continua a sessão que escreve. `implement --automate` é um programa em primeiro plano, um plano, nesta máquina. A sessão do chat não é esse programa.

### P2 A skill não é o enforce

Mais parágrafos na skill não substituem o processo. O PreToolUse antigo é `skills/shared/project-assets/hooks/pre-write.sh`. O default é dry-run (`emergent_strict_mode: false` em `hooks/config.json`); exit 2 só com esse knob, não porque Soft virou Strict. No Grok sem hooks-trust o hook não corre (fail-open). Ele só olha acréscimo de task ou fase sem `provenance` em `plan.md`, `phases/*.md` e iniciativas. Não bloqueia escrita de produto. A caneta não o substitui.

### P3 Três hosts

Claude Code, Codex e Grok. O mesmo programa. Cursor e Gemini ficam de fora: neles o hook de projeto é no-op.

### P4 Caneta ou não parte

Se o PreToolUse não der exit 2 de verdade no host atual, o programa recusa a partida. Sem o lock `.atomic-skills/status/automate/pen.lock` a caneta não bloqueia o uso normal. Com o lock, escrita fora do worktree do writer e qualquer shell saem exit 2. `SKIP` não desliga a caneta.

### P5 Fechado até cartão e protótipo

Flow (`find-missing-flow.js --strict`), o arquivo de status da review e ground truth são necessários e não bastam. Esse arquivo só vale se o programa disparou o CLI que não é o harness aberto, esperou o processo e gravou comando, exit, stderr e veredito. A linha `- internal:` escrita pela sessão não abre a flag. A flag não abre enquanto não existirem `scripts/find-missing-architecture.js` e `scripts/find-missing-ui.js` com carimbo válido. `userApproved` no recibo `.atomic-skills/status/design-gates/<projectId>-<slug>.json` (`scripts/design-gates.js`) não substitui nenhum dos dois. Esse campo não está no `design.md`.

### P6 A sessão só orquestra

A sessão que inicia o programa não escreve produto, não revisa e não fecha fase. Ela despacha um agente isolado por passo. A unidade é a fase corrente, com todas as tasks `pending` na ordem do frontmatter. O marco da F3 prova um writer e um merge e o teste desse marco para aí. O programa terminado não para no merge. Review both, fechamento, fase seguinte, review final, audit e o PR sem merge são o fluxo de intenção.

### P7 O cartão é o desenho

Dois esboços: o que ficou fora, a linha da mistura ou “não mistura”, e o segundo esboço com a lista de fora vazia. “Nada fora” é opção, não default. Curta `revisao-2-camadas`: a música fica fora do corte; cortar o áudio para caber é a mistura proibida.

### P8 O flow audita o comportamento depois

O grafo ratificado passa a ser a fonte de verdade do audit, por fase e na página final. Onde `businessIntent` e o grafo discordam, vale o grafo. O flow não substitui o cartão nem a review de bug.

### P9 Sem daemon

Fila, vários hosts e spawn adapter multi-máquina ficam de fora. `userValidatedAt` só nasce do botão da página final. Archive continua depois desse botão.

## Glossário

| Termo | Definição |
| --- | --- |
| programa | `node scripts/automate-run.js`, o processo que parte ou recusa |
| caneta | `automate-pen.sh` mais `scripts/automate-pen-hook.js`, exit 2 com o lock |
| cartão | dois esboços do bloco, carimbados, lidos por `find-missing-architecture.js` |
| protótipo | carimbo de tela ou “sem tela”, lido por `find-missing-ui.js` |
| writer | subprocesso `claude`, `codex` ou `grok` no worktree, com lease |
| mistura | passo que junta o que está fora do bloco com o que está dentro, no objeto editado |
| recibo | arquivo de status que o programa grava depois que o CLI externo termina. A sessão não o escreve. |

## F0 — Partida que recusa

**Objetivo:** `--automate` deixa de ser a sessão que escreve. O programa recusa sem caneta real no host, sem flow, sem revisão do plano e sem ground truth, e também recusa enquanto os detectores de cartão e protótipo não existem. Caneta real significa um lock de prova isolado (o script sai 2 com ele e 0 sem ele) e uma escrita real da ferramenta do host, recusada, sem arquivo no disco. Sem essa segunda prova o programa não parte. O teste de recusa aponta um plan.md fixture sem flow, não o source.md. Não dispara writer.

### Tasks

- **T-001 — Caneta dos três hosts.** `src/automate-host-pen.js`, `scripts/automate-pen-hook.js` e `skills/shared/project-assets/hooks/automate-pen.sh` negam `Write`/`Edit`/`MultiEdit`/`Bash`, `apply_patch`/`shell` e `write`/`search_replace`/`run_terminal_command` enquanto o lock existe. Sem lock, exit 0. Verifier: `node --test tests/automate-host-pen.test.js`.
- **T-002 — Registro no plugin Grok e no setup.** `src/providers/skills-file-set.js` e `skills/shared/project-assets/project-setup.md` registram `automate-pen.sh` com o matcher que inclui `apply_patch`, `Bash`, `shell` e `run_terminal_command`, além das ferramentas de arquivo. Verifier: `node --test tests/automate-host-pen.test.js`.
- **T-003 — Partida que lista o que falta.** `scripts/automate-run.js --host <claude-code|codex|grok> --plan <plan.md>` cria e apaga um `probe.lock` isolado, exige exit 2 e depois 0 no script, e só segue se uma escrita real do host for recusada sem criar arquivo. Sai 1 com a lista de bloqueios e não cria `pen.lock`. Verifier: `node scripts/automate-run.js --host codex --plan <fixture plan.md sem flow>` sai 1 citando `automate-pen.sh` e `find-missing-architecture.js`.

**Exit gate:** `node --test tests/automate-host-pen.test.js` verde. Sem lock o hook sai 0. Com lock de prova isolado, um payload de escrita sai 2. Uma escrita real do host ativo é recusada e não cria arquivo. `node scripts/automate-run.js --host codex --plan <fixture plan.md sem flow>` sai 1 citando `automate-pen.sh` e `find-missing-architecture.js`.

## F1 — Cartão de bloco

**Objetivo:** o detector de arquitetura existe e recusa um plano sem os dois esboços e sem a escolha carimbada de qual esboço vale. “Nada fora” é uma opção do cartão, não a resposta automática. O protótipo cita essa escolha. `scripts/find-missing-design-process.js` e o `userApproved` do recibo design-gates não são este cartão. O cartão é `architecture/decisions.json`, lido por `scripts/find-missing-architecture.js`, que esta fase cria.

### Tasks

- **T-001 — Formato do cartão.** `architecture/decisions.json` no diretório do plano guarda o delimitador, a lista do que ficou fora, a linha da mistura, o segundo esboço, e qual esboço foi escolhido. Chat “ok” não carimba. Verifier: `node scripts/find-missing-architecture.js --strict` num fixture sem carimbo sai 1.
- **T-002 — Detector.** `scripts/find-missing-architecture.js` sai 0 só com sha e `ratifiedAt`. Proíbe as frases “se eu mexer nisto”, “a outra”, “consistente” e “isolado” sem o desenho. `scripts/find-missing-design-process.js` e o `userApproved` do recibo design-gates não satisfazem este detector. Verifier: `node --test tests/find-missing-architecture.test.js`.
- **T-003 — A partida passa a exigir o detector.** `automate-run.js` chama o script em vez de só checar se o arquivo existe. Verifier: `node scripts/automate-run.js --host grok --plan <fixture sem cartão>` sai 1 com o motivo do detector.

**Exit gate:** `node --test tests/find-missing-architecture.test.js` verde.

## F2 — Protótipo

**Objetivo:** o detector de tela existe. Plano sem superfície visível carimba “sem tela”. “Sem tela” com task que toca Vue, sheet, viewer ou editor é recusado. O carimbo da tela cita o sha do cartão. `exitGateType: ui-gate` não é o carimbo. O carimbo é `ui/ui.json`, lido por `scripts/find-missing-ui.js`, que esta fase cria.

### Tasks

- **T-001 — Formato.** `ui/ui.json` lista telas com path do protótipo e sha, ou `{ "none": true }` com motivo. Verifier: `node scripts/find-missing-ui.js --strict` num fixture vazio sai 1.
- **T-002 — Detector.** `scripts/find-missing-ui.js` recusa `none: true` quando o plano toca superfície de UI, e recusa sha de arquitetura divergente. `exitGateType: ui-gate` não é o carimbo. Verifier: `node --test tests/find-missing-ui.test.js`.
- **T-003 — A partida exige o detector.** `automate-run.js` chama `find-missing-ui.js`. Verifier: o mesmo comando de T-003 da F1, agora também citando o detector de UI quando o carimbo falta.

**Exit gate:** `node --test tests/find-missing-ui.test.js` verde.

## F3 — Um writer, merge, e para

**Objetivo:** com caneta, flow, revisão, ground truth, cartão e protótipo válidos, o programa cria o worktree, grava o pen.lock com dono e pid, dispara um writer do CLI do host, integra no branch do plano, mata o writer se ainda viver e solta o lock. O teste deste marco para depois do merge. Não roda review nem audit e não abre a fase seguinte, porque isso é a F4. O programa terminado não fica nesse pare. Lock de pid morto não bloqueia a sessão. O shell da sessão do chat fica negado. Quem roda verifier é o programa, não o shell do writer. O worktree e o merge nascem em `scripts/automate-run.js`. Esta fase não chama `scripts/automate-phase-run.js`. O fechamento da fase, o claim e `src/automate-product-fence.js` ficam na F4, num agente isolado, não na sessão.

### Tasks

- **T-001 — Lock na partida real.** Quando os seis gates passam, o programa escreve `pen.lock` com dono, pid e `writerWorktree`. Mata o writer se ainda viver antes de soltar o lock. Pid morto não bloqueia a sessão. Quem roda verifier é o programa. Apaga o lock ao sair, inclusive em falha. Verifier: teste que o lock existe durante o spawn e some no exit.
- **T-002 — Spawn do host.** Um subprocesso `claude`, `codex` ou `grok` no worktree, com lease. A sessão do chat não é o writer. O worktree nasce em `scripts/automate-run.js`, não em `scripts/automate-phase-run.js`. Verifier: teste com CLI falso que grava um arquivo dentro do worktree.
- **T-003 — Merge e pare.** O teste deste marco integra no branch do plano e sai sem `phase-done`. O fechamento real, o claim e `src/automate-product-fence.js` são a F4, num agente isolado. A sessão não grava `lastAssert`. Verifier: o branch do plano contém o commit do writer e o processo sai 0 uma vez.

**Exit gate:** um teste de integração com host falso sai 0, o arquivo do writer está no branch do plano, e uma segunda fase não foi materializada.

## F4 — Review e o flow no audit

**Objetivo:** o programa conduz cada fase até a seguinte. Antes da primeira fase pergunta uma vez o CLI externo e grava `reviewExternalCli` no plano. Both é a review local mais esse CLI. No meio da corrida ninguém pergunta de novo. A unidade é a fase corrente. Um agente isolado implementa todas as tasks `pending`, na ordem do frontmatter. Outro agente isolado roda a review both. Critical ou major manda um agente isolado corrigir e a review volta. São 3 reviews. Sem critical e sem major, os findings restantes ficam em `.atomic-skills/status/automate/<slug>.json` para o relatório final, a fase fecha e a seguinte abre, sempre em agente isolado. Na terceira review, critical ou major abre travei e não avança. A linha `- internal:` não substitui o recibo. Saída sem veredito não conta. Exit diferente de 0 guarda o stderr real. O brief leva o grafo e o esboço escolhido. Task complexa entra nessa mesma review, antes de fechar a fase. O audit lê `flow/flow.json` no `ratifiedGraphSha` e cobra cada máquina e cada xor, com linha faz, pela metade ou não faz. A página final não substitui esse gate. Achado de mistura do bloco não entra no loop. O gate que hoje fecha a fase é `src/phase-delivery-audit-gate.js` e não lê `flow.json`. F4 estende esse gate. A skill `audit-delivery` também não lê o grafo hoje. Fechar a fase valida o claim e passa em `src/automate-product-fence.js`.

### Tasks

- **T-001 — Both com falha real.** Antes da primeira fase o programa grava `reviewExternalCli` e não pergunta de novo. Both é a review local mais esse CLI. Dispara o CLI, espera e grava o recibo com comando, exit, stderr e veredito. `overrideReason` sem stderr desse processo não passa. Recibo escrito pela sessão não passa. O brief leva o grafo e o esboço escolhido. Task complexa entra nesta review, antes de fechar a fase. Verifier: `node --test tests/phase-review-gate.test.js` cobrindo esses casos.
- **T-002 — Audit lê o grafo.** `audit-delivery` recusa sha divergente e emite uma linha por máquina e por xor. Onde o `businessIntent` discorda, vale o grafo. Esta task estende `src/phase-delivery-audit-gate.js`, que hoje não lê `flow.json`. A skill também não lê o grafo hoje. Verifier: fixture de flow com um xor e relatório sem a linha sai falho.
- **T-003 — Loop com teto.** Critical ou major corrige num agente isolado e a review volta. O teto é 3 reviews. Sem critical e sem major, os findings restantes vão para `.atomic-skills/status/automate/<slug>.json`, a fase fecha e a seguinte abre. Na terceira, critical ou major abre travei. Mistura do bloco carimbado para na hora e não entra no loop. Verifier: teste do contador no programa.

**Exit gate:** `node --test tests/phase-review-gate.test.js` recusa `overrideReason` sem stderr do comando externo e recusa um recibo escrito pela sessão. Um fixture de `flow.json` com um xor sem linha no relatório de audit falha. Um achado de mistura do bloco não entra no loop e para na hora.

## F5 — Página final

**Objetivo:** um servidor no hábito de `serve-flow.js --up` mostra o que foi carimbado, as frases `said` e `saw`, a tela ao lado do que foi construído, e o que ficou de fora. O botão grava `userValidatedAt` só com todo `deliveryAuditGate` em passed. Chat “ok” não grava. O programa entrega o branch, abre o PR e não faz merge. Archive fica depois do botão. No fim do plano o mesmo loop de 3 reviews roda sobre o plano inteiro e depois sobre o `audit-delivery`. Os findings guardados por fase entram nesse relatório. `userValidationOk` em `src/plan-end-review.js` hoje aceita qualquer timestamp ISO em `userValidatedAt`. O botão passa a ser o único escritor, e um timestamp escrito na sessão não passa em `assert-automate-gate --gate finalize`.

### Tasks

- **T-001 — Frases.** Cada decisão do JSONL ganha `said` e `saw`. Entrada sem as duas não conta como apresentada. Verifier: teste do leitor da página.
- **T-002 — Servidor.** A vista final não abre em `file://`. O botão fica apagado enquanto algum audit da fase não está passed. `scripts/serve-flow.js` continua servindo o preview de `flow.html`. O botão é o único escritor de `userValidatedAt`. `userValidationOk` em `src/plan-end-review.js` deixa de aceitar um timestamp escrito na sessão, e `assert-automate-gate --gate finalize` recusa esse timestamp. Verifier: teste HTTP do botão desligado e ligado.
- **T-003 — Paradas.** Travei, não avanço e mudança grande abrem a mesma origem. A confirmação entra no log e o programa retoma sem reinstalar parada por fase. Verifier: teste das três paradas.

**Exit gate:** o teste HTTP do botão verde, e archive não roda nesse comando.
