---
schemaVersion: "0.1"
slug: integrity-remediation
title: Remediação integral de segurança, lifecycle e distribuição
version: "1.0"
status: active
started: 2026-07-10T20:07:37.544Z
lastUpdated: 2026-07-14T01:31:57Z
branch: plan/integrity-remediation
currentPhase: F0
parallelismAllowed: false
principles:
  - id: P1
    title: Integridade antes de compatibilidade
    body: conteúdo sem ownership provado nunca é sobrescrito ou apagado; estado
      ambíguo falha fechado.
  - id: P2
    title: Uma autoridade por contrato
    body: o engine upstream governa filesystem e journal; validate-state governa
      invariantes estruturais; adapters governam hosts.
  - id: P3
    title: Evidência observável
    body: suporte, conclusão e recovery são aceitos somente por testes do
      comportamento público.
  - id: P4
    title: Migração conservadora
    body: formatos antigos permanecem legíveis até um commit novo ser comprovado;
      dados ambíguos viram unmanaged.
  - id: P5
    title: Fatias recuperáveis
    body: cada fase termina em estado instalável, validado e reversível.
  - id: P6
    title: Fonte e instalação não divergem
    body: toda dependência runtime citada por uma skill entra no file-set e na
      superfície publicada.
glossary:
  - term: Journal v2
    definition: Protocolo versionado com transaction id, stable effect id, hashes,
      ownership e estado de commit.
  - term: Unmanaged
    definition: Artefato cuja propriedade não foi provada e que
      install/update/uninstall preservam.
  - term: Runtime closure
    definition: Conjunto completo de scripts, assets, schemas e referências
      necessárias para uma skill instalada executar fora deste checkout.
  - term: Preflight
    definition: Validação pura executada antes de verifiers, eventos ou writes de
      uma transição.
  - term: Commit guard
    definition: Releitura final que rejeita estado stale ou contraditório antes de
      gravar fechamento.
  - term: Host contract
    definition: Layout, ferramentas, argumentos, hooks e comportamento observável
      suportados por uma IDE/CLI.
  - term: Support tier
    definition: "`operational` exige probe no host real com versão, discovery, load
      e invoke; `layout-only` prova somente a forma dos artefatos e não autoriza
      declarar suporte operacional."
  - term: Findings manifest
    definition: Inventário canônico source-qualified que liga cada finding a
      reproducer, verifier executado, evidence e candidateSha.
