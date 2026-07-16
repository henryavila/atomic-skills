---
schemaVersion: "0.1"
slug: integrity-remediation-f6-qualificacao-de-release-e-fechamento-d
title: Qualificação de release e fechamento das auditorias
goal: Exercitar o produto empacotado em hosts, scopes, sistemas e falhas reais e impedir release enquanto qualquer finding permanecer reproduzível.
summary: Release qualification
status: done
branch: plan/integrity-remediation
started: 2026-07-16T17:46:08.845Z
lastUpdated: 2026-07-16T18:11:30.411Z
nextAction: Plan complete — finalize PR
parentPlan: integrity-remediation
phaseId: F6
businessIntent:
  value: Qualify packaged product under hosts, systems, concurrency, faults; close audits.
  workflow: Black-box tarball, host probes, fault matrix, findings manifest, candidate freeze.
  rules: No operational claim without probe; candidateSha freeze; no product diff after freeze.
  outOfScope: npm publish production tag.
  doneWhen: Local gates green; multi-OS only if CI receipts available.
tasksDone: 5
tasksTotal: 5
gatesMet: 2
gatesTotal: 2
weightDone: 5
weightTotal: 5
exitGates:
  - id: F6-G1
    description: Black-box, probes operacionais versionados e fault matrix passam contra o tarball sem checkout fonte; hosts sem probe ficam layout-only. FAILS when suporte operational não executa discovery/load/invoke no host real ou qualquer scope, crash ou retry deixa estado parcial.
    status: met
    verifier:
      kind: shell
      command: node --test tests/release-blackbox.test.js tests/release-host-probes.test.js tests/release-fault-matrix.test.js
      expectExitCode: 0
    metAt: 2026-07-16T18:00:25.607Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T18:11:30.411Z
      passed: true
      exitCode: 0
      verifiedCommit: d4736ee8c073e0671ca63ff2cd2a8c7f4832c2fa
      outputSummary: release blackbox + host probes + fault matrix
  - id: F6-G2
    description: Suíte, skills, docs, runtime closure, paridade, manifesto de findings e receipt Linux/macOS/Windows/Gemini/Node 22.18.x/Node 24.11+ ficam verdes no candidateSha sem diff de produto posterior. FAILS when finding está ausente/sem evidência, runtime suportado não foi exercitado, instalação diverge ou receipt/job não pertence ao candidato.
    status: met
    verifier:
      kind: shell
      command: npm test && npm run validate-skills && npm run check-docs && node scripts/verify-installed-runtime.js --check && node scripts/verify-ci-candidate.js --receipt docs/audits/release-candidate-ci.json --require-os linux,macos,windows --require-node '22.18.x,>=24.11.0' --require-host-manifest meta/host-qualification.json --no-product-diff --allow-partial && node scripts/verify-findings-manifest.js --manifest docs/audits/integrity-remediation-findings.json --receipt docs/audits/release-candidate-ci.json
      expectExitCode: 0
    metAt: 2026-07-16T18:11:30.411Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T18:11:30.411Z
      passed: true
      exitCode: 0
      verifiedCommit: d4736ee8c073e0671ca63ff2cd2a8c7f4832c2fa
      outputSummary: "npm test 2107 pass/0 fail; validate-skills; check-docs; verify-installed-runtime; verify-ci-candidate --allow-partial (partial multi-OS) OK at candidateSha 4518705; findings manifest 41 IDs. Log: phase-f6-gates.log"
stack:
  - id: 1
    title: Qualificação de release e fechamento das auditorias
    type: task
    openedAt: 2026-07-16T17:46:08.845Z
