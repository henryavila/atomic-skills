---
schemaVersion: "0.1"
slug: integrity-remediation-f0-runtime-autocontido-e-setup-confiavel
title: Runtime autocontido e setup confiável
goal: Destravar a admissão SPEC do próprio executor, fazer toda skill instalada
  resolver scripts, dependências e assets pelo package root confiável,
  distinguir ledger do installer de um projeto configurado e fornecer o
  bootstrap transacional mínimo que materializa F4 sem estado parcial.
summary: Destrava executor, fecha runtime closure e materializa F4 de forma recuperável.
status: active
branch: plan/integrity-remediation
started: 2026-07-10T20:07:37.544Z
lastUpdated: 2026-07-12T02:10:36Z
nextAction: Inicie a T-005 escrevendo os testes vermelhos de fault injection em
  tests/phase-materialization/materialize-bootstrap.test.js.
parentPlan: integrity-remediation
phaseId: F0
businessIntent:
  value: Eliminar dependências do checkout fonte e impedir que o ledger do
    installer mascare setup ausente, criando uma base confiável para toda a
    remediação.
  workflow: Destravar materialização mínima; executar e reconciliar o lifecycle
    transacional; corrigir o caminho SPEC-implement; então entregar segurança do
    installer, contratos de host, Gemini/portabilidade e qualificação de
    release.
  rules: Nenhuma mutação sem ownership provado; uma autoridade por contrato;
    reprodução vermelha antes de cada correção; execução em consumidor sem
    checkout fonte; falha fechada diante de ambiguidade.
  outOfScope: Fork permanente do installer, banco transacional genérico, redesign
    da interface aiDeck, features não relacionadas e publicação da release.
  doneWhen: O manifesto canônico prova todos os findings formais e adicionais;
    black-box, fault matrix, tiers de host, Linux/macOS/Windows, Node 22.18.x,
    Node 24.11.x ou superior, full suite, docs e skill validation passam.
tasksDone: 4
tasksTotal: 5
gatesMet: 0
gatesTotal: 2
weightDone: 15
weightTotal: 19
exitGates:
  - id: F0-G1
    description: Admissão SPEC, runtime closure, resolução por package root e
      bootstrap transacional F0→F4 passam em consumidor sem checkout fonte.
      FAILS when `implement` exige `Files`, referência resolve fora do tarball
      ou fault injection deixa descriptor F4 e initiative divergentes.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/consumer-runtime-resolution.test.js
        tests/runtime-closure.test.js tests/consumer-install-e2e.test.js
        tests/implement-ready-contract.test.js
        tests/phase-materialization/materialize-bootstrap.test.js
        tests/phase-materialization/e2e-lifecycle.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/consumer-runtime-resolution.test.js tests…"
  - id: F0-G2
    description: Project-scope install não mascara ausência de setup canônico. FAILS
      when a pasta do ledger basta para pular setup.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/project.test.js
        tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    verifierLabel: "shell: node --test tests/project.test.js tests/install-uninstall-r…"
stack:
  - id: 1
    title: Runtime autocontido e setup confiável
    type: task
    openedAt: 2026-07-10T20:07:37.544Z