phases:
  - id: F0
    slug: integrity-remediation-f0-runtime-autocontido-e-setup-confiavel
    title: Runtime autocontido e setup confiável
    goal: Destravar a admissão SPEC do próprio executor, fazer toda skill instalada
      resolver scripts, dependências e assets pelo package root confiável,
      distinguir ledger do installer de um projeto configurado e fornecer o
      bootstrap transacional mínimo que materializa F4 sem estado parcial.
    summary: Destrava executor, fecha runtime closure e materializa F4 de forma
      recuperável.
    dependsOn: []
    subPhaseCount: 6
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F0-G1
          description: Admissão SPEC, runtime closure, resolução por package root e
            bootstrap transacional F0→F4 passam em consumidor sem checkout
            fonte. FAILS when `implement` exige `Files`, referência resolve fora
            do tarball ou fault injection deixa descriptor F4 e initiative
            divergentes.
          status: met
          metAt: 2026-07-12T17:08:37Z
          verifier:
            kind: shell
            command: node --test tests/consumer-runtime-resolution.test.js
              tests/runtime-closure.test.js tests/consumer-install-e2e.test.js
              tests/implement-ready-contract.test.js
              tests/phase-materialization/materialize-bootstrap.test.js
              tests/phase-materialization/e2e-lifecycle.test.js
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-12T17:08:37Z
            passed: true
            exitCode: 0
            outputSummary: "node --test: 54 tests, 5 suites, 54 pass, 0 fail, 0
              skipped; duration_ms 43472.904; exit 0; bakery lock claims,
              canonical process identity, stale candidate, publish/rollback
              rechecks, recovery, serial focus, task metadata, businessIntent
              and mode regressions included"
        - id: F0-G2
          description: Project-scope install não mascara ausência de setup canônico. FAILS
            when a pasta do ledger basta para pular setup.
          status: met
          metAt: 2026-07-12T17:08:37Z
          verifier:
            kind: shell
            command: node --test tests/project.test.js
              tests/install-uninstall-roundtrip.test.js
            expectExitCode: 0
          evidence:
            verifierKind: shell
            verifiedAt: 2026-07-12T17:08:37Z
            passed: true
            exitCode: 0
            outputSummary: "node --test: 75 tests, 2 suites, 75 pass, 0 fail, 0
              skipped; duration_ms 20675.814625; exit 0"
    status: active
    reviewGate:
      status: passed
      at: 0ce031d2cebe0a5059a388e99ff6df5432aec4eb
      mode: both
      reviewFile: .atomic-skills/reviews/2026-07-14-1629-integrity-remediation-f0-phase-0ce031d-r21.md
      verifiedAt: 2026-07-14T16:29:03-03:00
    businessIntent:
      value: Eliminar dependências do checkout fonte e impedir que o ledger do
        installer mascare setup ausente, criando uma base confiável para toda a
        remediação.
      workflow: Destravar materialização mínima; executar e reconciliar o lifecycle
        transacional; corrigir o caminho SPEC-implement; então entregar
        segurança do installer, contratos de host, Gemini/portabilidade e
        qualificação de release.
      rules: Nenhuma mutação sem ownership provado; uma autoridade por contrato;
        reprodução vermelha antes de cada correção; execução em consumidor sem
        checkout fonte; falha fechada diante de ambiguidade.
      outOfScope: Fork permanente do installer, banco transacional genérico, redesign
        da interface aiDeck, features não relacionadas e publicação da release.
      doneWhen: O manifesto canônico prova todos os findings formais e adicionais;
        black-box, fault matrix, tiers de host, Linux/macOS/Windows, Node
        22.18.x, Node 24.11.x ou superior, full suite, docs e skill validation
        passam.
  - id: F1
    slug: integrity-remediation-f1-installer-v2-e-protecao-de-dados
    title: Installer v2 e proteção de dados
    goal: Entregar em worktree upstream dedicada e integrar no consumer mutações
      no-follow resistentes a TOCTOU, journal versionado, persistência atômica,
      locks por recurso canônico compartilhado, ownership por hash e recovery
      conservador para install, update e uninstall.
    summary: Confina races e serializa install, update e uninstall por recurso
      recuperável.
    dependsOn:
      - F3
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F1-G1
          description: Toda mutação do installer é confinada por no-follow/handle
            equivalente e preserva conteúdo sem ownership. FAILS when uma
            barreira determinística troca qualquer componente, inclusive leafs
            de write, prune, rollback e origem/destino de temp→rename, e a
            operação altera o sentinel externo, produz efeito parcial ou
            prossegue sem prova atômica.
          status: pending
          verifier:
            kind: shell
            command: node scripts/verify-upstream-receipt.js --task F1/T-006 --worktree
              ../minimalist-installer-integrity-remediation --require-remote &&
              (cd ../minimalist-installer-integrity-remediation && node --test
              test/path-confinement.test.js test/path-mutation-race.test.js
              test/transaction-path-race.test.js
              test/greenfield-conflict.test.js) && node --test
              tests/installer-data-safety.test.js
              tests/minimalist-installer-link.test.js
            expectExitCode: 0
        - id: F1-G2
          description: Transações declaram previamente locks por identidade canônica
            compartilhada, adquirem-nos em ordem total e mantêm-nos até
            commit/rollback durável. FAILS when roots/scopes/fingerprints
            concorrentes perdem owner/refcount, divergem
            manifest/registry/runtime, deadlockam ou permitem aquisição tardia.
          status: pending
          verifier:
            kind: shell
            command: node scripts/verify-upstream-receipt.js --task F1/T-006 --worktree
              ../minimalist-installer-integrity-remediation --require-remote &&
              (cd ../minimalist-installer-integrity-remediation && node --test
              test/concurrency.test.js test/lock-order.test.js
              test/transaction-path-race.test.js test/inspect-rollback.test.js)
              && node --test tests/runtime-lock-concurrency.test.js
              tests/installer-fault-injection.test.js
              tests/runtime-refcount.test.js
              tests/runtime-registry-recovery.test.js
              tests/install-uninstall-roundtrip.test.js tests/uninstall.test.js
            expectExitCode: 0
    status: pending
    externalImports:
      - kind: url
        path: https://github.com/henryavila/minimalist-installer
        label: Repositório upstream do engine de instalação
        inside_repo: false
      - kind: repo-path
        path: package-lock.json
        label: Tarball 0.1.0 e integridade do baseline instalado
        inside_repo: true
  - id: F2
    slug: integrity-remediation-f2-contratos-de-host-runtime-e-observabil
    title: Contratos de host, runtime e observabilidade
    goal: Remover fallbacks silenciosos entre IDEs, classificar cada host como
      operational ou layout-only, tornar hooks scope-aware e fazer
      status/install relatarem o estado real de skills, assets, runtime e
      conflitos.
    summary: Separa tiers de host e expõe hashes, owners e runtime reais.
    dependsOn:
      - F1
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F2-G1
          description: Cada host público declara contrato e support tier, renderizando
            ferramentas e hooks apenas do próprio perfil. FAILS when
            tokens/config Claude vazam, host sem probe é marcado operational ou
            tier fica implícito.
          status: pending
          verifier:
            kind: shell
            command: node scripts/validate-host-qualification.js --manifest
              meta/host-qualification.json && node --test
              tests/host-qualification-manifest.test.js
              tests/host-profile-contract.test.js
              tests/auto-update-host-matrix.test.js
            expectExitCode: 0
        - id: F2-G2
          description: Status e install observam hashes, decisões e runtime real. FAILS
            when stale, modified, preserved ou runtime mismatch aparece como
            up-to-date.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/status-verify.test.js
              tests/status-runtime-owners.test.js
              tests/runtime-multiversion.test.js
              tests/runtime-registry-recovery.test.js
            expectExitCode: 0
    status: pending
  - id: F3
    slug: integrity-remediation-f3-caminho-spec-para-implement-e-isolamen
    title: Caminho SPEC para implement e isolamento de execução
    goal: Consumir o lifecycle reconciliado por F4 e fazer tasks admitidas pelo SPEC
      chegarem a `implement` com targets e exclusões corretos, resolver o plano
      solicitado antes dos gates e executar cada writer na worktree certa.
    summary: Leva o SPEC materializado ao implement na worktree e no escopo corretos.
    dependsOn:
      - F4
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F3-G1
          description: SPEC materializado chega a implement com outputs como targets e
            scopeBoundary como exclusões. FAILS when `Files` é exigido ou uma
            exclusão vira allowlist.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/implement-ready-contract.test.js
              tests/project-implement-e2e.test.js
            expectExitCode: 0
        - id: F3-G2
          description: Argumento explícito seleciona plan, branch e worktree antes de
            qualquer gate ou write. FAILS when a árvore chamadora governa outro
            plano.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/worktree-plan-routing.test.js
            expectExitCode: 0
    status: pending
  - id: F4
    slug: integrity-remediation-f4-autoridade-de-estado-e-transicoes-recu
    title: Autoridade de estado e transições recuperáveis
    goal: Reconciliar o bootstrap F0 e fazer validator, transition helpers e
      comandos de fechamento compartilharem invariantes estritas e gravarem
      estado, evidence, eventos, handoff e materialização de forma idempotente.
    summary: Reconcilia F0 e torna fechamento, eventos e materialização idempotentes.
    dependsOn:
      - F0
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F4-G1
          description: Validator rejeita identidades, DAGs, IDs e estados terminais
            contraditórios e preserva descriptor lazy válido. FAILS when
            qualquer fixture inválido retorna exit 0 ou descriptor-only pending
            é rejeitado.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/validate-state-integrity.test.js
              tests/state-integrity-migration.test.js
              tests/transition-integrity.test.js
            expectExitCode: 0
        - id: F4-G2
          description: Task e phase close são idempotentes e não deixam writes, eventos ou
            evidence stale. FAILS when retry duplica analytics ou review muda
            HEAD sem rerun.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/phase-done-transaction.test.js
              tests/done-transaction.test.js
              tests/append-completion-actuals.test.js
            expectExitCode: 0
        - id: F4-G3
          description: Materialize e dispatch-log sobrevivem fault injection, e a
            reconciliação F0 é não deferível e exigida também ao ativar F3.
            FAILS when plan/initiative divergem, log deixa de ser NDJSON,
            defer/skip fecha F4, completion/evidence/closeSha de F0 ficam fora
            do receipt ou F3 ativa com receipt stale.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/phase-materialization/materialize-transaction.test.js
              tests/phase-materialization/materialize-history-reconcile.test.js
              tests/phase-materialization/materialize-successor-barrier.test.js
              tests/lifecycle-gate-bypass.test.js
              tests/append-completion-dispatchlog.test.js && node
              scripts/materialize-state.js --check-history-receipt
              docs/audits/integrity-remediation-f0-reconciliation.json
            expectExitCode: 0
    status: pending
  - id: F5
    slug: integrity-remediation-f5-gemini-portabilidade-e-identidade-de-d
    title: Gemini, portabilidade e identidade de dashboard
    goal: Tornar os contratos Gemini observáveis no CLI real, remover suposições
      POSIX e registrar o projectId canônico em worktrees.
    summary: Valida Gemini no CLI real e remove suposições POSIX e de basename.
    dependsOn:
      - F2
    subPhaseCount: 0
    exitGate:
      summary: 3 criteria to meet
      criteria:
        - id: F5-G1
          description: Gemini CLI suportado descobre e invoca todas as skills native e
            todos os commands habilitados. FAILS when um artifact está ausente,
            inválido ou recebe argumentos errados.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/gemini-cli-contract.test.js
            expectExitCode: 0
        - id: F5-G2
          description: Validator e normalizer classificam paths Windows e POSIX com o
            mesmo contrato. FAILS when path.win32 retorna kind ou projectId
            incorreto.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/windows-path-contract.test.js
              tests/validate-state.test.js tests/normalize.test.js
            expectExitCode: 0
        - id: F5-G3
          description: Dashboard registra o projectId canônico com JSON válido em qualquer
            worktree. FAILS when basename ou caracteres do root alteram a
            identidade.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/project-registration.test.js
            expectExitCode: 0
    status: pending
  - id: F6
    slug: integrity-remediation-f6-qualificacao-de-release-e-fechamento-d
    title: Qualificação de release e fechamento das auditorias
    goal: Exercitar o produto empacotado em hosts, scopes, sistemas e falhas reais e
      impedir release enquanto qualquer finding permanecer reproduzível.
    summary: Qualifica o tarball sob hosts, sistemas, concorrência e fault injection.
    dependsOn:
      - F5
    subPhaseCount: 0
    exitGate:
      summary: 2 criteria to meet
      criteria:
        - id: F6-G1
          description: Black-box, probes operacionais versionados e fault matrix passam
            contra o tarball sem checkout fonte; hosts sem probe ficam
            layout-only. FAILS when suporte operational não executa
            discovery/load/invoke no host real ou qualquer scope, crash ou retry
            deixa estado parcial.
          status: pending
          verifier:
            kind: shell
            command: node --test tests/release-blackbox.test.js
              tests/release-host-probes.test.js
              tests/release-fault-matrix.test.js
            expectExitCode: 0
        - id: F6-G2
          description: Suíte, skills, docs, runtime closure, paridade, manifesto de
            findings e receipt Linux/macOS/Windows/Gemini/Node 22.18.x/Node
            24.11+ ficam verdes no candidateSha sem diff de produto posterior.
            FAILS when finding está ausente/sem evidência, runtime suportado não
            foi exercitado, instalação diverge ou receipt/job não pertence ao
            candidato.
          status: pending
          verifier:
            kind: shell
            command: npm test && npm run validate-skills && npm run check-docs && node
              scripts/verify-installed-runtime.js --check && node
              scripts/verify-ci-candidate.js --receipt
              docs/audits/release-candidate-ci.json --require-os
              linux,macos,windows --require-node '22.18.x,>=24.11.0'
              --require-host-manifest meta/host-qualification.json
              --no-product-diff && node scripts/verify-findings-manifest.js
              --manifest docs/audits/integrity-remediation-findings.json
              --receipt docs/audits/release-candidate-ci.json
            expectExitCode: 0
    status: pending
