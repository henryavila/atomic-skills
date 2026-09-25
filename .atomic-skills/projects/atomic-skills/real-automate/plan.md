---
schemaVersion: "0.1"
slug: real-automate
title: real-automate
version: "1.0"
status: active
executionMode: automate
started: 2026-09-25T03:17:12.483Z
lastUpdated: 2026-09-25T03:17:12.483Z
branch: plan/real-automate
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Dois comandos
    body: "`implement` sem flag continua a sessão que escreve. `implement
      --automate` é um programa em primeiro plano, um plano, nesta máquina. A
      sessão do chat não é esse programa."
  - id: P2
    title: A skill não é o enforce
    body: |
      Mais parágrafos na skill não substituem o processo. O PreToolUse antigo é
      `skills/shared/project-assets/hooks/pre-write.sh`. O default é dry-run
      (`emergent_strict_mode: false` em `hooks/config.json`); exit 2 só com esse
      knob, não porque Soft virou Strict. No Grok sem hooks-trust o hook não
      corre (fail-open). Ele só olha acréscimo de task ou fase sem `provenance`
      em `plan.md`, `phases/*.md` e iniciativas. Não bloqueia escrita de produto.
      A caneta não o substitui.
  - id: P3
    title: Três hosts
    body: "Claude Code, Codex e Grok. O mesmo programa. Cursor e Gemini ficam de
      fora: neles o hook de projeto é no-op."
  - id: P4
    title: Caneta ou não parte
    body: |
      Se o PreToolUse não der exit 2 de verdade no host atual, o programa recusa
      a partida. Sem o lock `.atomic-skills/status/automate/pen.lock` a caneta
      não bloqueia o uso normal. Com o lock, escrita fora do worktree do writer
      e qualquer shell saem exit 2. `SKIP` não desliga a caneta.
  - id: P5
    title: Fechado até cartão e protótipo
    body: |
      Flow (`find-missing-flow.js --strict`), o arquivo de status da review
      e ground truth são necessários e não bastam. Esse arquivo só vale se o
      programa disparou o CLI que não é o harness aberto, esperou o processo e
      gravou comando, exit, stderr e veredito. A linha `- internal:` escrita
      pela sessão não abre a flag. A flag não abre enquanto não existirem
      `scripts/find-missing-architecture.js` e `scripts/find-missing-ui.js` com
      carimbo válido. `userApproved` no recibo
      `.atomic-skills/status/design-gates/<projectId>-<slug>.json`
      (`scripts/design-gates.js`) não substitui nenhum dos dois. Esse campo não
      está no `design.md`.
  - id: P6
    title: A sessão só orquestra
    body: |
      A sessão que inicia o programa não escreve produto, não revisa e não
      fecha fase. Ela despacha um agente isolado por passo. A unidade é a fase
      corrente, com todas as tasks `pending` na ordem do frontmatter. O marco
      da F3 prova um writer e um merge e o teste desse marco para aí. O
      programa terminado não para no merge. Review both, fechamento, fase
      seguinte, review final, audit e o PR sem merge são o fluxo de intenção.
  - id: P7
    title: O cartão é o desenho
    body: "Dois esboços: o que ficou fora, a linha da mistura ou “não mistura”, e o
      segundo esboço com a lista de fora vazia. “Nada fora” é opção, não
      default. Curta `revisao-2-camadas`: a música fica fora do corte; cortar o
      áudio para caber é a mistura proibida."
  - id: P8
    title: O flow audita o comportamento depois
    body: |
      O grafo ratificado passa a ser a fonte de verdade do audit, por fase e na
      página final. Onde `businessIntent` e o grafo discordam, vale o grafo. O
      flow não substitui o cartão nem a review de bug.
  - id: P9
    title: Sem daemon
    body: |
      Fila, vários hosts e spawn adapter multi-máquina ficam de fora.
      `userValidatedAt` só nasce do botão da página final. Archive continua
      depois desse botão.
glossary:
  - term: programa
    definition: "`node scripts/automate-run.js`, o processo que parte ou recusa"
  - term: caneta
    definition: "`automate-pen.sh` mais `scripts/automate-pen-hook.js`, exit 2 com o lock"
  - term: cartão
    definition: dois esboços do bloco, carimbados, lidos por `find-missing-architecture.js`
  - term: protótipo
    definition: carimbo de tela ou “sem tela”, lido por `find-missing-ui.js`
  - term: writer
    definition: subprocesso `claude`, `codex` ou `grok` no worktree, com lease
  - term: mistura
    definition: |
      passo que junta o que está fora do bloco com o que está dentro, no
      objeto editado
  - term: recibo
    definition: |
      arquivo de status que o programa grava depois que o CLI externo
      termina. A sessão não o escreve.
phases:
  - id: F0
    slug: real-automate-f0-partida-que-recusa
    title: Partida que recusa
    goal: "`--automate` deixa de ser a sessão que escreve. O programa recusa sem
      caneta real no host, sem flow, sem revisão do plano e sem ground truth, e
      também recusa enquanto os detectores de cartão e protótipo não existem.
      Caneta real significa duas provas. Um lock de prova isolado, que não é o
      pen.lock, faz o script do hook sair 2 num payload de escrita e sair 0 sem
      lock. Além disso, uma chamada de escrita do próprio host (Claude, Codex
      ou Grok) tem de ser recusada e não pode deixar arquivo no disco. Sem essa
      segunda prova o programa não parte. O teste de recusa aponta um plan.md
      fixture sem flow, não o source.md. Não dispara writer."
    dependsOn: []
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: "`node --test tests/automate-host-pen.test.js` verde. Sem lock o
            hook sai 0. Com lock de prova isolado, um payload de escrita sai 2.
            Uma escrita real do host ativo é recusada e não cria arquivo. `node
            scripts/automate-run.js --host codex --plan <fixture plan.md sem
            flow>` sai 1 citando `automate-pen.sh` e
            `find-missing-architecture.js`."
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: active
    businessIntent:
      value: |
        O comando automate deixa de ser a mesma sessão que escreve. Quem corre
        node scripts/automate-run.js vê a partida recusada até a caneta do host,
        o flow, a revisão do plano e o ground truth existirem, e também enquanto
        os detectores de cartão e protótipo não existem.
      workflow: |
        O operador passa --host claude-code, codex ou grok e --plan. O
        programa lê o hook daquele host, cria um lock de prova isolado (não o
        pen.lock), exige status 2 no script e status 0 sem lock, dispara uma
        escrita real pela ferramenta do host e só segue se ela for recusada e
        não gravar arquivo, apaga o lock de prova, roda find-missing-flow.js
        --strict,
        find-unreviewed-plans.js --require-external e
        find-plans-missing-ground-truth.js, e confere se
        find-missing-architecture.js e find-missing-ui.js existem. `--require-external`
        sai 1 quando a única linha de review é `- internal:`. Qualquer falha
        imprime a lista e sai 1. Não grava pen.lock e não dispara writer.
      rules: |
        Só Claude Code, Codex e Grok. Sem lock a caneta sai 0. Com lock, escrita
        fora do worktree e shell saem 2. SKIP e SKIP-EMERGENT não desligam a
        caneta. `pre-write.sh` permanece ao lado dela, com o matcher atual.
        `stop.sh` fica fora. A skill de implement não ganha parágrafos novos no
        lugar do programa.
      outOfScope: |
        Cartão de bloco, protótipo, spawn do writer, merge, review both,
        audit do flow, página e a fase seguinte. Também substituir ou apagar
        `pre-write.sh`, e alterar o `stop.sh`.
      doneWhen: |
        node --test tests/automate-host-pen.test.js passa, o hook sai 0
        sem lock e sai 2 com lock de prova isolado, uma escrita real do host
        ativo é recusada e não cria arquivo, e node scripts/automate-run.js
        --host codex --plan num fixture plan.md sem flow sai com exit 1 citando
        automate-pen.sh e find-missing-architecture.js.
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-real-automate-F0.md
      verifiedAt: 2026-09-25T21:22:17.320Z
      at: 1474ad94c023f1acbc887a99f5dccbc6b116a17e
    lessonsState: none
    noneReason: >
      F0 evaluation returned notes only (no blocker/critical/major). Clean
      phase: no reopened tasks, no failed verifiers, no product defects
      requiring a reusable lesson.
  - id: F1
    slug: real-automate-f1-cartao-de-bloco
    title: Cartão de bloco
    goal: |
      o detector de arquitetura existe e recusa um plano sem os dois esboços
      e sem a escolha carimbada de qual esboço vale. “Nada fora” é uma opção do
      cartão, não a resposta automática. O protótipo cita essa escolha.
      `scripts/find-missing-design-process.js` e o `userApproved` do recibo
      design-gates não são este cartão. O cartão é `architecture/decisions.json`,
      lido por `scripts/find-missing-architecture.js`, que esta fase cria.
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: "`node --test tests/find-missing-architecture.test.js` verde."
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
  - id: F2
    slug: real-automate-f2-prototipo
    title: Protótipo
    goal: |
      o detector de tela existe. Plano sem superfície visível carimba “sem
      tela”. “Sem tela” com task que toca Vue, sheet, viewer ou editor é
      recusado. O carimbo da tela cita o sha do cartão. `exitGateType: ui-gate`
      não é o carimbo. O carimbo é `ui/ui.json`, lido por
      `scripts/find-missing-ui.js`, que esta fase cria.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: "`node --test tests/find-missing-ui.test.js` verde."
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
  - id: F3
    slug: real-automate-f3-um-writer-merge-e-para
    title: Um writer, merge, e para
    goal: |
      com caneta, flow, revisão, ground truth, cartão e protótipo válidos, o
      programa cria o worktree, grava o pen.lock com dono e pid, dispara um
      writer do CLI do host, integra no branch do plano, mata o writer se ainda
      viver e solta o lock. O teste deste marco para depois do merge. Não roda
      review nem audit e não abre a fase seguinte, porque isso é a F4. O
      programa terminado não fica nesse pare. Lock de pid morto não bloqueia a
      sessão. O shell da sessão do chat fica negado. Quem roda verifier é o
      programa, não o shell do writer. O worktree e o merge nascem em
      `scripts/automate-run.js`. Esta fase não chama
      `scripts/automate-phase-run.js`. O fechamento da fase, o claim e
      `src/automate-product-fence.js` ficam na F4, num agente isolado, não na
      sessão.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: |
            um teste de integração com host falso sai 0, o arquivo do writer
            está no branch do plano, e uma segunda fase não foi materializada.
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
  - id: F4
    slug: real-automate-f4-review-e-o-flow-no-audit
    title: Review e o flow no audit
    goal: |
      o programa conduz cada fase até a seguinte. Antes da primeira fase
      pergunta uma vez o CLI externo e grava `reviewExternalCli` no plano.
      Both é a review local mais esse CLI. No meio da corrida ninguém pergunta
      de novo. A unidade é a fase corrente. Um agente isolado implementa todas
      as tasks `pending`, na ordem do frontmatter. Outro agente isolado roda a
      review both. Critical ou major manda um agente isolado corrigir e a
      review volta. São 3 reviews. Sem critical e sem major, os findings
      restantes ficam em `.atomic-skills/status/automate/<slug>.json` para o
      relatório final, a fase fecha e a seguinte abre, sempre em agente
      isolado. Na terceira review, critical ou major abre travei e não avança.
      A linha `- internal:` não substitui o recibo. Saída sem veredito não
      conta. Exit diferente de 0 guarda o stderr real. O brief leva o grafo e
      o esboço escolhido. Task complexa entra nessa mesma review, antes de
      fechar a fase. O audit lê `flow/flow.json` no `ratifiedGraphSha` e cobra
      cada máquina e cada xor, com linha faz, pela metade ou não faz. A página
      final não substitui esse gate. Achado de mistura do bloco não entra no
      loop. O gate que hoje fecha a fase é `src/phase-delivery-audit-gate.js`
      e não lê `flow.json`. F4 estende esse gate. A skill `audit-delivery`
      também não lê o grafo hoje. Fechar a fase valida o claim e passa em
      `src/automate-product-fence.js`.
    dependsOn:
      - F3
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: "`node --test tests/phase-review-gate.test.js` recusa
            overrideReason sem stderr do comando externo e recusa um recibo
            escrito pela sessão. O CLI externo sai de `reviewExternalCli`, sem
            pergunta no meio. Três reviews. Sem critical e sem major a fase
            fecha e a seguinte abre. Na terceira, critical ou major para. Um
            fixture de flow.json com um xor sem linha no relatório de audit
            falha. Um achado de mistura do bloco não entra no loop e para na
            hora."
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
  - id: F5
    slug: real-automate-f5-pagina-final
    title: Página final
    goal: |
      um servidor no hábito de `serve-flow.js --up` mostra o que foi carimbado,
      as frases `said` e `saw`, a tela ao lado do que foi construído, e o que
      ficou de fora. O botão grava `userValidatedAt` só com todo
      `deliveryAuditGate` em passed. Chat “ok” não grava. O programa entrega o
      branch, abre o PR e não faz merge. Archive fica depois do botão. No fim
      do plano o mesmo loop de 3 reviews roda sobre o plano inteiro e depois
      sobre o `audit-delivery`. Os findings guardados por fase entram nesse
      relatório. `userValidationOk` em `src/plan-end-review.js`
      hoje aceita qualquer timestamp ISO em `userValidatedAt`. O botão passa a
      ser o único escritor, e um timestamp escrito na sessão não passa em
      `assert-automate-gate --gate finalize`.
    dependsOn:
      - F4
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: |
            o teste HTTP do botão verde, o PR existe sem merge, e
            archive não roda nesse comando.
          status: pending
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: pending
references: []
---

# real-automate

## 1. Context

`implement` sem flag e `--mode=automate` hoje são a mesma sessão: `isAutomateActive` já nasce ligado, e a sessão escreve o produto. A skill pede orquestração, mas o gate só corre se o modelo chamar `assert-automate-gate`. Este plano troca isso por um programa. O nome da flag continua `--automate`. Não existe `--unattended`.

A decisão de origem está em `.ai/memory/decisao-unattended-bloco.md` (o nome do arquivo é histórico). O caso que fixa o cartão de arquitetura é `titan-chordpro-ui` / `versoes-cifra`: a IA deixou título, artista, YouTube e áudio fora de `{start_of_x_chart}` e o parse colou esse header de volta. `{key:}` já estava dentro do bloco, então uma pergunta de consequência sobre o tom não pega o erro. A revisão que resolveu é `{start_of_x_chord}` … `{end_of_x_chord}`, nada fora.

## 2. Inviolable principles

- **P1 Dois comandos** — `implement` sem flag continua a sessão que escreve. `implement --automate` é um programa em primeiro plano, um plano, nesta máquina. A sessão do chat não é esse programa.
- **P2 A skill não é o enforce** — Mais parágrafos na skill não substituem o processo. O PreToolUse antigo é `skills/shared/project-assets/hooks/pre-write.sh`. O default é dry-run (`emergent_strict_mode: false` em `hooks/config.json`); exit 2 só com esse knob, não porque Soft virou Strict. No Grok sem hooks-trust o hook não corre (fail-open). Ele só olha acréscimo de task ou fase sem `provenance` em `plan.md`, `phases/*.md` e iniciativas. Não bloqueia escrita de produto. A caneta não o substitui.
- **P3 Três hosts** — Claude Code, Codex e Grok. O mesmo programa. Cursor e Gemini ficam de fora: neles o hook de projeto é no-op.
- **P4 Caneta ou não parte** — Se o PreToolUse não der exit 2 de verdade no host atual, o programa recusa a partida. Sem o lock `.atomic-skills/status/automate/pen.lock` a caneta não bloqueia o uso normal. Com o lock, escrita fora do worktree do writer e qualquer shell saem exit 2. `SKIP` não desliga a caneta.
- **P5 Fechado até cartão e protótipo** — Flow (`find-missing-flow.js --strict`), o arquivo de status da review e ground truth são necessários e não bastam. Esse arquivo só vale se o programa disparou o CLI que não é o harness aberto, esperou o processo e gravou comando, exit, stderr e veredito. A linha `- internal:` escrita pela sessão não abre a flag. A flag não abre enquanto não existirem `scripts/find-missing-architecture.js` e `scripts/find-missing-ui.js` com carimbo válido. `userApproved` no recibo `.atomic-skills/status/design-gates/<projectId>-<slug>.json` (`scripts/design-gates.js`) não substitui nenhum dos dois. Esse campo não está no `design.md`.
- **P6 A sessão só orquestra** — A sessão que inicia o programa não escreve produto, não revisa e não fecha fase. Ela despacha um agente isolado por passo. A unidade é a fase corrente, com todas as tasks `pending` na ordem do frontmatter. O marco da F3 prova um writer e um merge e o teste desse marco para aí. O programa terminado não para no merge. Review both, fechamento, fase seguinte, review final, audit e o PR sem merge são o fluxo de intenção.
- **P7 O cartão é o desenho** — Dois esboços: o que ficou fora, a linha da mistura ou “não mistura”, e o segundo esboço com a lista de fora vazia. “Nada fora” é opção, não default. Curta `revisao-2-camadas`: a música fica fora do corte; cortar o áudio para caber é a mistura proibida.
- **P8 O flow audita o comportamento depois** — O grafo ratificado passa a ser a fonte de verdade do audit, por fase e na página final. Onde `businessIntent` e o grafo discordam, vale o grafo. O flow não substitui o cartão nem a review de bug.
- **P9 Sem daemon** — Fila, vários hosts e spawn adapter multi-máquina ficam de fora. `userValidatedAt` só nasce do botão da página final. Archive continua depois desse botão.

## 3. Phase tree

_(Canonical list in frontmatter `phases:`. aiDeck renders the tree visually when running.)_

## Fluxo de intenção

A sessão que inicia só orquestra. Cada passo abaixo corre num agente isolado. A sessão não escreve produto, não revisa, não corrige e não fecha fase.

1. Antes da primeira fase, uma pergunta. Qual CLI externo revisa este plano. A resposta grava `reviewExternalCli` no plano (`claude`, `codex` ou `grok`, e não é o host aberto). Both é a review local mais esse CLI. O meio da corrida não pergunta de novo.
2. A unidade é a fase corrente. O agente de implementação recebe todas as tasks `pending` dessa fase, na ordem do frontmatter. Não há escolha de uma task nem de um subconjunto. Fase sem task `pending` não despacha writer.
3. Terminou a fase, outro agente roda a review both. O recibo traz comando, exit, stderr e veredito. A linha `- internal:` não conta. Sem veredito não conta.
4. Se a review trouxer critical ou major, um agente isolado corrige esses findings e a review volta. O teto é 3 reviews. Menor não bloqueia.
5. Sem critical e sem major, os findings restantes vão para `.atomic-skills/status/automate/<slug>.json`. Esse arquivo também é o resume se o processo cai. Um agente isolado fecha a fase, valida o claim, passa no product fence e abre a seguinte.
6. Na terceira review, critical ou major abre travei. Não avança. Mistura do bloco carimbado não entra no loop. Abre mudança grande na hora.
7. Sempre há uma review both no fim de cada fase, inclusive quando a fase não tem task complexa. Task complexa (`weight >= 3`, tag `complex`, `destructive`, `decommission` ou `drop`, ou diff destrutivo) entra nessa review, antes do fechamento. O brief leva o grafo ratificado e o esboço escolhido.
8. Na última fase fechada, o mesmo loop de 3 reviews roda sobre o plano inteiro. Depois o mesmo loop roda sobre o `audit-delivery`.
9. O programa abre o PR e não faz merge. A página mostra o relatório, com os findings guardados, `said` e `saw`. O botão grava `userValidatedAt`. Chat “ok” não grava.

## Portas automáticas

Uma porta é um script que o programa roda. Exit diferente de 0 impede o passo seguinte. O passo seguinte lê o status que só essa porta grava. Texto na skill não é porta. A sessão não chama a porta. Quem encadeia é `scripts/automate-run.js`.

`scripts/find-unreviewed-plans.js` hoje aceita a linha `- internal:` como recibo (`reviewReceiptGap`). A CLI não tem `--require-external`: o argv[2] é o alvo. A T-003 da F0 cria essa flag (exit 1 quando a única linha é `- internal:` ou não há recibo de CLI externo) e a partida passa a chamá-la. Sem o recibo do CLI externo, sai 1.

Portas de todo plano que o programa executa, inclusive este:

| Passo | Script | Sai 1 quando |
|---|---|---|
| Partida | `automate-run.js` | caneta sem prova real, `find-missing-flow.js --strict` falha, review sem recibo externo, ground truth sem `fp=` fresco, cartão ou protótipo ausente, `reviewExternalCli` vazio ou igual ao host aberto |
| Antes do writer | `automate-run.js` | a fase não tem task `pending`, ou a porta anterior não gravou exit 0 |
| Review da fase | `automate-run.js` | não há recibo both desta fase, o CLI não é o `reviewExternalCli`, não há veredito, ou há critical ou major |
| Loop | status `.atomic-skills/status/automate/<slug>.json` | a quarta review ainda tem critical ou major. O contador só o programa incrementa |
| Fechar e avançar | `automate-run.js` | não há `advanceOk` no status, o claim não fecha, ou `src/automate-product-fence.js` falha |
| Fim | `automate-run.js` | a review final ou o audit ainda tem critical ou major, o PR não existe, o PR está merged, ou `userValidatedAt` foi escrito fora do botão |

Portas deste plano, enquanto ele está sendo construído. Cada fase só fecha com o teste dela em exit 0. Esse teste é a prova de que o código segue o pedaço do fluxo. Sem o teste, a fase não fecha.

| Fase | O teste recusa |
|---|---|
| F0 | partida sem caneta, sem flow, ou com review só `- internal:` |
| F1 | plano sem os dois esboços, ou `userApproved` no lugar do cartão |
| F2 | `sem tela` com superfície de UI, ou `exitGateType: ui-gate` no lugar de `ui/ui.json` |
| F3 | writer que não faz merge, ou este marco abrindo a fase seguinte |
| F4 | CLI pedido no meio, avanço com critical ou major, quarta review que avança, mistura do bloco dentro do loop, audit sem linha do xor, fechamento sem o fence |
| F5 | PR merged, botão que grava sem `deliveryAuditGate` passed, archive rodando nesse comando |

O mesmo `automate-run.js` aplica a tabela de cima a este plano. Flow ratificado, recibo externo e ground truth com `fp=` fresco são obrigatórios antes de implementar. A linha `- internal:` que este arquivo já tem não abre essa porta.

## Código que as fases têm de respeitar

- F0 registra `automate-pen.sh` ao lado de `skills/shared/project-assets/hooks/pre-write.sh`. Não apaga o `pre-write.sh` e não troca o matcher dele. `SKIP` e `SKIP-EMERGENT` desligam o `pre-write.sh` por 24h e não desligam a caneta. `stop.sh` (drift de escopo no Stop) fica fora desta caneta. A mesma regra está nas rules, no outOfScope e na T-002 da initiative F0. A T-003 recusa um `assessHostWrite` com a prova desligada.
- `find-unreviewed-plans.js` não parseia flags. `reviewReceiptGap` zera com `- internal:`. `automate-run.js` hoje chama o detector sem `--require-external`. A T-003 cria a flag e a partida a usa. Sem isso, a linha `- internal:` deste plano passa na porta de review.
- `reviewExternalCli` não está em `meta/schemas/plan.schema.json`. F4 T-001 grava o campo no plano e no schema.
- `src/decision-log.js` exige `id/category/decision/why/evidencePath/impact/at`. Não tem `said` nem `saw`. F5 T-001 acrescenta as duas frases.
- A entrada do programa é `node scripts/automate-run.js --host … --plan …`. `parseImplementMode` só lê `--mode=automate`. A skill `implement.md` continua o maestro (`assert-automate-gate`, `automate-phase-run.js`); P2: isso não é o enforce da flag.
- F1 T-002 não usa `scripts/find-missing-design-process.js` nem o `userApproved` do recibo design-gates. F2 T-002 não trata `exitGateType: ui-gate` como carimbo. F3 T-002 e T-003, F4 T-002 e F5 T-002 carregam o mesmo limite que o goal. Os sidecars `.source.json` têm esse texto.
- Cursor, Gemini, OpenCode, GitHub Copilot e IDE genérico já são no-op de hook. P3 continua só com Claude Code, Codex e Grok.
- A caneta em `src/automate-host-pen.js`, `scripts/automate-pen-hook.js`, `scripts/automate-run.js` e `skills/shared/project-assets/hooks/automate-pen.sh` está no branch (`d62083df`) e é a F0 em andamento. `assessHostWrite` ainda recusa com a prova de escrita do host desligada. As tasks da F0 continuam pending até essa prova.
- `src/maestro-cursor.js` (`lastAssert`) continua o cursor da sessão. A sessão orquestradora não grava esse cursor. O agente que fecha a fase pode, porque o fechamento passa pelo gate.

## Self-review against code-quality gates

- G1 read-before-claim: claims about `isAutomateActive`, `assert-automate-gate`, and the existing detectors name files that exist in this repo (`src/implement-mode.js`, `scripts/find-missing-flow.js`, `scripts/serve-flow.js`, `tests/phase-review-gate.test.js`). The detectors `find-missing-architecture.js` and `find-missing-ui.js` are outputs of F1 and F2, not present yet. P2 names `pre-write.sh`. P5 names `scripts/design-gates.js`.
- G2 soft-language: ban-list grep on this file found 0.
- G6 reference-or-strike: the narrative and phase goals do not carry `verified_by:` or `unverified:` on each sentence. Bare assertions remain in the body and in `phases[]`.
- Initiative-depth: 1/6 initiatives materialized (F0). F1–F5 stay descriptor-only. Their `.source.json` tasks now carry the same limits as the phase goals. `projects/atomic-skills/real-automate/source.md` matches those goals and P2/P5.
- Ground-truth: Status=complete-with-findings; mode=ground-truth; premises=17 (missing=0, false=0); impacts=21 (direct=17, indirect=4); detector exit checked in this pass.
- Operator ratification 2026-09-25: P5 and F4. The program runs the slice flow. It spawns the CLI that is not the open harness, waits, and writes the review status file with command, exit, stderr, and verdict. A session-written `- internal:` line does not open the flag. Output without a verdict does not count. A non-zero exit stores the real stderr and does not count as a passed external review.

## Ground-truth review

**Status:** complete-with-findings
**Codebase class:** populated
**Scanned:** `src/**/*.js` (86), `scripts/**/*.js` (99), `skills/shared/project-assets/hooks/` (6), `skills/core/implement.md`, `skills/core/audit-delivery.md`, `tests/phase-review-gate.test.js`, `tests/automate-host-pen.test.js`, `tests/design-gates.test.js`, `meta/schemas/plan.schema.json`
**Commit:** uncommitted
**At:** 2026-09-25T18:19:06Z

### A — Plan premises vs code

| # | Premise | Result | Evidence |
|---|---------|--------|----------|
| 1 | `isAutomateActive` nasce ligado quando não há opt-out | ok | `src/implement-mode.js:9`, `:241-242` |
| 2 | O gate `assert-automate-gate` existe e a sessão só avança se o modelo chamar o CLI | ok | `scripts/assert-automate-gate.js`; `skills/core/implement.md:32` |
| 3 | Não existe flag `--unattended` no código de produto | ok | busca em `*.js`: só comentário em `src/uninstall.js:222` |
| 4 | `find-missing-flow.js`, `find-unreviewed-plans.js` e `find-plans-missing-ground-truth.js` existem | ok | os três estão em `scripts/` |
| 5 | `find-missing-architecture.js` e `find-missing-ui.js` ainda não existem; F1 e F2 os criam | ok | ausência em `scripts/`; não são premissa de existência |
| 6 | `serve-flow.js --up` existe | ok | `scripts/serve-flow.js:5` |
| 7 | `tests/phase-review-gate.test.js` existe | ok | arquivo presente |
| 8 | `src/providers/skills-file-set.js` e `skills/shared/project-assets/project-setup.md` existem | ok | os dois estão no worktree |
| 9 | Hook de projeto em Cursor e Gemini é no-op | ok | `skills/shared/project-assets/project-setup.md:29`, `:55` |
| 10 | O PreToolUse antigo é `pre-write.sh`: dry-run por default, fail-open no Grok sem hooks-trust, e só olha acréscimo sem `provenance` em plano, fases e iniciativas | ok | `pre-write.sh:4-9`, `:24-25`, `:92-117`, `:329-339`, `:454-468`; `hooks/config.json:3`; `hooks/README.md:32` |
| 11 | `userApproved` está no recibo `.atomic-skills/status/design-gates/<projectId>-<slug>.json`, não no `design.md` | ok | `scripts/design-gates.js:6`, `:91`, `:133` |
| 12 | Os três hosts da caneta são Claude Code (`Write`/`Edit`/`MultiEdit`/`Bash`), Codex (`apply_patch`/`shell`) e Grok (`write`/`search_replace`/`run_terminal_command`) | ok | `src/automate-host-pen.js:16-31` |
| 13 | A decisão de origem está em `.ai/memory/decisao-unattended-bloco.md` | ok | arquivo presente no worktree |
| 14 | `deliveryAuditGate` existe e o módulo não lê `flow.json` | ok | `src/phase-delivery-audit-gate.js:5`; busca `flow.json` em `src/**/*.js` sem ocorrência |
| 15 | `find-unreviewed-plans.js` não tem `--require-external`; `reviewReceiptGap` aceita `- internal:`; a T-003 cria a flag e a partida passa a chamá-la | ok | `scripts/find-unreviewed-plans.js:40-51`, `:150-166`; `scripts/automate-run.js:176-178` chama sem a flag |
| 16 | `reviewExternalCli` não existe no schema do plano; F4 T-001 cria o campo | ok | `meta/schemas/plan.schema.json` sem o campo |
| 17 | `parseImplementMode` não reconhece `--automate` (só `--mode=automate`); a entrada do programa é `node scripts/automate-run.js` | ok | `src/implement-mode.js:79-83`; `scripts/automate-run.js:10` |

### B — Code present, plan silent (impact candidates)

| # | Finding | Location | Impact | Disposition |
|---|---------|----------|--------|-------------|
| 1 | `pre-write.sh` continua registrado ao lado da caneta. `SKIP` / `SKIP-EMERGENT` desligam só esse hook | `skills/shared/project-assets/hooks/pre-write.sh:329-339`; `src/providers/skills-file-set.js:209-217` | direct | P2, rules e T-002 da initiative F0 |
| 2 | `stop.sh` é o gate de drift no Stop, com knob próprio `strict_mode` | `skills/shared/project-assets/hooks/stop.sh`; `hooks/README.md:27-28` | indirect | accepted: fora da caneta, na mesma seção |
| 3 | `automate-phase-run.js` já prepara worktree e não dispara writer | `scripts/automate-phase-run.js:3-10` | direct | F3 T-002: o worktree nasce em `automate-run.js` |
| 4 | `assert-automate-gate --gate done` aplica `src/automate-product-fence.js` | `src/automate-orchestrator-gates.js:41`, `:303` | direct | F3 não fecha a fase. F4 fecha, valida o claim e passa no fence, em agente isolado |
| 5 | `phase-delivery-audit-gate.js` fecha a fase sem ler o grafo | `src/phase-delivery-audit-gate.js:5` | direct | F4 T-002: estender esse gate |
| 6 | `userValidationOk` aceita qualquer ISO em `userValidatedAt` | `src/plan-end-review.js:325-333`; `scripts/assert-automate-gate.js:1128-1136` | direct | F5 T-002: só o botão escreve, e a sessão não passa |
| 7 | OpenCode, GitHub Copilot e IDE genérico também são no-op de hook | `skills/shared/project-assets/hooks/README.md:21` | indirect | accepted: mesma classe de Cursor e Gemini; P3 não os inclui |
| 8 | A caneta já está no branch e `assessHostWrite` recusa com a prova desligada | `scripts/automate-run.js:167-172`; `src/automate-host-pen.js:152-160` | direct | T-003 da initiative F0: prova desligada não conta |
| 9 | `lastAssert` em `src/maestro-cursor.js` é o cursor da sessão | `src/maestro-cursor.js:18` | indirect | a sessão orquestradora não grava. O agente que fecha a fase pode, porque o fechamento passa pelo gate |
| 10 | `find-missing-design-process.js` e o `userApproved` do recibo design-gates já existem e não são o cartão | `scripts/find-missing-design-process.js`; `scripts/design-gates.js:6`, `:91` | direct | F1 T-002: o cartão é `architecture/decisions.json` |
| 11 | `exitGateType: ui-gate` existe no schema e nenhum detector em `src/` lê esse campo | `meta/schemas/plan.schema.json:655-659` | direct | F2 T-002: o carimbo é `ui/ui.json` |
| 12 | `serve-flow.js` só serve o preview de `flow.html` | `scripts/serve-flow.js:5`; `scripts/lib/serve-flow.js:63` | direct | F5 T-002: o preview do flow continua; a página é outra vista |
| 13 | `reviewReceiptGap` aceita `- internal:`; `automate-run.js` chama o detector sem `--require-external` | `scripts/find-unreviewed-plans.js:40-51`; `scripts/automate-run.js:176-178` | direct | F0 T-003 cria a flag e a partida a usa |
| 14 | `reviewExternalCli` não está no schema do plano | `meta/schemas/plan.schema.json` | direct | F4 T-001 grava o campo no plano e no schema |
| 15 | `decision-log.js` não tem `said` nem `saw` | `src/decision-log.js:34-42` | direct | F5 T-001 acrescenta as duas frases |
| 16 | `implement.md` ainda encadeia maestro via `assert-automate-gate` e `automate-phase-run.js` | `skills/core/implement.md:32`, `:181` | direct | P2 / F3 T-002: a skill não é o enforce; worktree nasce em `automate-run.js` |
| 17 | O phase-done atual exige evaluation, lessons e decision-review | `src/automate-orchestrator-gates.js:15-17` | indirect | accepted: o `implement` sem flag continua esse encadeamento; F4 é o close do programa |
| 18 | Este worktree não tem `.claude/settings.local.json`, `.codex/hooks.json` nem o `hooks.json` do Grok | scan → 0 arquivos | direct | F0 T-002 registra a caneta |
| 19 | `phase-review-gate.js` aceita `mode=local` com `overrideReason` e sem stderr de processo | `src/phase-review-gate.js:361-377` | direct | F4 T-001: `overrideReason` sem stderr do CLI externo não passa |
| 20 | `writer-lease.js`, `automate-work-order.js`, `automate-sealed-brief.js` e `automate-phase-run-lib.js` já montam lease, work-order e brief | `src/writer-lease.js:1-13`; `scripts/automate-phase-run.js:3-10` | direct | F3 T-002: o programa não chama `automate-phase-run.js`; o lease fica no spawn |
| 21 | `complex-task.js` e `automate-complex-from-initiative.js` já classificam task complexa (`weight >= 3`) | `src/complex-task.js:3-6`, `:16-17` | direct | F4 T-001: task complexa entra na mesma review |

**Counts:** premises=17 (missing=0, false=0); impacts=21 (direct=17, indirect=4)

## Reviews

- internal: 2 finding(s) applied @ uncommitted (2026-09-25T03:40:00Z)
- cross-model (codex): needs_changes (resolved) — .atomic-skills/reviews/2026-09-25-real-automate-plan.md
- ground-truth: complete-with-findings | mode=ground-truth | fp=c4e4e43ca052 | premises=17 | impacts=21 @ uncommitted (2026-09-25T18:19:06Z)
