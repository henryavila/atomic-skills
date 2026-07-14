---
schemaVersion: "0.1"
slug: integrity-remediation-f0-runtime-autocontido-e-setup-confiavel
title: Runtime autocontido e setup confiável
goal: Destravar a admissão SPEC do próprio executor, fazer toda skill instalada
  resolver scripts, dependências e assets pelo package root confiável,
  distinguir ledger do installer de um projeto configurado e fornecer o
  bootstrap transacional mínimo que materializa F4 sem estado parcial.
summary: Destrava executor, fecha runtime closure e materializa F4 de forma recuperável.
status: done
branch: plan/integrity-remediation
started: 2026-07-10T20:07:37.544Z
lastUpdated: 2026-07-14T19:33:36Z
nextAction: null
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
tasksDone: 6
tasksTotal: 6
gatesMet: 2
gatesTotal: 2
weightDone: 20
weightTotal: 20
exitGates:
  - id: F0-G1
    description: Admissão SPEC, runtime closure, resolução por package root e
      bootstrap transacional F0→F4 passam em consumidor sem checkout fonte.
      FAILS when `implement` exige `Files`, referência resolve fora do tarball
      ou fault injection deixa descriptor F4 e initiative divergentes.
    status: met
    metAt: 2026-07-14T19:33:36Z
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
      verifiedAt: 2026-07-14T19:33:36Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: 62 tests, 5 suites, 62 pass, 0 fail, 0 skipped;
        exit 0; fresh closing run on reviewed HEAD 0ce031d"
    verifierLabel: "shell: node --test tests/consumer-runtime-resolution.test.js tests…"
    evidenceSummary: passed · 2026-07-14
  - id: F0-G2
    description: Project-scope install não mascara ausência de setup canônico. FAILS
      when a pasta do ledger basta para pular setup.
    status: met
    metAt: 2026-07-14T19:33:36Z
    verifier:
      kind: shell
      command: node --test tests/project.test.js
        tests/install-uninstall-roundtrip.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-14T19:33:36Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: 86 tests, 2 suites, 86 pass, 0 fail, 0 skipped;
        exit 0; fresh closing run on reviewed HEAD 0ce031d"
    verifierLabel: "shell: node --test tests/project.test.js tests/install-uninstall-r…"
    evidenceSummary: passed · 2026-07-14