references:
  - kind: repo-path
    path: docs/audits/installer-audit-2026-07-10.md
    label: Auditoria do installer
    inside_repo: true
  - kind: repo-path
    path: docs/audits/project-implement-audit-2026-07-10.md
    label: Auditoria de project e implement
    inside_repo: true
  - kind: repo-path
    path: projects/atomic-skills/integrity-remediation/design.md
    label: Design aprovado da remediação
    inside_repo: true
  - kind: repo-path
    path: .atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md
    label: Revisão adversarial Codex em duas passagens
    inside_repo: true
planActive: true
planTitle: Remediação integral de segurança, lifecycle e distribuição
---

# Remediação integral de segurança, lifecycle e distribuição

## 1. Context

Este plano transforma todos os achados das auditorias de 2026-07-10 e da revisão
adversarial de 2026-07-11 em contratos executáveis. A execução é
`F0 → F4 → F3 → F1 → F2 → F5 → F6`: F0 destrava o executor, fecha a runtime
closure e instala somente a primitiva transacional necessária para materializar
F4. F4 consolida preflight, commit guard, fechamento idempotente e materialização
recuperável, e reconcilia o histórico de F0. Só então F3 libera o caminho
`SPEC → estado → implement`; as mutações destrutivas do installer começam em F1
depois desse lifecycle reconciliado.