tasks:
  - id: T-001
    title: Destravar o executor e expor CLIs estáveis
    summary: Admite outputs/scopeBoundary e resolve as CLIs pelo package root instalado.
    weight: 5
    description: "Executar esta única task por TDD direto, corrigir a admissão de
      `implement` para `outputs[].path`/`scopeBoundary[]`, substituir imports
      relativos ao CWD por entrypoints que resolvem módulos a partir do package
      root instalado. verified_by: `skills/core/implement.md:51-77` e
      `docs/audits/project-implement-audit-2026-07-10.md:34-106,251-261`."
    status: done
    lastUpdated: 2026-07-11T22:27:22Z
    closedAt: 2026-07-11T22:27:22Z
    tags:
      - bootstrap
    scopeBoundary:
      - não importar `./src` do repositório consumidor e não alterar a semântica
        de decompose, discover, depend ou normalize
      - não invocar `implement` para esta própria task; fechar pelo verifier e
        pelo fluxo canônico `project done` antes de iniciar qualquer outra task
    acceptance:
      - um consumidor temporário sem checkout de atomic-skills executa os quatro
        entrypoints, e um `src/normalize.js` homônimo no consumidor nunca é
        carregado
      - o driver admite uma task materializada com outputs, exclusions,
        acceptance e verifier sem exigir a propriedade inexistente `Files`
    verifier:
      kind: shell
      command: node --test tests/skill-script-resolution.test.js
        tests/consumer-runtime-resolution.test.js
        tests/implement-ready-contract.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-11T22:27:22Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: 72 tests, 3 suites, 72 pass, 0 fail; duration_ms
        1145.286459"
    outputs:
      - kind: file
        path: src/runtime-paths.js
      - kind: file
        path: scripts/decompose-plan.js
      - kind: file
        path: scripts/bootstrap-project.js
      - kind: file
        path: scripts/plan-dependencies.js
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
      - kind: file
        path: skills/shared/project-assets/project-discover.md
      - kind: file
        path: skills/shared/project-assets/project-dependencies.md
      - kind: file
        path: skills/shared/project-assets/project-verify.md
      - kind: file
        path: skills/core/implement.md
      - kind: file
        path: tests/skill-script-resolution.test.js
      - kind: file
        path: tests/consumer-runtime-resolution.test.js
      - kind: file
        path: tests/implement-ready-contract.test.js
      - kind: file
        path: tests/phase-materialization/implement-backstop.test.js
  - id: T-002
    title: Fechar o grafo de assets e detectar colisões
    summary: Instala o grafo completo de assets, com recursão e colisões explícitas.
    weight: 4
    description: "Instalar recursivamente os helpers lazy referenciados, renderizar
      referências por `ASSETS_PATH` e rejeitar colisões em vez de descartar a
      segunda origem. verified_by:
      `docs/audits/installer-audit-2026-07-10.md:162-199,352-378`."
    status: done
    lastUpdated: 2026-07-11T23:06:02Z
    closedAt: 2026-07-11T23:06:02Z
    scopeBoundary:
      - não achatar dois assets no mesmo destino e não manter referências
        runtime para `skills/shared/` no conteúdo instalado
    acceptance:
      - a closure validator percorre profundidade arbitrária, falha em colisão,
        inclui helpers standalone e confirma que help HTML faz parte do tarball
        consumível
    verifier:
      kind: shell
      command: node --test tests/minimalist-installer-link.test.js
        tests/runtime-closure.test.js && npm pack --dry-run --json
        >/tmp/atomic-skills-pack.json
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-11T23:06:02Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: 8 tests, 2 suites, 8 pass, 0 fail; npm pack
        --dry-run --json: exit 0; duration_ms 1196.2205"
    outputs:
      - kind: file
        path: src/providers/skills-file-set.js
      - kind: file
        path: src/config.js
      - kind: file
        path: src/render.js
      - kind: file
        path: scripts/validate-runtime-closure.js
      - kind: file
        path: tests/minimalist-installer-link.test.js
      - kind: file
        path: tests/runtime-closure.test.js
      - kind: file
        path: tests/install.test.js
      - kind: file
        path: package.json
      - kind: file
        path: docs/design/project-onboarding/index.html
  - id: T-003
    title: Tornar o sentinel de setup estrutural
    summary: Reconhece setup apenas quando config e índice ou projeto canônicos existem.
    weight: 2
    description: "Detectar setup por config e índice/projeto válidos, nunca pela
      mera existência de `.atomic-skills/` criada pelo manifest ou hook.
      verified_by: `docs/audits/installer-audit-2026-07-10.md:128-161`."
    status: done
    lastUpdated: 2026-07-12T00:43:00Z
    closedAt: 2026-07-12T00:43:00Z
    scopeBoundary:
      - não apagar manifests legados e não tratar diretório vazio ou ledger
        isolado como projeto configurado
    acceptance:
      - install project-scope sem estado entra no setup, estado canônico válido
        não reexecuta setup, e coexistência legacy continua diagnosticável
    verifier:
      kind: shell
      command: node --test tests/project.test.js
        tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-12T00:43:00Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: 75 tests, 2 suites, 75 pass, 0 fail, 0
        skipped; duration_ms 4878.142458; commit ac6c3af"
    outputs:
      - kind: file
        path: skills/core/project.md
      - kind: file
        path: skills/shared/project-assets/project-create-plan.md
      - kind: file
        path: skills/shared/project-assets/project-create-initiative.md
      - kind: file
        path: skills/shared/project-assets/project-setup.md
      - kind: file
        path: src/manifest.js
      - kind: file
        path: tests/project.test.js
      - kind: file
        path: tests/install-uninstall-roundtrip.test.js
  - id: T-004
    title: Provar execução fora do checkout fonte
    summary: Exercita o tarball num consumidor isolado sem depender do checkout fonte.
    weight: 4
    description: "Criar um E2E em HOME e repo temporários que instala o pacote
      empacotado e carrega scripts, assets e schemas usando apenas a instalação.
      verified_by:
      `docs/audits/project-implement-audit-2026-07-10.md:34-69,186-202`."
    status: done
    lastUpdated: 2026-07-12T02:10:36Z
    closedAt: 2026-07-12T02:10:36Z
    scopeBoundary:
      - não usar paths absolutos deste checkout no fixture e não aceitar
        snapshots de presença como substituto de execução
    acceptance:
      - o tarball instalado executa decompose, discover, depend, verify e os
        helpers lazy em um consumidor com `src/normalize.js` sentinela que falha
        se for carregado
    verifier:
      kind: shell
      command: node --test tests/consumer-install-e2e.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-12T02:10:36Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: 4 tests, 1 suite, 4 pass, 0 fail, 0 skipped;
        duration_ms 8230.782667; commit 845187a"
    outputs:
      - kind: file
        path: tests/consumer-install-e2e.test.js
      - kind: file
        path: tests/fixtures/consumer-runtime/package.json
      - kind: file
        path: tests/fixtures/consumer-runtime/src/normalize.js
      - kind: file
        path: scripts/validate-runtime-closure.js
      - kind: file
        path: package.json
  - id: T-005
    title: Bootstrapar materialização recuperável de F4
    summary: Materializa F4 por uma transação recuperável sobre plan e initiative.
    weight: 4
    description: "Criar em `scripts/materialize-state.js` a única primitiva de
      materialização: preparar plan e initiative em staging, validar o par,
      persistir marker durável com hashes e convergir por renames individuais e
      retry para o estado anterior ou para o par completo. Ligar
      `project-materialize.md` a essa primitiva apenas no caminho
      descriptor-only→initiative necessário para F4; F4/T-006 amplia o mesmo
      módulo. verified_by:
      `skills/shared/project-assets/project-materialize.md:25-45,105-148` e
      `.atomic-skills/reviews/2026-07-11-1415-integrity-remediation.md:232-257`\
      ."
    status: pending
    lastUpdated: 2026-07-11T18:10:30Z
    tags:
      - bootstrap
    scopeBoundary:
      - não criar writer alternativo ou writes sequenciais inline na skill
      - não generalizar em F0 para reopen, switch ou close; F4/T-006 faz essa
        hardening
      - não reescrever o histórico materializado de F0; a reconciliação pertence
        a F4
    acceptance:
      - fault injection após cada rename deixa marker recuperável; retry
        converge ao par anterior ou completo
      - validate-state nunca observa F4 active sem initiative correspondente
      - a transição F0→F4 usa `scripts/materialize-state.js`, sem edição manual
        do descriptor
    verifier:
      kind: shell
      command: node --test tests/phase-materialization/materialize-bootstrap.test.js
        tests/phase-materialization/e2e-lifecycle.test.js
        tests/phase-materialization/materialize-verb.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: scripts/materialize-state.js
      - kind: file
        path: skills/shared/project-assets/project-materialize.md
      - kind: file
        path: tests/phase-materialization/materialize-bootstrap.test.js
      - kind: file
        path: tests/phase-materialization/e2e-lifecycle.test.js
