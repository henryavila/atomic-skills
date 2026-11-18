---
schemaVersion: "0.1"
slug: real-automate
title: real-automate
version: "1.0"
status: done
executionMode: automate
started: 2026-09-25T03:17:12.483Z
lastUpdated: 2026-10-03T05:42:47.946Z
branch: plan/real-automate
currentPhase: F5
parallelismAllowed: false
principles:
  - id: P1
    title: Dois comandos
    body: "`implement` sem flag continua a sessão que escreve. `implement
      --automate` é um programa em primeiro plano, um plano, nesta máquina. A
      sessão do chat não é esse programa."
  - id: P2
    title: A skill não é o enforce
    body: >
      Mais parágrafos na skill não substituem o processo. O PreToolUse antigo é

      `skills/shared/project-assets/hooks/pre-write.sh`. O default é dry-run

      (`emergent_strict_mode: false` em `hooks/config.json`); exit 2 só com esse

      knob, não porque Soft virou Strict. No Grok sem hooks-trust o hook não

      corre (fail-open). Ele só olha acréscimo de task ou fase sem `provenance`

      em `plan.md`, `phases/*.md` e iniciativas. Não bloqueia escrita de
      produto.

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
      lock. Além disso, uma chamada de escrita do próprio host (Claude, Codex ou
      Grok) tem de ser recusada e não pode deixar arquivo no disco. Sem essa
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
          status: met
          metAt: 2026-09-25T22:30:18.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-09-25T22:30:18.000Z
            verifiedCommit: caba63fbd0bfb8c7bf648a06906d87e55c0dd428
            passed: true
            exitCode: 0
            outputSummary: "node --test tests/automate-host-pen.test.js: 32 pass / 0 fail"
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: done
    businessIntent:
      value: |
        O comando automate deixa de ser a mesma sessão que escreve. Quem corre
        node scripts/automate-run.js vê a partida recusada até a caneta do host,
        o flow, a revisão do plano e o ground truth existirem, e também enquanto
        os detectores de cartão e protótipo não existem.
      workflow: >
        O operador passa --host claude-code, codex ou grok e --plan. O

        programa lê o hook daquele host, cria um lock de prova isolado (não o

        pen.lock), exige status 2 no script e status 0 sem lock, dispara uma

        escrita real pela ferramenta do host e só segue se ela for recusada e

        não gravar arquivo, apaga o lock de prova, roda find-missing-flow.js

        --strict,

        find-unreviewed-plans.js --require-external e

        find-plans-missing-ground-truth.js, e confere se

        find-missing-architecture.js e find-missing-ui.js existem.
        `--require-external`

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
      verifiedAt: 2026-09-25T22:30:18.000Z
      at: caba63fbd0bfb8c7bf648a06906d87e55c0dd428
    lessonsState: none
    noneReason: >
      F0 evaluation returned notes only after review fixes. Clean phase: no
      remaining blocker/critical/major on residual check.
    reviewGate:
      status: passed
      mode: both
      at: caba63fbd0bfb8c7bf648a06906d87e55c0dd428
      reviewFile: .atomic-skills/reviews/2026-09-25-real-automate-F0-residual-local.md
      localReceiptPath: .atomic-skills/reviews/2026-09-25-real-automate-F0-residual-local.md
      codexReceiptPath: .atomic-skills/reviews/2026-09-25-real-automate-F0-residual-codex.md
      verifiedAt: 2026-09-25T22:30:18.000Z
    decisionReview:
      status: passed
      verifiedAt: 2026-09-25T22:30:18.000Z
      packagePresentedAt: 2026-09-25T22:30:18.000Z
      packagePath: .atomic-skills/reviews/2026-09-25-real-automate-F0-decision-package.md
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-real-automate-F0.md
      verdict: CLOSED
      verifiedAt: 2026-09-25T22:30:18.000Z
  - id: F1
    slug: real-automate-f1-cartao-de-bloco
    title: Cartão de bloco
    goal: >
      o detector de arquitetura existe e recusa um plano sem os dois esboços

      e sem a escolha carimbada de qual esboço vale. “Nada fora” é uma opção do

      cartão, não a resposta automática. O protótipo cita essa escolha.

      `scripts/find-missing-design-process.js` e o `userApproved` do recibo

      design-gates não são este cartão. O cartão é
      `architecture/decisions.json`,

      lido por `scripts/find-missing-architecture.js`, que esta fase cria.
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: "`node --test tests/find-missing-architecture.test.js` verde."
          status: met
          metAt: 2026-09-25T23:10:00.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-09-25T23:10:00.000Z
            verifiedCommit: 12be5098877a1a22ac9f0307d40fcf246d5cc64e
            passed: true
            exitCode: 0
            outputSummary: node --test tests/find-missing-architecture.test.js 15 pass / 0
              fail
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: done
    businessIntent:
      value: |
        O detector de arquitetura existe e recusa um plano sem os dois esboços
        do bloco e sem a escolha carimbada de qual esboço vale. Nada fora é
        opção do cartão, não default.
      workflow: |
        O plano guarda architecture/decisions.json com delimitador, lista do
        que ficou fora, linha da mistura ou não mistura, segundo esboço com
        fora vazio, e o esboço escolhido. find-missing-architecture.js lê esse
        arquivo e sai 0 só com sha e ratifiedAt. automate-run.js chama o
        detector em vez de só checar se o arquivo existe.
      rules: |
        Proíbe as frases se eu mexer nisto, a outra, consistente e isolado sem
        o desenho. find-missing-design-process.js e userApproved do recibo
        design-gates não satisfazem. Chat ok não carimba.
      outOfScope: |
        Protótipo de tela (F2), spawn do writer, merge, review both, audit do
        flow, página final.
      doneWhen: |
        node --test tests/find-missing-architecture.test.js passa, um fixture
        sem carimbo sai 1 em find-missing-architecture.js --strict, e
        automate-run.js --host grok --plan num fixture sem cartão sai 1 com o
        motivo do detector.
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-real-automate-F1.md
      verifiedAt: 2026-09-25T23:10:00.000Z
      at: 12be5098877a1a22ac9f0307d40fcf246d5cc64e
    lessonsState: none
    noneReason: >
      F1 chosen-sketch and phrase-matching findings were fixed. Residual notes
      only.
    reviewGate:
      status: passed
      mode: both
      at: 12be5098877a1a22ac9f0307d40fcf246d5cc64e
      reviewFile: .atomic-skills/reviews/2026-09-25-real-automate-F1-local.md
      localReceiptPath: .atomic-skills/reviews/2026-09-25-real-automate-F1-local.md
      codexReceiptPath: .atomic-skills/reviews/2026-09-25-real-automate-F1-codex-stderr.md
      overrideReason: |
        Codex exec HTTP 401 Unauthorized; stderr stored as the external receipt.
      verifiedAt: 2026-09-25T23:10:00.000Z
    decisionReview:
      status: passed
      verifiedAt: 2026-09-25T23:10:00.000Z
      packagePresentedAt: 2026-09-25T23:10:00.000Z
      packagePath: .atomic-skills/reviews/2026-09-25-real-automate-F1-decision-package.md
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-real-automate-F1.md
      verdict: CLOSED
      verifiedAt: 2026-09-25T23:10:00.000Z
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
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: "`node --test tests/find-missing-ui.test.js` verde."
          status: met
          metAt: 2026-10-02T11:33:00.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-10-02T11:33:00.000Z
            verifiedCommit: 48b943e3a6b788f0dfb151067083e0625c27e8ea
            passed: true
            exitCode: 0
            outputSummary: "node --test tests/find-missing-ui.test.js: ℹ tests 28 ℹ pass 28
              ℹ fail 0"
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: done
    businessIntent:
      value: >
        O detector de tela existe e recusa planos sem carimbo de protótipo de
        UI.

        Planos sem superfície visível registram explicitamente "sem tela" com
        justificativa,

        e tasks que tocam UI (Vue, sheet, viewer, editor) são impedidas de usar
        "sem tela".

        O carimbo da tela vincula o sha do cartão de arquitetura.
      workflow: >
        O plano guarda ui/ui.json listando telas com path do protótipo e sha,

        ou { "none": true, "reason": "..." }. scripts/find-missing-ui.js lê esse
        arquivo,

        valida a ausência de toque em UI quando none: true, confere consistência
        com o

        sha do cartão (architecture/decisions.json) e sai 0 apenas com carimbo
        íntegro.

        automate-run.js passa a executar esse detector em vez de apenas
        verificar existsSync.
      rules: >
        exitGateType: ui-gate no plano não substitui o carimbo ui/ui.json.

        "Sem tela" (none: true) é proibido se qualquer task do plano tocar Vue,
        sheet,

        viewer ou editor. Sha divergente do cartão de arquitetura é recusado.
        Chat ok não carimba.
      outOfScope: >
        Spawn de writer, criação de worktree de writer, merge (F3), review-both
        e

        fechamento de fase no loop automate (F4), página final (F5). Não altera
        o detector de arquitetura.
      doneWhen: >
        node --test tests/find-missing-ui.test.js passa (verde), node
        scripts/find-missing-ui.js

        --strict em fixture vazio ou inconsistente sai 1, e automate-run.js
        invoca find-missing-ui.js

        reportando o motivo do detector quando o carimbo falta.
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-real-automate-F2.md
      verifiedAt: 2026-10-02T10:44:05.000Z
      at: 48b943e3a6b788f0dfb151067083e0625c27e8ea
    lessonsState: recorded
    lessonsPath: .atomic-skills/projects/atomic-skills/real-automate/lessons/real-automate-f2-prototipo.md
    reviewGate:
      status: passed
      mode: both
      at: 48b943e3a6b788f0dfb151067083e0625c27e8ea
      reviewFile: .atomic-skills/reviews/2026-10-02-real-automate-F2-residual-local.md
      localReceiptPath: .atomic-skills/reviews/2026-10-02-real-automate-F2-residual-local.md
      codexReceiptPath: .atomic-skills/reviews/2026-10-02-real-automate-F2-residual-codex.md
      verifiedAt: 2026-10-02T11:30:27.327Z
    decisionReview:
      status: passed
      verifiedAt: 2026-10-02T11:32:00.000Z
      packagePresentedAt: 2026-10-02T11:31:00.000Z
      packagePath: .atomic-skills/reviews/2026-10-02-real-automate-F2-decision-package.md
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-real-automate-F2.md
      verdict: CLOSED
      verifiedAt: 2026-10-02T11:33:00.000Z
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
          status: met
          metAt: 2026-10-02T16:12:00.000Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-10-02T16:12:00.000Z
            verifiedCommit: c3fa0dcd5c0c2961b46f84842267de43c6abccc1
            passed: true
            exitCode: 0
            outputSummary: "node --test tests/automate-run-writer.test.js: ℹ tests 22 ℹ pass
              22 ℹ fail 0"
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: done
    businessIntent:
      value: |
        Com caneta, flow, revisão, ground truth, cartão e protótipo válidos, o
        programa cria o worktree, grava pen.lock com dono, pid e writerWorktree,
        dispara um writer do CLI do host, integra no branch do plano, mata o
        writer se ainda viver e solta o lock.
      workflow: >
        scripts/automate-run.js, depois dos seis gates, cria o worktree do
        writer,

        escreve .atomic-skills/status/automate/pen.lock, spawna claude ou codex
        ou

        grok nesse worktree com lease, espera, faz merge no branch do plano,
        mata

        o writer se o pid ainda viver, apaga o lock inclusive em falha. Não
        chama

        scripts/automate-phase-run.js. O teste do marco para depois do merge.
      rules: >
        A sessão do chat não é o writer. O shell da sessão fica negado. Quem
        roda

        verifier é o programa. Lock de pid morto não bloqueia a sessão. Esta
        fase

        não roda phase-done, review both, nem audit. A sessão não grava
        lastAssert.
      outOfScope: |
        Fechamento de fase, claim e src/automate-product-fence.js (F4). Página
        final (F5). Não materializa a fase seguinte. Não chama
        scripts/automate-phase-run.js.
      doneWhen: >
        Um teste de integração com host falso sai 0, o arquivo que o writer
        gravou

        está no branch do plano, e uma segunda fase não foi materializada.
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-real-automate-F3.md
      verifiedAt: 2026-10-02T16:05:21.000Z
      at: c3fa0dcd5c0c2961b46f84842267de43c6abccc1
    lessonsState: none
    noneReason: >
      Post-fix1 evaluation notes only. Operator accepted remaining residual
      (git-before-lease concurrent, EPERM-as-dead, phaseId path, branch -D on
      failure, coordinator vs child pid) as outside the one-writer F3 slice.
    reviewGate:
      status: passed
      mode: both
      at: c3fa0dcd5c0c2961b46f84842267de43c6abccc1
      reviewFile: .atomic-skills/reviews/2026-10-02-real-automate-F3-fix1-local.md
      localReceiptPath: .atomic-skills/reviews/2026-10-02-real-automate-F3-fix1-local.md
      codexReceiptPath: .atomic-skills/reviews/2026-10-02-real-automate-F3-fix1-codex.md
      verifiedAt: 2026-10-02T16:10:00.000Z
    decisionReview:
      status: passed
      verifiedAt: 2026-10-02T16:12:00.000Z
      packagePresentedAt: 2026-10-02T16:11:00.000Z
      packagePath: .atomic-skills/reviews/2026-10-02-real-automate-F3-decision-package.md
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-real-automate-F3.md
      verdict: CLOSED
      verifiedAt: 2026-10-02T16:12:00.000Z
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
    subPhaseCount: 3
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
          status: met
          metAt: 2026-10-02T19:50:53.736Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-10-02T19:50:53.736Z
            verifiedCommit: dba1f00353aa9d9d7fddc2e435bc90382deebfc3
            passed: true
            exitCode: 0
            outputSummary: "node --test tests/phase-review-gate.test.js: ℹ tests 45 ℹ pass
              45 ℹ fail 0"
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
    status: done
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-real-automate-F4.md
      verifiedAt: 2026-10-02T19:35:00.000Z
      at: 8ff7215676d2913c755c7a240cf0e15fd428f832
    lessonsState: recorded
    lessonsPath: .atomic-skills/projects/atomic-skills/real-automate/lessons/real-automate-f4-review-e-o-flow-no-audit.md
    reviewGate:
      status: passed
      mode: both
      at: 771849b2229dbf66fc57a4571d89a414fba8c54b
      reviewFile: .atomic-skills/reviews/2026-10-02-real-automate-F4-local.md
      localReceiptPath: .atomic-skills/reviews/2026-10-02-real-automate-F4-local.md
      codexReceiptPath: .atomic-skills/reviews/2026-10-02-real-automate-F4-codex.md
      verifiedAt: 2026-10-02T19:38:21.061Z
    decisionReview:
      status: passed
      verifiedAt: 2026-10-02T19:40:00.000Z
      packagePresentedAt: 2026-10-02T19:39:00.000Z
      packagePath: .atomic-skills/reviews/2026-10-02-real-automate-F4-decision-package.md
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-real-automate-F4.md
      verdict: CLOSED
      verifiedAt: 2026-10-02T19:45:00.000Z
    businessIntent:
      value: |
        O programa conduz cada fase até a seguinte. Uma pergunta no começo grava
        `reviewExternalCli`. Both é a review local mais esse CLI, com recibo
        real (comando, exit, stderr, veredito). O audit lê `flow/flow.json` no
        `ratifiedGraphSha` e cobra cada máquina e cada xor. Sem critical/major
        a fase fecha (claim + `automate-product-fence.js`) e a seguinte abre;
        na terceira review, critical ou major para.
      workflow: |
        Antes da primeira fase `automate-run.js` pergunta o CLI externo uma vez
        e grava `reviewExternalCli` no plano e no schema. Dispara o CLI, espera
        o processo, grava o recibo. `src/phase-review-gate.js` recusa
        `overrideReason` sem stderr desse processo e recusa recibo escrito pela
        sessão. Um agente isolado implementa as tasks `pending` na ordem do
        frontmatter; outro roda both. Critical ou major dispara correção isolada
        e a review volta, teto 3. Sem critical/major os findings restantes vão
        para `.atomic-skills/status/automate/<slug>.json`.
        `src/phase-delivery-audit-gate.js` passa a ler o grafo; fechar a fase
        valida o claim e passa em `src/automate-product-fence.js`.
      rules: |
        No meio da corrida ninguém pergunta de novo o CLI. A linha
        `- internal:` não substitui o recibo. Saída sem veredito não conta.
        Exit diferente de 0 guarda o stderr real. O brief leva o grafo e o
        esboço escolhido. Task complexa entra nesta mesma review, antes de
        fechar. Achado de mistura do bloco não entra no loop e para na hora.
        Onde `businessIntent` e o grafo discordam, vale o grafo. A página
        final não substitui este gate.
      outOfScope: |
        Página final, botão `userValidatedAt`, PR e archive (F5). Não reabre
        o marco F3 de um writer/merge. Não chama `scripts/automate-phase-run.js`
        no lugar de `scripts/automate-run.js`. Fila, vários hosts e spawn
        adapter multi-máquina (P9).
      doneWhen: |
        `node --test tests/phase-review-gate.test.js` recusa `overrideReason`
        sem stderr do CLI externo e recusa recibo escrito pela sessão. Um
        fixture de `flow.json` com um xor sem linha no relatório de audit
        falha. Um achado de mistura do bloco não entra no loop e para na hora.
        Sem critical e sem major a fase fecha e a seguinte abre; na terceira,
        critical ou major para.
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
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: G-1
          description: |
            o teste HTTP do botão verde, o PR existe sem merge, e
            archive não roda nesse comando.
          status: met
          verifier:
            kind: manual
            description: Verify exit-gate prose with the user during phase-done.
          metAt: 2026-10-03T05:42:47.946Z
          evidence:
            verifierKind: shell
            verifiedAt: 2026-10-03T05:42:47.946Z
            verifiedCommit: 247b580631708d383f8664881f92246165ec8506
            passed: true
            exitCode: 0
            outputSummary: "Final HTTP verifier passed; actual PR #50 OPEN/unmerged, no
              whole-plan archive."
    status: done
    businessIntent:
      value: >
        Um servidor no hábito de `serve-flow.js --up` mostra o que foi

        carimbado, as frases `said` e `saw`, a tela ao lado do construído e o
        que

        ficou de fora. O botão grava `userValidatedAt` só com todo

        `deliveryAuditGate` em passed. Chat ok não grava. O programa entrega o

        branch, abre o PR e não faz merge. Archive fica depois do botão.
      workflow: >
        Cada decisão do JSONL ganha `said` e `saw`. A vista final não abre

        em `file://`. `scripts/serve-flow.js` continua o preview de `flow.html`.
        O

        botão é o único escritor de `userValidatedAt`. `userValidationOk` recusa

        timestamp escrito na sessão. Travei, não avanço e mudança grande abrem a

        mesma origem. No fim do plano o loop de 3 reviews roda sobre o plano e

        depois sobre o `audit-delivery`.
      rules: >
        Chat ok não grava `userValidatedAt`. Timestamp escrito na sessão não

        passa em `assert-automate-gate --gate finalize`. O botão só liga com
        todo

        `deliveryAuditGate` passed. Archive não roda no comando que abre o PR.

        Onde `businessIntent` e o grafo discordam, vale o grafo.
      outOfScope: |
        Merge do PR. Fila, vários hosts e spawn adapter multi-máquina
        (P9). Não reabre o marco F3 de um writer/merge nem o close F4 de review
        e audit da fase. Não chama `scripts/automate-phase-run.js` no lugar de
        `scripts/automate-run.js`.
      doneWhen: |
        `node --test tests/final-page-http.test.js` mostra o botão verde
        só com todo `deliveryAuditGate` passed, o PR existe sem merge, e archive
        não roda nesse comando.
    evaluationGate:
      status: passed
      verdict: pass
      reportPath: .atomic-skills/reviews/eval-real-automate-F5.md
      verifiedAt: 2026-10-03T05:42:47.946Z
      at: 247b580631708d383f8664881f92246165ec8506
    lessonsState: recorded
    lessonsPath: .atomic-skills/projects/atomic-skills/real-automate/lessons/real-automate-f5-pagina-final.md
    reviewGate:
      status: passed
      mode: both
      at: 247b580631708d383f8664881f92246165ec8506
      verifiedAt: 2026-10-03T05:42:47.946Z
      reviewFile: .atomic-skills/reviews/2026-10-03-real-automate-F5-completion-review.json
      localReceiptPath: .atomic-skills/reviews/2026-10-03-real-automate-plan-end-local.json
      codexReceiptPath: .atomic-skills/reviews/2026-10-03-real-automate-F5-authority-tiny-grok.json
    decisionReview:
      status: passed
      verifiedAt: 2026-10-03T05:42:47.946Z
      packagePresentedAt: 2026-10-03T05:42:47.946Z
      packagePath: .atomic-skills/reviews/2026-10-03-real-automate-F5-decision-package.md
    deliveryAuditGate:
      status: passed
      reportPath: .atomic-skills/reviews/audit-delivery-real-automate-F5.md
      verdict: PARTIAL
      verifiedAt: 2026-10-03T05:42:47.946Z
      at: 247b580631708d383f8664881f92246165ec8506
references:
  - kind: url
    label: "PR #50"
    path: https://github.com/henryavila/atomic-skills/pull/50
planTitle: real-automate
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

- G1 read-before-claim: claims about `isAutomateActive`, `assert-automate-gate`, and the existing detectors name files that exist in this repo (`src/implement-mode.js`, `scripts/find-missing-flow.js`, `scripts/serve-flow.js`, `tests/phase-review-gate.test.js`, `scripts/find-missing-architecture.js`, `scripts/find-missing-ui.js`). P2 names `pre-write.sh`. P5 names `scripts/design-gates.js`.
- G2 soft-language: ban-list grep on this file found 0.
- G6 reference-or-strike: the narrative and phase goals do not carry `verified_by:` or `unverified:` on each sentence. Bare assertions remain in the body and in `phases[]`.
- Initiative-depth: 1/6 initiatives materialized (F0). F1–F5 stay descriptor-only. Their `.source.json` tasks now carry the same limits as the phase goals. `projects/atomic-skills/real-automate/source.md` matches those goals and P2/P5.
- Ground-truth: Status=complete-with-findings; mode=ground-truth; fp=1b2f8ea0b87c; premises=17 (missing=0, false=0); impacts=21 (direct=17, indirect=4); detector exit checked in this pass.
- Operator ratification 2026-09-25: P5 and F4. The program runs the slice flow. It spawns the CLI that is not the open harness, waits, and writes the review status file with command, exit, stderr, and verdict. A session-written `- internal:` line does not open the flag. Output without a verdict does not count. A non-zero exit stores the real stderr and does not count as a passed external review.

## Ground-truth review

**Status:** complete-with-findings
**Codebase class:** populated
**Scanned:** src/ and scripts/ → 193 files enumerated; all six phase initiatives and their task targets inspected; focused runtime, validation, review, graph and subprocess APIs read.
**Commit:** a12145cc32a06d8b3fcac8f0a4b7ff182123baea
**At:** 2026-10-03T04:19:40.879Z

### A — Plan premises vs code

| # | Premise | Result | Evidence |
|---|---------|--------|----------|
| 1 | The three host pen and registration helpers exist. | ok | src/automate-host-pen.js:16; scripts/automate-pen-hook.js; src/providers/skills-file-set.js |
| 2 | Strict flow, external plan review, architecture and UI detectors are callable at program entry. | ok | scripts/automate-run.js:901; scripts/find-missing-architecture.js:5; scripts/find-missing-ui.js:5 |
| 3 | A phase writer runs in a sibling worktree with exclusive lease and lock cleanup. | ok | scripts/automate-run.js:602; src/writer-lease.js:302 |
| 4 | Both-review decisions use a three-review ceiling and a distinct residual sidecar. | ok | src/phase-review-gate.js:409; src/phase-review-gate.js:540 |
| 5 | Audit graph coverage is read from the ratified flow and fail-closes on absent subjects. | ok | src/phase-delivery-audit-gate.js:536; scripts/automate-run.js final-audit call |
| 6 | Flow preview remains an HTTP server and supports the final-page routes. | ok | scripts/serve-flow.js; scripts/lib/serve-flow.js:70 |
| 7 | F5 replaces the historical bare-ISO user-validation predicate with authenticated HTTP evidence. | ok | src/plan-end-review.js:331; scripts/assert-automate-gate.js finalize adapter |
| 8 | All named implementation and verifier targets exist after F0–F5 source work. | ok | task-target existence inventory over active F5 and five archived initiatives; no missing target |

### B — Code present, plan silent (impact candidates)

| # | Finding | Location | Impact | Disposition |
|---|---------|----------|--------|-------------|
| 1 | Existing layer-3 prepare/validate infrastructure remains separate from the new product runner. | src/automate-phase-run-lib.js; scripts/automate-phase-run.js | indirect | Existing F3/F5 scope boundary preserves this infrastructure; do not substitute it for the product command. |
| 2 | Authenticated validation uses a private host-local signing key and filesystem proof reader. | src/plan-end-review.js; scripts/lib/serve-flow.js | direct | F5 T-002; lazy runtime key creation is outside installer mutations. |
| 3 | Shared tests asserting bare ISO validation need the new authenticated contract. | tests/implement-automate-contract.test.js:263; tests/plan-end-review.test.js | direct | F5 T-002 shared allow fixtures explicitly admitted; correct the remaining obsolete expectation. |
| 4 | PR-stage retries overwrite reviewed-input identity; repair prompts omit the current findings; OPEN can advance. | scripts/automate-run.js:789; scripts/automate-run.js:812; scripts/automate-run.js:819 | direct | Original defects resolved by fix1. New publishing/transport/input-validation findings are assigned to the same F5 T-003 before closure. |
| 5 | A fresh page can validate changed source against an old completed review. | scripts/lib/serve-flow.js:88 | direct | Original stale-review bypass resolved by fix1. New owned-file/YAML/lifecycle-reference findings and coupled gate instructions are assigned to F5 T-002 before closure. |
| 7 | Final stop rendering reuses a failed delivery snapshot; tracked gitlinks are read as files. | scripts/lib/serve-flow.js:120; src/plan-end-review.js:557 | direct | Assign confirmed final reviewer defects to F5 T-002/T-003; maintain disabled validation for invalid delivery. |
| 6 | Prior F4 automatic phase-driver and first-time reviewer/ground-truth ordering limitations remain. | .atomic-skills/reviews/audit-delivery-real-automate-F4.md Accept Register | direct | Previously operator-accepted H1–H9; F5 outOfScope preserves F4 close. This is an existing residual, not a new acceptance or a claim of a complete phase driver. |

**Counts:** premises=8 (missing=0, false=0); impacts=6 (direct=5, indirect=1)

## Reviews

- internal: 2 finding(s) applied @ uncommitted (2026-09-25T03:40:00Z)
- cross-model (codex): needs_changes (resolved) — .atomic-skills/reviews/2026-09-25-real-automate-plan.md
- ground-truth: complete-with-findings | mode=ground-truth | fp=d95f44b5640c | premises=8 | impacts=7 @ 0ca408865b661f4b0a3556688319e70b163dd641 (2026-10-03T05:06:25.126Z)