Os IDs F0..F6 permanecem estáveis como identidade de captura e não codificam a
ordem cronológica. O DAG linear em `dependsOn` é a autoridade de elegibilidade;
com `parallelismAllowed: false`, existe uma única próxima fase em toda transição.

verified_by: `docs/audits/installer-audit-2026-07-10.md:1-484`,
`docs/audits/project-implement-audit-2026-07-10.md:1-417` e
`projects/atomic-skills/integrity-remediation/design.md:1-303` e
`.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md:232-410`.

## 2. Inviolable principles

- **P1 Integridade antes de compatibilidade** — conteúdo sem ownership provado
  nunca é sobrescrito ou apagado; estado ambíguo falha fechado.
- **P2 Uma autoridade por contrato** — o engine upstream governa filesystem e
  journal; `validate-state` governa invariantes; adapters governam hosts.
- **P3 Evidência observável** — suporte, conclusão e recovery são aceitos somente
  por testes do comportamento público.
- **P4 Migração conservadora** — formatos antigos permanecem legíveis até um
  commit novo ser comprovado; dados ambíguos viram `unmanaged`.
- **P5 Fatias recuperáveis** — cada fase termina em estado instalável, validado e
  reversível.
- **P6 Fonte e instalação não divergem** — toda dependência runtime citada por
  uma skill entra no file-set e na superfície publicada.