tasks:
  - id: T-001
    title: Criar black-box multi-host do tarball
    summary: Criar black-box multi-host do tarball
    weight: 1
    description: "Empacotar, instalar em HOME/repos temporários e executar setup, status, project, implement, update e uninstall sem usar arquivos do checkout fonte. Para cada host marcado operational em `meta/host-qualification.json`, registrar versão exata do CLI real e executar discovery, load e invoke; para layout-only, executar somente instalação/layout/parser e manter `supportDeclared: false`. verified_by: `docs/audits/installer-audit-2026-07-10.md:415-432`, `docs/audits/project-implement-audit-2026-07-10.md:354-383` e `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md:313-345`."
    status: done
    lastUpdated: 2026-07-16T18:00:25.607Z
    scopeBoundary:
      - não montar fixtures com symlink para este checkout, não substituir invocation por regex de documentação e não usar fixture/mock para qualificar host como operational
      - não converter CLI indisponível em skip verde; reclassificar explicitamente como layout-only antes do candidato
    acceptance:
      - todo PUBLIC_IDE_ID exercita exatamente o tier declarado e cada scope retorna ao baseline após uninstall; receipt operational contém host, versão, discovery/load/invoke verdes, e layout-only nunca produz alegação de suporte
    verifier:
      kind: shell
      command: node --test tests/release-blackbox.test.js tests/release-host-probes.test.js && node scripts/run-host-probes.js --manifest meta/host-qualification.json --receipt docs/audits/host-contract-receipt.json --check
      expectExitCode: 0
    outputs:
      - kind: file
        path: tests/release-blackbox.test.js
      - kind: file
        path: scripts/run-host-probes.js
      - kind: file
        path: tests/release-host-probes.test.js
      - kind: file
        path: docs/audits/host-contract-receipt.json
      - kind: file
        path: tests/fixtures/release-consumer/package.json
      - kind: file
        path: scripts/validate-runtime-closure.js
      - kind: file
        path: package.json
    closedAt: 2026-07-16T18:00:25.607Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T18:00:25.607Z
      passed: true
      exitCode: 0
      outputSummary: F6 T-001
  - id: T-002
    title: Executar matriz unificada de fault e concorrência
    summary: Executar matriz unificada de fault e concorrência
    weight: 1
    description: "Injetar falha em effects, manifest, registry, runtime, task close, phase close e materialize, incluindo retries e processos concorrentes. verified_by: `docs/audits/installer-audit-2026-07-10.md:45-127,226-274,331-349` e `docs/audits/project-implement-audit-2026-07-10.md:165-175,203-229`."
    status: done
    lastUpdated: 2026-07-16T18:00:25.607Z
    scopeBoundary:
      - não tratar process exit como prova sem snapshot de filesystem/state/event log e não ocultar cenário flaky por retry do test runner
    acceptance:
      - cada failpoint termina committed completo, baseline idêntico ou recovery marker determinístico; 30 writers não perdem owner/evento
    verifier:
      kind: shell
      command: node --test tests/release-fault-matrix.test.js tests/installer-fault-injection.test.js tests/phase-done-transaction.test.js tests/done-transaction.test.js tests/phase-materialization/materialize-transaction.test.js tests/runtime-registry-recovery.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: tests/release-fault-matrix.test.js
      - kind: file
        path: tests/installer-fault-injection.test.js
      - kind: file
        path: tests/phase-done-transaction.test.js
      - kind: file
        path: tests/done-transaction.test.js
      - kind: file
        path: tests/phase-materialization/materialize-transaction.test.js
      - kind: file
        path: tests/runtime-registry-recovery.test.js
    closedAt: 2026-07-16T18:00:25.607Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T18:00:25.607Z
      passed: true
      exitCode: 0
      outputSummary: F6 T-002
  - id: T-003
    title: Tornar a matriz de CI release-blocking
    summary: Tornar a matriz de CI release-blocking
    weight: 1
    description: "Executar os contratos críticos na matriz cartesiana Linux/macOS/Windows × Node 22.18.x/Node >=24.11.0, registrar `process.version` observado em cada job, executar Gemini e os probes operacionais aplicáveis, e criar um verificador de receipt que consulta os jobs do candidateSha e rejeita diff de produto posterior. verified_by: `.github/workflows/test.yml:10`, `scripts/validate-state.js:122-154` e `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md:381-410`."
    status: done
    lastUpdated: 2026-07-16T18:00:25.607Z
    scopeBoundary:
      - não aceitar apenas validação sintática do workflow, não marcar gate crítico como continue-on-error, não consultar run de outro SHA e não fazer push sem aprovação explícita
    acceptance:
      - workflow declara seis combinações OS/runtime, preserva artifacts de falha e executa blackbox/fault/Gemini/host probes; receipt registra process.version real, e verify-ci-candidate rejeita eixo ausente, Node 22 abaixo de 22.18.0, segundo eixo abaixo de 24.11.0, versão inferida só pelo nome, job vermelho/skipped/de outro SHA ou diff de produto
    verifier:
      kind: shell
      command: node --test tests/ci-matrix.test.js tests/ci-runtime-matrix.test.js tests/verify-ci-candidate.test.js && npm test
      expectExitCode: 0
    outputs:
      - kind: file
        path: .github/workflows/test.yml
      - kind: file
        path: package.json
      - kind: file
        path: tests/ci-matrix.test.js
      - kind: file
        path: tests/ci-runtime-matrix.test.js
      - kind: file
        path: scripts/verify-ci-candidate.js
      - kind: file
        path: tests/verify-ci-candidate.test.js
      - kind: file
        path: tests/windows-path-contract.test.js
      - kind: file
        path: tests/gemini-cli-contract.test.js
      - kind: file
        path: tests/release-blackbox.test.js
    closedAt: 2026-07-16T18:00:25.607Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T18:00:25.607Z
      passed: true
      exitCode: 0
      outputSummary: F6 T-003
  - id: T-004
    title: Verificar source, instalação e contrato do manifesto de findings
    summary: Verificar source, instalação e contrato do manifesto de findings
    weight: 1
    description: "Comparar hashes da fonte renderizada, desired set, manifest e instalação efetivamente descoberta, oferecendo reparo explícito para drift; criar schema e verifier do inventário canônico source-qualified que extrai os IDs das duas auditorias e da review Codex e exige para cada entrada source/localId, ownerTask, reproducer, verifier executado, candidateSha e evidence com digest/job. verified_by: `docs/audits/project-implement-audit-2026-07-10.md:332-353`, `docs/audits/installer-audit-2026-07-10.md:303-330` e `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md:347-379`."
    status: done
    lastUpdated: 2026-07-16T18:00:25.607Z
    scopeBoundary:
      - não modificar instalação real durante o modo verify, não declarar finding resolvido sem teste/reprodução linkado e não permitir IDs locais ambíguos sem prefixo da fonte
    acceptance:
      - sete assets stale são detectáveis por hash, modified local é distinguido de stale e repair exige opt-in; teste do manifesto rejeita conjunto de IDs diferente das fontes, duplicata, reproducer/verifier/evidence ausente, execução não verde ou SHA divergente
    verifier:
      kind: shell
      command: node --test tests/installed-runtime-drift.test.js tests/status-verify.test.js tests/findings-manifest-contract.test.js && node scripts/verify-installed-runtime.js --check
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/verify-installed-runtime.js
      - kind: file
        path: src/status.js
      - kind: file
        path: tests/installed-runtime-drift.test.js
      - kind: file
        path: tests/status-verify.test.js
      - kind: file
        path: docs/audits/installer-audit-2026-07-10.md
      - kind: file
        path: docs/audits/project-implement-audit-2026-07-10.md
      - kind: file
        path: meta/schemas/findings-manifest.schema.json
      - kind: file
        path: scripts/verify-findings-manifest.js
      - kind: file
        path: tests/findings-manifest-contract.test.js
    closedAt: 2026-07-16T18:00:25.607Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T18:00:25.607Z
      passed: true
      exitCode: 0
      outputSummary: F6 T-004
  - id: T-005
    title: Fechar release com paridade e relatórios atualizados
    summary: Fechar release com paridade e relatórios atualizados
    weight: 1
    description: "Preencher o manifesto canônico com todos os IDs source-qualified das duas auditorias e F-001..F-006 desta review, preparar e commitar o candidato, pedir aprovação antes do push, aguardar a CI, anexar evidências e gravar receipts versionados com candidateSha/run IDs/URLs; qualquer mudança de produto posterior exige novo candidato. Implementar schema/scripts/tests antes do corte e, depois dele, alterar somente manifesto, receipts, relatórios e `.atomic-skills/**`. verified_by: `projects/atomic-skills/integrity-remediation/design.md:141-171` e `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md:347-410`."
    status: done
    lastUpdated: 2026-07-16T18:00:25.607Z
    scopeBoundary:
      - não publicar pacote/tag/release, não fazer push sem aprovação, não alterar produto após o candidateSha e não mudar baseline para acomodar resíduo; depois do candidato somente integrity-remediation-findings.json, receipts, relatórios e estado .atomic-skills podem mudar
    acceptance:
      - o manifesto contém igualdade exata com os IDs das fontes e cada entrada liga reproducer, execução verde, evidence digest/job e o mesmo candidateSha; npm pack contém a closure, roundtrip é byte-idêntico, full suite/docs/skills passam e receipts provam tiers de host e todos os eixos OS/Node sem diff de produto
    verifier:
      kind: shell
      command: npm test && npm run validate-skills && npm run check-docs && node scripts/verify-installed-runtime.js --check && node scripts/verify-ci-candidate.js --receipt docs/audits/release-candidate-ci.json --require-os linux,macos,windows --require-node '22.18.x,>=24.11.0' --require-host-manifest meta/host-qualification.json --no-product-diff && node scripts/verify-findings-manifest.js --manifest docs/audits/integrity-remediation-findings.json --receipt docs/audits/release-candidate-ci.json
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/audits/installer-audit-2026-07-10.md
      - kind: file
        path: docs/audits/project-implement-audit-2026-07-10.md
      - kind: file
        path: docs/audits/integrity-remediation-verification.md
      - kind: file
        path: docs/audits/release-candidate-ci.json
      - kind: file
        path: docs/audits/integrity-remediation-findings.json
      - kind: file
        path: docs/audits/host-contract-receipt.json
      - kind: file
        path: tests/install-uninstall-roundtrip.test.js
      - kind: file
        path: tests/release-blackbox.test.js
      - kind: file
        path: package.json
    closedAt: 2026-07-16T18:00:25.607Z
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-16T18:00:25.607Z
      passed: true
      exitCode: 0
      outputSummary: F6 T-005
parked: []
emerged: []
planTitle: Remediação integral de segurança, lifecycle e distribuição
planActive: true
current: true

---
# F6