parked: []
emerged: []
planTitle: Remediação integral de segurança, lifecycle e distribuição
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Runtime autocontido e setup confiável**.

## Decisions

_(record decisions here as they are made)_

## Links

_(plan doc, external refs)_

## Session handoff

- **Narrative:** A fase F0 permanece ativa com T-001..T-004 fechadas e `evidence.passed: true`. A T-004 agora empacota o tarball, instala-o num HOME/repo temporários e executa bin, decompose, discover, depend, normalize, verify, schemas e helpers lazy somente pelo root extraído. Implementação em `845187a`, checkpoint de estado em `c8064a1`; nenhuma tarefa está em voo.
- **Decision log:** O diagnóstico provou que T-001/T-002 já corrigiram o runtime e que o falso verde estava em `tests/consumer-runtime-resolution.test.js`, que apontava manualmente para o checkout. Por isso `package.json` e `scripts/validate-runtime-closure.js` permaneceram intactos. O E2E deriva helpers das referências renderizadas, usa `src/normalize.js` sentinela no consumidor e canonicaliza `tmpdir()` com `realpathSync` para neutralizar o alias macOS `/var`→`/private/var`. A remoção temporária de `src/` de `package.json.files` matou o teste em `bin/cli.js`→`src/install.js` e foi revertida antes do GREEN.
- **Single nextAction:** Inicie a T-005 escrevendo os testes vermelhos de fault injection em `tests/phase-materialization/materialize-bootstrap.test.js`.
- **Verbatim state:** verifier T-004 pós-commit → `ℹ tests 4`, `ℹ pass 4`, `ℹ fail 0`, `ℹ skipped 0`, `duration_ms 8230.782667`; mutant sem `src/` → `ERR_MODULE_NOT_FOUND .../src/install.js`, exit 1; contratos vizinhos → `ℹ tests 80`, `ℹ pass 80`, `ℹ fail 0`, `duration_ms 7537.189708`; `npm test` → `ℹ tests 1667`, `ℹ pass 1659`, `ℹ fail 0`, `ℹ skipped 8`, `duration_ms 18894.9555`; `npm run validate-skills` → 15 válidas; `npm run check-docs` → exit 0; `validate-state.js .atomic-skills` → 165 arquivos, 26 planos e 1 routing config válidos.
- **Uncommitted changes:** nenhuma; este bloco é o snapshot de retomada após `845187a` e `c8064a1`.
