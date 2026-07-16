---
schemaVersion: "0.1"
slug: integrity-remediation-f1-installer-v2-e-protecao-de-dados
title: Installer v2 e proteção de dados
goal: Entregar em worktree upstream dedicada e integrar no consumer mutações no-follow resistentes a TOCTOU, journal versionado, persistência atômica, locks por recurso canônico compartilhado, ownership por hash e recovery conservador para install, update e uninstall.
summary: Confina races e serializa install/update/uninstall por recurso recuperável.
status: active
branch: plan/integrity-remediation
started: 2026-07-16T17:10:28.512Z
lastUpdated: 2026-07-16T17:10:28.512Z
nextAction: "Start F1/T-001: fix upstream baseline and capture red reproductions."
parentPlan: integrity-remediation
phaseId: F1
businessIntent:
  value: Installer mutations are no-follow, journaled, locked, ownership-safe for install/update/uninstall.
  workflow: Upstream engine worktree + consumer receipts; pin SHA; no clobber unowned content.
  rules: P1 integrity before compatibility; fail closed; no automatic destructive recovery without proof.
  outOfScope: Host tiers F2, Gemini F5, npm publish release.
  doneWhen: F1-G1 and F1-G2 green with upstream receipts when environment allows.
tasksDone: 0
tasksTotal: 6
gatesMet: 0
gatesTotal: 2
weightDone: 0
weightTotal: 6
exitGates:
  - id: F1-G1
    description: Toda mutação do installer é confinada por no-follow/handle equivalente e preserva conteúdo sem ownership. FAILS when uma barreira determinística troca qualquer componente, inclusive leafs de write, prune, rollback e origem/destino de temp→rename, e a operação altera o sentinel externo, produz efeito parcial ou prossegue sem prova atômica.
    status: pending
    verifier:
      kind: shell
      command: node scripts/verify-upstream-receipt.js --task F1/T-006 --worktree ../minimalist-installer-integrity-remediation --require-remote && (cd ../minimalist-installer-integrity-remediation && node --test test/path-confinement.test.js test/path-mutation-race.test.js test/transaction-path-race.test.js test/greenfield-conflict.test.js) && node --test tests/installer-data-safety.test.js tests/minimalist-installer-link.test.js
      expectExitCode: 0
  - id: F1-G2
    description: Transações declaram previamente locks por identidade canônica compartilhada, adquirem-nos em ordem total e mantêm-nos até commit/rollback durável. FAILS when roots/scopes/fingerprints concorrentes perdem owner/refcount, divergem manifest/registry/runtime, deadlockam ou permitem aquisição tardia.
    status: pending
    verifier:
      kind: shell
      command: node scripts/verify-upstream-receipt.js --task F1/T-006 --worktree ../minimalist-installer-integrity-remediation --require-remote && (cd ../minimalist-installer-integrity-remediation && node --test test/concurrency.test.js test/lock-order.test.js test/transaction-path-race.test.js test/inspect-rollback.test.js) && node --test tests/runtime-lock-concurrency.test.js tests/installer-fault-injection.test.js tests/runtime-refcount.test.js tests/runtime-registry-recovery.test.js tests/install-uninstall-roundtrip.test.js tests/uninstall.test.js
      expectExitCode: 0
stack:
  - id: 1
    title: Installer v2 e proteção de dados
    type: task
    openedAt: 2026-07-16T17:10:28.512Z