verified_by: direção ratificada e criticada em
`projects/atomic-skills/integrity-remediation/design.md:12-20,128-171`.

## 3. Phase tree

- **F0** — destrava executor/runtime e materializa F4 com recovery (5 tasks, 2 gates).
- **F4** — centraliza lifecycle e reconcilia F0 (8 tasks, 3 gates; depende de F0).
- **F3** — restaura SPEC para implement na worktree correta (5 tasks, 2 gates; depende de F4).
- **F1** — entrega installer v2 e proteção de dados (6 tasks, 2 gates; depende de F3).
- **F2** — separa tiers de host e torna runtime/status observáveis (4 tasks, 2 gates; depende de F1).
- **F5** — corrige Gemini, Windows e identidade de dashboard (6 tasks, 3 gates; depende de F2).
- **F6** — qualifica o tarball e fecha as auditorias (5 tasks, 2 gates; depende de F5).

verified_by: `node scripts/validate-state.js
.atomic-skills/projects/atomic-skills/integrity-remediation/plan.md` e preview
confirmado pelo usuário.

## 4. Bootstrap e fronteira multi-repositório

- **F0/T-001 é a única exceção de bootstrap.** O `implement` atual exige a
  propriedade inexistente `Files`; por isso essa tarefa roda por TDD direto na
  worktree do plano e fecha por `project done`. Nenhuma outra task começa até o
  teste de admissão por `outputs[].path` ficar verde; depois disso o fluxo volta
  ao executor canônico.
- **F0/T-005 é o bootstrap de materialização, não uma segunda autoridade.** Ele
  cria a versão mínima de `scripts/materialize-state.js`; F4/T-006 amplia
  exatamente esse módulo. Nenhum write inline alternativo permanece em
  `project-materialize.md`.
- **F4-G3 é a barreira não deferível antes de F3 e F1.** `defer`, `skip` ou
  status editado não promovem F4; a ativação/materialização de F3 relê o receipt
  e o closeSha de F4. A projeção reconciliada de F0 inclui descriptor, initiative,
  sidecars, creation-gate, gate evidence, completion events e close SHA. Estado
  ambíguo falha sem write; somente estado univocamente reparável recebe backup e
  migração.
- **F1 usa duas unidades de commit.** Mudanças genéricas do engine são
  microcommits na worktree upstream
  `../minimalist-installer-integrity-remediation`, branch
  `codex/integrity-remediation-v2`. O plano pai nunca tenta stagear paths do
  repositório irmão: F1/T-002..T-004 rodam por TDD direto nessa worktree,
  recebem a tag `external-repo` e fecham no plano pai somente depois que cada
  SHA e comando executado entra em um receipt versionado no consumer.