stack:
  - id: 1
    title: Runtime autocontido e setup confiável
    type: task
    openedAt: 2026-07-10T20:07:37.544Z
  - id: 2
    title: T-006 — Fechar os achados válidos do review de a3089a4
    type: task
    openedAt: 2026-07-14T01:33:28Z
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
      outputSummary: "node --test: 75 tests, 2 suites, 75 pass, 0 fail, 0 skipped;
        duration_ms 4878.142458; commit ac6c3af"
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
    status: done
    lastUpdated: 2026-07-12T10:10:40Z
    closedAt: 2026-07-12T10:10:40Z
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
      - o caminho descriptor-only que materializará F4 roteia plan e initiative
        por `scripts/materialize-state.js`, sem edição manual do descriptor
    verifier:
      kind: shell
      command: node --test tests/phase-materialization/materialize-bootstrap.test.js
        tests/phase-materialization/e2e-lifecycle.test.js
        tests/phase-materialization/materialize-verb.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-12T10:10:40Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: 18 tests, 1 suite, 18 pass, 0 fail, 0 skipped;
        duration_ms 1474.601208; merged primary cbffd20"
    outputs:
      - kind: file
        path: scripts/materialize-state.js
      - kind: file
        path: skills/shared/project-assets/project-materialize.md
      - kind: file
        path: tests/phase-materialization/materialize-bootstrap.test.js
      - kind: file
        path: tests/phase-materialization/e2e-lifecycle.test.js
  - id: T-006
    title: Fechar os achados válidos do review de a3089a4
    summary: Corrige os seis defeitos validados e torna o checkpoint de F0 elegível
      para nova revisão.
    description: "Corrigir F-002..F-007 por TDD, documentar a fronteira operacional
      de F-001 e repetir review-code sobre um novo HEAD limpo. verified_by:
      `.atomic-skills/reviews/2026-07-13-0844-integrity-remediation-f0-a3089a4.\
      md:225-447`."
    status: done
    lastUpdated: 2026-07-14T19:33:36Z
    closedAt: 2026-07-14T19:33:36Z
    tags:
      - review
      - data-integrity
    scopeBoundary:
      - não avançar F0 nem restaurar reviewGate antes de review aprovado
      - não ampliar F0 para o lock universal de writers planejado para F4
      - não alterar schemas, dependências, installer ou release
    acceptance:
      - lock parcial ou crash converge sem intervenção e IDs duplicados falham
        antes do marker
      - refresh usa publicação atômica ou CAS e não corrompe Markdown
      - arrays JSON legados aninhados preservam completion events
      - writeInitiativeFile rejeita peso negativo direta e indiretamente
      - novo checkpoint limpo recebe review-code aprovado
    verifier:
      kind: shell
      command: node --test tests/phase-materialization/materialize-bootstrap.test.js
        tests/refresh-state.test.js tests/append-completion-dispatchlog.test.js
        tests/decompose.test.js
      expectExitCode: 0
    evidence:
      verifierKind: shell
      verifiedAt: 2026-07-14T19:33:36Z
      passed: true
      exitCode: 0
      outputSummary: "node --test: 166 tests, 15 suites, 166 pass, 0 fail, 0 skipped;
        exit 0; R21 informed pass approved reviewed HEAD 0ce031d with zero
        remaining findings"
    provenance:
      surfacedAt: 2026-07-14T01:31:57Z
      surfacedDuring: integrity-remediation-f0-runtime-autocontido-e-setup-confiavel/review-code-a3089a4
      surfacedBy: ai
    context:
      solves: Elimina defeitos que permitem lock permanente, estado ambíguo ou
        inválido, perda ou corrupção do índice e falha na emissão de eventos.
      trigger: O review-code cross-model do commit a3089a4 terminou needs_changes com
        sete achados major; a triagem validou F-002..F-007 e classificou F-001
        como fronteira destinada a F4.
      assumesStillValid:
        - F-002..F-007 permanecem reproduzíveis no HEAD a3089a4 e pertencem à
          superfície alterada em F0.
        - F-001 permanece fora do recorte de F0 e será tratado pela autoridade
          compartilhada de writers em F4.
        - F0 somente pode avançar após review aprovado sobre um novo HEAD limpo.
      ratifiedAt: 2026-07-14T01:31:57Z
      ratifiedBy: human
      lastReviewedAt: 2026-07-14T01:31:57Z
parked: []
emerged: []
planTitle: Remediação integral de segurança, lifecycle e distribuição
planActive: true
current: true
---

# Narrative / notes

Initiative for phase **F0 — Runtime autocontido e setup confiável**.

## Decisions

- **2026-07-14 — delegação provisória de gates:** durante a ausência do usuário,
  o executor escolhe a alternativa de menor risco que preserve integridade,
  reversibilidade e escopo; registra escolha, fundamento e evidência para
  validação posterior. A delegação cobre ratify/advance/disposition e triagem de
  review dentro deste plano, mas não autoriza push, PR, publicação ou mutação de
  sistemas externos.
- **2026-07-14 — política de review por fase:** cada fase termina com envelope
  Codex blind+informed válido. Falha de transporte ou limite reinicia o envelope
  com o mesmo diff e contexto factual reduzido; nenhum passe parcial concede
  aprovação.
- **2026-07-14 — modelo de review:** após três timeouts do modelo padrão e duas
  falhas pré-output no Pass 2, o envelope usa `codex-auto-review`, descrito pelo
  cache local como `Automatic approval review model for Codex`, com reasoning
  `high`. A troca altera o reviewer, não o diff, escopo ou templates.