tasks:
  - id: T-001
    title: Fixar o baseline upstream e capturar reproduções vermelhas
    summary: Fixar o baseline upstream e capturar reproduções vermelhas
    weight: 1
    description: "Resolver o commit-base que corresponde unicamente ao tarball 0.1.0 content-addressed, criar `../minimalist-installer-integrity-remediation` na branch `codex/integrity-remediation-v2` e capturar symlink escape, clobber greenfield, truncation, concurrency, effect disappearance, troca determinística de cada componente inclusive leafs de write/prune/rollback e leafs de origem/destino em temp→rename, além de corrida entre roots/scopes/runtime fingerprints, por um harness que espera o vermelho observado. verified_by: `package-lock.json:748-755`, `projects/atomic-skills/integrity-remediation/design.md:22-76` e `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md:259-310`."
    status: pending
    lastUpdated: 2026-07-16T17:10:28.512Z
    scopeBoundary:
      - não editar `node_modules`, não partir do HEAD sem correspondência byte a byte e não adicionar as reproduções vermelhas à suíte verde antes das correções
    acceptance:
      - receipt registra dist.integrity, baseSha único, origin e branch; cada reprodução bruta, inclusive path mutation race e shared-resource lock race, falha contra o tarball 0.1.0 com a assinatura exata esperada, e correspondência ausente ou múltipla bloqueia a task
    verifier:
      kind: shell
      command: node --test tests/minimalist-installer-baseline.test.js && node scripts/verify-upstream-receipt.js --task F1/T-001 --worktree ../minimalist-installer-integrity-remediation
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/audits/minimalist-installer-upstream-receipt.json
      - kind: file
        path: scripts/verify-upstream-receipt.js
      - kind: file
        path: tests/minimalist-installer-baseline.test.js
      - kind: file
        path: tests/fixtures/minimalist-installer-v0.1.0/path-confinement.repro.js
      - kind: file
        path: tests/fixtures/minimalist-installer-v0.1.0/greenfield-conflict.repro.js
      - kind: file
        path: tests/fixtures/minimalist-installer-v0.1.0/fault-matrix.repro.js
      - kind: file
        path: tests/fixtures/minimalist-installer-v0.1.0/path-mutation-race.repro.js
      - kind: file
        path: tests/fixtures/minimalist-installer-v0.1.0/shared-resource-lock.repro.js
    tags: []
  - id: T-002
    title: Implementar mutações no-follow resistentes a TOCTOU
    summary: Implementar mutações no-follow resistentes a TOCTOU
    weight: 1
    description: "Na worktree upstream dedicada, centralizar toda mutação em uma autoridade que opera relativamente a diretório confiável já aberto, com no-follow em todos os componentes ou primitiva de plataforma com garantia atômica equivalente, stage no mesmo diretório e falha fechada `UNSAFE_PATH_RACE` quando a garantia não existir; revalidação check-then-use isolada não satisfaz o contrato. Migrar write, prune e effect.revert, tratar conteúdo preexistente sem ownership como conflito e registrar o microcommit no receipt. verified_by: `projects/atomic-skills/integrity-remediation/design.md:22-45` e `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md:259-284`."
    status: pending
    lastUpdated: 2026-07-16T17:10:28.512Z
    scopeBoundary:
      - não seguir symlink para leitura, escrita ou prune, não adotar arquivo divergente por path lexical e não pedir ao plano pai para stagear o repositório irmão
      - não chamar writeFile, rename, unlink ou rm por path após validação, não aceitar revalidação imediatamente anterior como garantia atômica e não fazer fallback permissivo em plataforma sem no-follow
    acceptance:
      - barreiras determinísticas comprovadamente atingidas após a última decisão de segurança e antes do primeiro efeito de kernel trocam cada componente por symlink, junction ou reparse point, inclusive o leaf de write/prune/effect.revert e os leafs temp/origem e destino do rename; sentinel externo permanece byte-idêntico, destino termina inteiro ou inalterado, operação rejeita com erro tipado, e caminho normal/conflito greenfield continuam verdes
    verifier:
      kind: shell
      command: node scripts/verify-upstream-receipt.js --task F1/T-002 --worktree ../minimalist-installer-integrity-remediation && (cd ../minimalist-installer-integrity-remediation && node --test test/path-confinement.test.js test/path-mutation-race.test.js test/greenfield-conflict.test.js)
      expectExitCode: 0
    outputs:
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/kernel/reconciler.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/kernel/effects/json-merge.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/path-safety.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/kernel/effects/legacy-prune.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/kernel/effects/refcount.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/test/path-confinement.test.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/test/greenfield-conflict.test.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/test/path-mutation-race.test.js
      - kind: file
        path: docs/audits/minimalist-installer-upstream-receipt.json
    tags:
      - external-repo
  - id: T-003
    title: Persistir transações sob locks canônicos
    summary: Persistir transações sob locks canônicos
    weight: 1
    description: "Na worktree upstream dedicada, adicionar journal v2, atomic persistence e coordenador multiprocesso cujo preflight declara o conjunto completo de recursos antes da primeira mutação. Serializar cada identidade como `v1\\0<kind>\\0<canonicalTarget>`, obter canonicalTarget pela autoridade no-follow, ordenar pelos bytes da identidade não-hasheada, deduplicar e adquirir arquivos nomeados pelo SHA-256 no único lockRoot user-scoped do engine, derivado do parent canônico do registry global e independente de project/install root. Manter locks até commit durável ou rollback completo e liberar em ordem inversa; nenhuma aquisição tardia após mutação. O engine fornece o contrato genérico e T-005 fornece identidades registry/runtime. Registrar o microcommit/receipt. verified_by: `projects/atomic-skills/integrity-remediation/design.md:47-76,141-159` e `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md:287-310`."
    status: pending
    lastUpdated: 2026-07-16T17:10:28.512Z
    scopeBoundary:
      - não iniciar recovery automático que apaga conteúdo, não liberar lock antes do commit durável e não misturar o commit upstream com o checkpoint do plano pai
      - não usar somente lock por root para recurso compartilhado, não derivar identidade de CWD/path lexical, não adquirir fora da ordem total nem escalar locks após a primeira mutação
    acceptance:
      - cada record v2 contém os campos de recovery aprovados; processos que declaram recursos sobrepostos em ordens opostas serializam sem deadlock/lost update, recursos disjuntos progridem, lock cobre fsync+temp→rename+rollback, troca de qualquer componente inclusive leafs de origem/destino falha fechada sem alterar sentinel externo, inspect é read-only e recovery termina em baseline ou transação bloqueada
    verifier:
      kind: shell
      command: node scripts/verify-upstream-receipt.js --task F1/T-003 --worktree ../minimalist-installer-integrity-remediation && (cd ../minimalist-installer-integrity-remediation && node --test test/concurrency.test.js test/lock-order.test.js test/manifest-recovery.test.js test/fault-injection.test.js test/inspect-rollback.test.js test/transaction-path-race.test.js)
      expectExitCode: 0
    outputs:
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/driver.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/manifest.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/lock.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/recovery.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/transaction-inspect.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/test/concurrency.test.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/test/manifest-recovery.test.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/test/fault-injection.test.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/test/inspect-rollback.test.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/test/lock-order.test.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/test/transaction-path-race.test.js
      - kind: file
        path: docs/audits/minimalist-installer-upstream-receipt.json
    tags:
      - external-repo
  - id: T-004
    title: Substituir ordinais por stable effect ids
    summary: Substituir ordinais por stable effect ids
    weight: 1
    description: "Na worktree upstream dedicada, versionar o journal, identificar efeitos de forma estável, reverter efeitos removidos, preservar v1 ambíguo como unmanaged e registrar o microcommit no receipt do consumer. verified_by: `projects/atomic-skills/integrity-remediation/design.md:47-60`."
    status: pending
    lastUpdated: 2026-07-16T17:10:28.512Z
    scopeBoundary:
      - não mapear v1 por ordinal quando o ownership for ambíguo, não abortar todo revert ao encontrar effect futuro desconhecido e não deixar a worktree upstream dirty
    acceptance:
      - reorder/remove/move não perde ownership, retry após update parcial reconhece conteúdo desejado, unknown effects ficam diagnosticados, e JSON alheio retorna aos bytes originais
    verifier:
      kind: shell
      command: node scripts/verify-upstream-receipt.js --task F1/T-004 --worktree ../minimalist-installer-integrity-remediation && (cd ../minimalist-installer-integrity-remediation && node --test test/effect-identity.test.js test/journal-v2.test.js test/update-retry.test.js)
      expectExitCode: 0
    outputs:
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/driver.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/kernel/journal.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/migrate-manifest.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/kernel/reconciler.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/src/kernel/effects/json-merge.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/test/effect-identity.test.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/test/journal-v2.test.js
      - kind: file
        path: ../minimalist-installer-integrity-remediation/test/update-retry.test.js
      - kind: file
        path: docs/audits/minimalist-installer-upstream-receipt.json
    tags:
      - external-repo
  - id: T-005
    title: Integrar runtime, registry e legacy cleanup na transação
    summary: Integrar runtime, registry e legacy cleanup na transação
    weight: 1
    description: "Como única autoridade de mutação do runtime/registry, testar o consumer em instalação temporária contra o tarball upstream cujo SHA bate o receipt, declarar antes de mutar as identidades `install-root:<canonical basePath>`, `registry:<canonical registry file>`, `runtime-index:<canonical runtime root>` e `runtime-slot:<canonical runtime root>#<fingerprint>`, usar o coordenador upstream, registrar ownership por hash, reconciliar ghosts/corrupção, reeleger owner sobrevivente e journalar legacy prune. verified_by: `projects/atomic-skills/integrity-remediation/design.md:62-92`, `docs/audits/installer-audit-2026-07-10.md:226-274,331-349` e `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md:287-310`."
    status: pending
    lastUpdated: 2026-07-16T17:10:28.512Z
    scopeBoundary:
      - não usar npm link nem mutar node_modules/lockfile antes de T-006, não reduzir registry inválido a vazio, não apagar owner/runtime válido e não executar cleanup fora de before-state reversível
      - não tratar lock por projeto como proteção do registry/runtime compartilhado e não criar lock por versão que exclua runtime-index/registry compartilhados
    acceptance:
      - fixture temporário carrega exatamente o tarball do resultSha; user edits sobrevivem; 30 processos cruzando duas roots, user/project scope e dois fingerprints não perdem owner/refcount, não elegem dois owners, não removem runtime em uso e terminam sem deadlock; slots disjuntos progridem enquanto registry/runtime-index ficam serializados; ghosts/corrupção são quarentenados e recovery restaura runtime válido
    verifier:
      kind: shell
      command: node --test tests/upstream-pack-integration.test.js && node scripts/test-with-upstream-pack.js --worktree ../minimalist-installer-integrity-remediation --receipt docs/audits/minimalist-installer-upstream-receipt.json --test tests/runtime-refcount.test.js --test tests/runtime-lock-concurrency.test.js --test tests/runtime-registry-recovery.test.js --test tests/install-uninstall-roundtrip.test.js --test tests/installer-data-safety.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/install.js
      - kind: file
        path: src/uninstall.js
      - kind: file
        path: src/installer.js
      - kind: file
        path: src/runtime-layers/aideck.js
      - kind: file
        path: src/runtime-layers/effects/stage-runtime-artifacts.js
      - kind: file
        path: tests/runtime-refcount.test.js
      - kind: file
        path: tests/install-uninstall-roundtrip.test.js
      - kind: file
        path: tests/installer-data-safety.test.js
      - kind: file
        path: tests/runtime-registry-recovery.test.js
      - kind: file
        path: tests/runtime-lock-concurrency.test.js
      - kind: file
        path: scripts/test-with-upstream-pack.js
      - kind: file
        path: tests/upstream-pack-integration.test.js
    tags: []
  - id: T-006
    title: Fixar o commit upstream e qualificar a integração
    summary: Fixar o commit upstream e qualificar a integração
    weight: 1
    description: "Após autorização explícita imediatamente antes do push, publicar somente a branch upstream, fixar no consumer o SHA completo alcançável dessa branch, atualizar o lockfile e executar fault matrix cobrindo falha tardia, retry, uninstall e resíduos globais. verified_by: `docs/audits/installer-audit-2026-07-10.md:45-127,379-397`."
    status: pending
    lastUpdated: 2026-07-16T17:10:28.512Z
    scopeBoundary:
      - não fazer push sem aprovação no momento da ação, não criar tag/npm package/release, não liberar range sem SHA auditável e não anunciar remoção a partir de chaves do manifest
    acceptance:
      - origin da branch aprovada resolve para o resultSha do receipt, package-lock fixa o SHA completo, baseline-failure-retry-uninstall é byte-idêntico em greenfield e update, uninstall reporta decisões observadas e HOME não retém diretório global vazio
    verifier:
      kind: shell
      command: node scripts/verify-upstream-receipt.js --task F1/T-006 --worktree ../minimalist-installer-integrity-remediation --require-remote && node --test tests/minimalist-installer-link.test.js tests/installer-fault-injection.test.js tests/runtime-refcount.test.js tests/runtime-registry-recovery.test.js tests/install-uninstall-roundtrip.test.js tests/uninstall.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: package.json
      - kind: file
        path: package-lock.json
      - kind: file
        path: tests/minimalist-installer-link.test.js
      - kind: file
        path: tests/install-uninstall-roundtrip.test.js
      - kind: file
        path: tests/installer-fault-injection.test.js
      - kind: file
        path: tests/uninstall.test.js
      - kind: file
        path: docs/audits/minimalist-installer-upstream-receipt.json
    tags: []
parked: []
emerged: []
planTitle: Remediação integral de segurança, lifecycle e distribuição
planActive: true
current: true

---
# F1 initiative