- **O baseline é content-addressed.** O tarball 0.1.0 e sua integridade vêm de
  `package-lock.json`; T-001 precisa provar uma correspondência única com o
  commit-base upstream. Ausência de correspondência bloqueia a fase, em vez de
  usar o HEAD atual.
- **Push é um gate externo explícito.** F1/T-006 pede autorização imediatamente
  antes de publicar a branch upstream; não cria tag, pacote npm nem release. O
  consumer fixa o SHA completo alcançável pela branch aprovada.
- **F6 congela o candidato antes da evidência.** T-005 cria o commit candidato,
  pede autorização para push, espera todos os jobs e só então grava
  `release-candidate-ci.json` com candidateSha, run IDs e URLs. O gate aceita
  commits posteriores apenas no manifesto de findings, receipts, relatórios e
  `.atomic-skills/`; qualquer diff de produto depois do candidateSha invalida o
  receipt e exige nova matriz.

verified_by: `skills/core/implement.md:51-77`, `package-lock.json:748-755` e
`projects/atomic-skills/integrity-remediation/design.md:22-92`.

## 5. Mapa de cobertura

- **Installer:** C1 → F1/T-001..T-006; C2 → F0/T-003; C3 → F0/T-001,
  F0/T-002 e F0/T-004; H1 → F2/T-001; H2/H3/H6 → F1/T-005 e F2/T-004;
  H4 → F2/T-002; H5 → F2/T-003; M1/M2/M3 → F0/T-002; M4 → F1/T-006.
- **Project/implement:** C1 → F0/T-001 e F0/T-004; C2 → F0/T-001 e
  F3/T-001; C3 → F4/T-003; H1/H9 → F3/T-002; H2 → F4/T-004; H3 →
  F4/T-005; H4 → F3/T-003 e F4/T-005; H5 → F0/T-004; H6 → F4/T-007;
  H7 → F4/T-006; H8 → F3/T-003; H10 → F0/T-001; M1/M3/M4/M5/M6/M8 →
  F3/T-004; M2/M7 → F4/T-008; M9 → F5/T-006.
- **Achados adversariais adicionais:** terminalidade com sibling aberto e ciclos
  → F4/T-002; identidade plan/phase/initiative, gate pendente em fase terminal
  e IDs duplicados → F4/T-001. A ausência de initiative continua válida apenas
  para descriptor `pending`, `subPhaseCount: 0`, com sidecar lazy correspondente.
- **Review Codex:** F-001 → F0/T-005 e F4/T-006/G3; F-002 → F1/T-001..T-003/G1;
  F-003 → F1/T-001, T-003, T-005/G2; F-004 → F2/T-001/G1 e F6/T-001/G1;
  F-005 → F6/T-004..T-005/G2; F-006 → F6/T-003/T-005/G2.
- **Manifesto canônico:** IDs são source-qualified (`installer/C1`,
  `project-implement/C1`, `codex-review/F-001`); o verifier extrai os conjuntos
  das três fontes e exige igualdade exata, reproducer, execução verde, evidence
  com digest/job e candidateSha único.

verified_by: `docs/audits/installer-audit-2026-07-10.md:43-397`,
`docs/audits/project-implement-audit-2026-07-10.md:32-330`,
`src/transition.js:67-134`, `scripts/validate-state.js:398-605`,
`scripts/lint-source.js:178-324` e `src/decompose.js:444-709`.

## Self-review against code-quality gates

- **G1 read-before-claim**: 10 claims de comportamento atual possuem excerpts no
  design aprovado; as 39 tasks descrevem trabalho futuro e ligam cada causa a
  um intervalo numérico de relatório/source. Nenhuma claim é inferida apenas
  pelo nome de um arquivo.
- **G2 soft-language**: varredura planejada sobre body, `nextAction`, tasks e gates;
  0 ocorrências da ban list aceitas na versão final.
- **G6 reference-or-strike**: 39/39 descrições de task carregam `verified_by:`
  com `file:line`; os três grupos de assertions da narrativa possuem
  `verified_by:` numérico/comando e os 16 critérios de saída carregam verifier
  determinístico.
- **G10 gate-must-be-able-to-fail**: 16 exit criteria possuem verifier
  determinístico e uma condição explícita `FAILS when`; critérios sem red
  observável: none.

## Reviews

- internal: 16 findings applied @ b2a845a (2026-07-10T20:48:55Z)
- codex: reject→resolved — .atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md (6/6 findings applied and independently rechecked)