- **2026-07-14 — triagem provisória do review `364ce8b`:** o passe informado
  confirmou quatro findings major. A delegação do usuário foi aplicada pela
  alternativa conservadora: validar cada mecanismo em fonte, criar quatro REDs
  independentes e corrigir todos em `555088b`; nenhum finding foi dispensado.
- **2026-07-14 — triagem provisória do review `555088b`:** F-001 major foi
  confirmado por execução end-to-end do verifier e corrigido em `1f1ca51`;
  F-002-blind foi descartado pelo passe informado por não haver contrato de
  ACL/xattr/hardlink e por conflitar com o gate explícito de publicação atômica.
- **2026-07-14 — plateau e remediação de segurança:** a terceira iteração
  terminou com 1 critical + 1 major, acima do 1 major anterior. O loop
  `review-code` foi encerrado no limite, sem aprovação. Pela delegação, a opção
  conservadora foi aplicar `codex-security:fix-finding` ao escape de symlink e
  TDD ao `serve`, persistir o risco Windows residual e reservar o próximo Codex
  exclusivamente ao gate independente de encerramento de fase pedido pelo usuário.
- **2026-07-14 — triagem provisória do review `6b45b14` (R10):** o passe
  informado descartou o check de execução direta de `refresh-state.js` por
  anteceder o base congelado e manteve a janela final check→rename deferida para
  F4. O único finding causal foi refinado ao F0 inicial de `new plan`/`adopt`:
  `materialize <phase>` já estampava o SHA após render, mas
  `materializeDecomposition()` não tinha rota para `startedCommit`. A decisão
  conservadora foi transportar e validar o anchor no writer/CLI, documentar os
  dois fluxos consumidores e cobrir unidade, consumidor instalado e E2E; a
  remediação foi fechada em `fd9af30` sem reescrever o verdict bruto.
- **2026-07-14 — triagem provisória do review `642a2ef` (R11):** o passe
  informado descartou novamente o finding de dispatch-log por contrariar o
  contrato fail-closed ratificado. Manteve um major: frontmatter inválido era
  omitido do refresh sem preencher `indexErrors`; e um minor: o anchor aceitava
  rev mutável com sete caracteres. A decisão delegada foi preservar o
  fail-closed e reparar os dois seams por REDs independentes. Em `6d3f512`,
  falhas de leitura/parse entram no canal parcial sem bloquear projeções válidas,
  e `startedCommit` aceita somente 7–64 caracteres hexadecimais.
- **2026-07-14 — triagem provisória do review `61bdcd9` (R12):** o passe
  informado descartou os findings de dispatch-log e smoke parcial por
  contradizerem contratos F0 já ratificados. Manteve um major nos helpers `src`
  de `project-view` e emergiu um major na autoridade transacional de
  `project-materialize`: ambos podiam executar arquivo homônimo do consumidor
  quando o marker não existia. Pela delegação, foi preservado o fallback de
  desenvolvimento somente após provar o nome do pacote e o entrypoint
  necessário; consumidor arbitrário agora falha fechado com erro de
  reinstalação. Todos os scripts dos dois fluxos reutilizam o `PKG_ROOT`
  verificado, e um guard estático impede a volta do `|| echo .`. A remediação e
  os fixtures de instalação foram fechados em `3521ade` sem alterar o verdict
  bruto.
- **2026-07-14 — triagem provisória do review `8e2e4e3` (R13):** o passe
  informado descartou novamente o finding de dispatch-log por contrariar o
  contrato fail-closed. Confirmou três major — fallbacks package-owned restantes,
  transporte shell-frágil de `businessIntent` e projeção de campos inválidos — e
  um minor no guard estreito. Pela delegação, a decisão conservadora foi fechar
  a classe inteira: remover 86 fallbacks unchecked, transportar JSON por arquivo
  temporário com limpeza, validar projeções contra os enums canônicos e
  generalizar o guard para qualquer `scripts/*.js`. A remediação TDD foi fechada
  em `6e04867`; o verdict bruto histórico permanece `needs_changes`.
- **2026-07-14 — triagem provisória do review `e96ddbc` (R14):** o passe
  informado descartou o race final de refresh, reservado a F4, e a recuperação
  marker-first, que é o contrato documentado. Confirmou um major de
  compatibilidade em fases sem tasks e emergiu um major no fallback do router.
  Pela delegação, `nextAction: null` foi preservado somente quando `tasks` é
  vazio; fases com tasks continuam exigindo passo concreto. O router voltou a
  aceitar checkout-fonte apenas após provar identidade do pacote e entrypoint,
  com execução real do bloco renderizado. A remediação TDD foi fechada em
  `141a170`; o verdict bruto histórico permanece `needs_changes`.
- **2026-07-14 — triagem provisória do review `859598f` (R15):** os três
  findings cegos permaneceram válidos e o passe informado emergiu a mesma
  quebra nos recipes `new plan` e `adopt`. Pela delegação, o runtime instalado
  segue como autoridade única em `project verify`; ambos os recipes agora
  constroem o par opcional `--started-commit` somente quando Git resolve HEAD,
  preservando o fallback por timestamp fora de Git. O RED reproduziu os dois
  defeitos e o GREEN executou os dois blocos shell a partir de um consumidor
  sem repositório. A remediação foi fechada em `6b2c020`; o verdict bruto
  histórico permanece `needs_changes`.
- **2026-07-14 — triagem provisória do review `6cc9a16` (R16):** o passe
  informado descartou os três findings cegos por confundirem contratos
  deliberados de input caller-owned, paths relativos ao CWD e telemetry
  fail-closed. Emergiu um major real e um minor de cobertura: no BSD/macOS, o
  template com `.json` após os X criava literalmente o path previsível. Pela
  delegação, os dois fluxos passaram a usar um run terminal de X sob `TMPDIR`
  (fallback `/tmp`), sem extensão desnecessária. A regressão agora executa as
  duas alocações, exige paths existentes/distintos/aleatórios, escreve o JSON,
  executa os dois recipes e confirma cleanup. A remediação foi fechada em
  `15a6dde`; o verdict bruto histórico permanece `needs_changes`.
- **2026-07-14 — triagem provisória do review `fe69871` (R17):** o passe
  informado descartou o race final de refresh, já reservado a F4, e dois
  comportamentos preexistentes sem nexo causal com F0. Confirmou dois major:
  um `startedCommit` registrado mas inutilizável ainda recaía no heurístico por
  data, e `serve` tentava apagar um id alternativo legítimo devolvido pelo
  aiDeck. Pela delegação, provenance inválida agora omite actuals em vez de
  fabricar métricas; o fallback por data fica restrito a estado legado sem
  anchor. O id escolhido pelo servidor é aceito apenas quando a resposta prova
  o mesmo `rootDir`, sem delete/re-register. Os dois REDs falharam antes das
  correções, o GREEN passou 31/31 e a integração passou 128/128. A remediação
  foi fechada em `6a5c1a6`; o verdict bruto histórico permanece
  `needs_changes`.
- **2026-07-14 — triagem provisória do review `97d50e1` (R18):** o passe
  informado descartou quatro findings cegos que contrariavam contratos
  ratificados de fallback verificado, paths caller-owned e telemetry
  fail-closed. Emergiu um major real no recipe shell de browser: ele aceitava
  qualquer id de registro sintaticamente válido sem conferir o `rootDir`
  retornado. Pela delegação, conflito explícito de raiz agora desativa o fluxo
  de browser; id alternativo exige raiz resolvida igual ao repositório atual;
  somente resposta legada com o mesmo id e `rootDir` ausente permanece
  compatível. O RED reproduziu o desvio, o GREEN passou 73/73, a integração
  passou 110/110, runtime closure 7/7 e as 15 skills validaram. A remediação
  foi fechada em `03131d1`; o verdict bruto histórico permanece
  `needs_changes`.
- **2026-07-14 — triagem provisória do review `bf755cb` (R19):** o passe
  informado descartou os três findings cegos por contrariarem os contratos de
  paths caller-owned, telemetry fail-closed e skills instaladas marker-first.
  Emergiu um major de compatibilidade: `path.resolve` comparava texto lexical e
  rejeitava um `rootDir` que apontava ao mesmo repositório por symlink/alias.
  Pela delegação, a prova de raiz foi canonicalizada com `realpathSync` nos dois
  clientes, sem enfraquecer a recusa de raiz ausente ou conflitante. Dois REDs
  independentes falharam antes da correção; o GREEN passou 100/100, a integração
  112/112, runtime closure 7/7 e as 15 skills validaram. A remediação foi
  fechada em `e95550d`; o verdict bruto histórico permanece `needs_changes`.
- **2026-07-14 — triagem provisória do review `9225131` (R20):** o passe
  informado descartou o finding markerless por contrariar o contrato das
  skills instaladas e manteve dois major. O auto-start de aiDeck ignorava
  `opts.aideckBin` e executava qualquer path via Node; o guard de symlink do
  índice aceitava `plan.md` ou fase dentro do mesmo projeto. Pela delegação, o
  launcher agora preserva precedência e classifica apenas `.js`/`.mjs` como
  entrypoint Node; outros paths executam diretamente. A indirection do índice
  ficou restrita a `CANONICAL-PROJECT-STATUS.md` no mesmo diretório real. Três
  REDs falharam antes da correção; o GREEN passou 44/44, a integração 130/130,
  runtime closure 7/7 e as 15 skills validaram. A remediação foi fechada em
  `909e7e6`; o verdict bruto histórico permanece `needs_changes`.
- **2026-07-14 — aprovação do review `0ce031d` (R21):** o passe cego levantou
  dois major, ambos descartados pelo passe informado por contrariarem contratos
  explícitos já ratificados: telemetry presente e corrompida falha fechado, e o
  browser shell instalado usa launcher `.mjs` mais dashboard staged. O diff
  congelado terminou `approve`, sem findings mantidos ou emergentes. Pela
  delegação, a decisão conservadora foi preservar os contratos e ratificar a
  aprovação, apoiada por verifiers frescos no mesmo HEAD limpo: T-006 166/166,
  F0-G1 62/62, F0-G2 86/86 e full suite 1.769 pass/0 fail/8 skip.

## Links

_(plan doc, external refs)_

## Session handoff

- **Narrative:** A fase F0 foi encerrada com T-001..T-006 e os dois exit gates verdes. O review R21 aprovou o checkpoint limpo `0ce031d` com zero findings após a reconciliação informada; o commit guard confirmou SHA, árvore limpa, lessons registradas e estado terminal antes do primeiro write de fechamento.
- **Decision log:** A materialização agora exige `expectedPlanHash`, publica claims completos por temp→rename e serializa contenders por bakery lock (`choosing` + ticket) sobre paths únicos; a identidade do processo é canônica entre locale/fuso, release do lock próprio não depende de contender suspenso e setup tolera cleanup concorrente. Claims/locks mortos são recuperados e todos os caminhos de publish, complete-retry e rollback relêem o par antes de remover o marker. A autoridade recupera markers antes de candidates e aceita `nextAction: null` somente para fase sem tasks; havendo tasks, exige passo concreto, summaries, weights e sinais. `phase-done` exige contexto Git explícito, rejeita worktree sujo/SHA divergente e não aceita `requireReview:false` como bypass. `refresh-state` preserva linhas confiáveis diante de projeções inválidas; o race final check→rename continua reservado a F4. O dispatch log falha fechado em corrupção/identidade incompleta. Skills package-owned reutilizam `PKG_ROOT`; checkout-fonte exige identidade do pacote e entrypoint, e `businessIntent` usa arquivo temporário. T-005 descreve apenas o seam futuro para F4.
- **T-006 decision:** O alvo resolvido de symlink deve permanecer no diretório real do projeto; alvo externo, projeto irmão, plano e fase falham antes da publicação; somente `CANONICAL-PROJECT-STATUS.md` é indirection aprovada. `serve` e verifier agregam os dois canais parciais, inclusive frontmatter de fase ilegível. Auto-start aiDeck honra override explícito e executa apenas `.js`/`.mjs` via Node. A janela final check→rename permanece a fronteira deferida de F4. O `startedCommit` inicial é SHA hexadecimal e o par de argumentos é omitido fora de Git nos dois fluxos; se um anchor persistido deixa de ser ancestral, actuals são omitidos, sem fallback heurístico. O runtime instalado permanece a autoridade; checkout-fonte só é aceito após prova explícita. Fases materializadas sem tasks preservam o `null` permitido pelo schema. O id de registro devolvido pelo aiDeck substitui o candidato local somente com prova canônica de mesmo `rootDir`; os dois clientes aceitam alias do mesmo repositório, falham fechado diante de raiz ausente/conflitante e preservam apenas a resposta legada de mesmo id sem `rootDir`.
- **Single nextAction:** Materializar e iniciar F4, a única sucessora elegível pelo DAG após F0.
- **Verbatim state:** R21 aprovado → `.atomic-skills/reviews/2026-07-14-1629-integrity-remediation-f0-phase-0ce031d-r21.md`, blind 2 major, informed 0 findings, 2 dropped/0 maintained/0 emerged; reviewed HEAD → `0ce031d`; verifier T-006 166/166; F0-G1 62/62; F0-G2 86/86; full suite 1.777 total/1.769 pass/8 skip/0 fail; skills 15/15; state 166/166; incertezas preservadas → race final de refresh em F4, path-space preexistente fora do diff e symlink de arquivo real em Windows no gate multiplataforma posterior.

## Self-review against code-quality gates

- **G1 read-before-claim:** aplicado — os verifiers F0-G1 e F0-G2 foram lidos após execução fresca e suas contagens foram persistidas em plan e initiative.
- **G2 soft-language:** aplicado — as claims de fechamento usam `evidence.passed: true`; `nextAction` e o handoff descrevem o review pendente sem linguagem especulativa.
- **G3 mutation accountability:** aplicado — cada mudança comportamental possui regressão que falhou antes do reparo e passou depois dele, incluindo stale candidate, claims/lock/recovery, PID reuse e locale/fuso, writes concorrentes em publish/complete/rollback, metadados de task, foco serial, review stale/omitido, colisão de índice e ordem híbrida/union do dispatch log.
- **G4 fixture fidelity:** aplicado — os testes exercitam plan/initiative, marker, candidates, lock e índice com fixtures estruturais representativas dos artefatos reais.
- **G5 RED evidence:** aplicado — os REDs observados falharam nos contratos-alvo antes das mudanças de produção e os mesmos testes passaram no conjunto integrado.
- **G6 reference-or-strike:** aplicado — o handoff preserva literalmente o HEAD base, o review histórico e as contagens/durações dos gates reexecutados.
- **G7 abstraction restraint:** aplicado — as correções reutilizam os parsers, transações e helpers existentes; o helper de sincronização do índice permanece privado.
- **G10 gate-must-be-able-to-fail:** aplicado — F0-G1 e F0-G2 declaram condições `FAILS when` concretas e foram reexecutados após a remediação.
- **Codex review:** R21 executado no HEAD `0ce031d2cebe0a5059a388e99ff6df5432aec4eb`, verdict `approve`, counts finais 0B/0C/0M/0m/0n, receipt `.atomic-skills/reviews/2026-07-14-1629-integrity-remediation-f0-phase-0ce031d-r21.md`.
- **Review gate (G2):** registrado no descriptor F0 como `reviewGate: { status: passed, at: 0ce031d2cebe0a5059a388e99ff6df5432aec4eb, mode: both }`; o commit guard permitiu a transição antes do primeiro write.
- **Lessons (G1):** quatro lessons reutilizáveis ratificadas pelo usuário e persistidas em `lessons/integrity-remediation-f0-runtime-autocontido-e-setup-confiavel.md` para F1/F2/F4/F5/F6.
