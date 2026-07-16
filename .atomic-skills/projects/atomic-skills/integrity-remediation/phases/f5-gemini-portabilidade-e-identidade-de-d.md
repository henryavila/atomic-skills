---
schemaVersion: "0.1"
slug: integrity-remediation-f5-gemini-portabilidade-e-identidade-de-d
title: Gemini, portabilidade e identidade de dashboard
goal: Tornar os contratos Gemini observáveis no CLI real, remover suposições POSIX e registrar o projectId canônico em worktrees.
summary: Gemini + Windows + projectId
status: active
branch: plan/integrity-remediation
started: 2026-07-16T17:30:58.028Z
lastUpdated: 2026-07-16T17:30:58.028Z
nextAction: F5/T-001
parentPlan: integrity-remediation
phaseId: F5
businessIntent:
  value: Gemini contracts observable; Windows paths portable; dashboard projectId canonical.
  workflow: Gemini native depth + TOML + Windows path + projectId.
  rules: Native canonical; no POSIX-only splits; projectId from folder not basename of worktree.
  outOfScope: Full multi-OS CI F6.
  doneWhen: F5-G1..G3 green (G1 may mock CLI if gemini absent).
tasksDone: 0
tasksTotal: 6
gatesMet: 0
gatesTotal: 3
weightDone: 0
weightTotal: 6
exitGates:
  - id: F5-G1
    description: Gemini CLI suportado descobre e invoca todas as skills native e todos os commands habilitados. FAILS when um artifact está ausente, inválido ou recebe argumentos errados.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/gemini-cli-contract.test.js
      expectExitCode: 0
  - id: F5-G2
    description: Validator e normalizer classificam paths Windows e POSIX com o mesmo contrato. FAILS when path.win32 retorna kind ou projectId incorreto.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/windows-path-contract.test.js tests/validate-state.test.js tests/normalize.test.js
      expectExitCode: 0
  - id: F5-G3
    description: Dashboard registra o projectId canônico com JSON válido em qualquer worktree. FAILS when basename ou caracteres do root alteram a identidade.
    status: pending
    verifier:
      kind: shell
      command: node --test tests/project-registration.test.js
      expectExitCode: 0
stack:
  - id: 1
    title: Gemini, portabilidade e identidade de dashboard
    type: task
    openedAt: 2026-07-16T17:30:58.028Z
tasks:
  - id: T-001
    title: Instalar Gemini native no discovery depth suportado
    summary: Instalar Gemini native no discovery depth suportado
    weight: 1
    description: "Materializar cada skill diretamente em `.gemini/skills/atomic-skills-*/SKILL.md` ou outra forma de primeiro nível provada pelo CLI e migrar o layout antigo pelo journal. verified_by: `src/config.js:20-31,127-130` e `projects/atomic-skills/integrity-remediation/design.md:110-125`."
    status: pending
    lastUpdated: 2026-07-16T17:30:58.028Z
    scopeBoundary:
      - não manter skills funcionais dois níveis abaixo do scanner e não remover layout legado fora de ownership provado
    acceptance:
      - HOME temporário lista todas as core skills, update migra paths, uninstall remove layout novo owned e preserva conteúdo legado divergente
    verifier:
      kind: shell
      command: node --test tests/config.test.js tests/install-uninstall-roundtrip.test.js tests/gemini-cli-contract.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/config.js
      - kind: file
        path: src/providers/skills-file-set.js
      - kind: file
        path: src/install.js
      - kind: file
        path: tests/config.test.js
      - kind: file
        path: tests/install-uninstall-roundtrip.test.js
      - kind: file
        path: tests/gemini-cli-contract.test.js
  - id: T-002
    title: Serializar TOML e argumentos Gemini pelo contrato nativo
    summary: Serializar TOML e argumentos Gemini pelo contrato nativo
    weight: 1
    description: "Substituir interpolação manual por serializer, usar `{{args}}` em commands e eliminar `$ARGUMENTS` do profile Gemini. verified_by: `src/render.js:37-50,112-115` e `projects/atomic-skills/integrity-remediation/design.md:110-125`."
    status: pending
    lastUpdated: 2026-07-16T17:30:58.028Z
    scopeBoundary:
      - não escapar TOML por replace parcial e não duplicar argumentos por append implícito mais placeholder
    acceptance:
      - 14 de 14 command TOMLs parseiam em parser independente, cada command recebe sentinel uma vez e nenhum contém `$ARGUMENTS`
    verifier:
      kind: shell
      command: node --test tests/render.test.js tests/help/render-smoke.test.js tests/gemini-cli-contract.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/render.js
      - kind: file
        path: src/config.js
      - kind: file
        path: package.json
      - kind: file
        path: package-lock.json
      - kind: file
        path: tests/render.test.js
      - kind: file
        path: tests/help/render-smoke.test.js
      - kind: file
        path: tests/gemini-cli-contract.test.js
  - id: T-003
    title: Qualificar native, commands e seleção Gemini mais Codex
    summary: Qualificar native, commands e seleção Gemini mais Codex
    weight: 1
    description: "Manter native como canônico e habilitar commands/normalização dual somente após discovery e invocation completos. verified_by: `src/config.js:80-90` e `projects/atomic-skills/integrity-remediation/design.md:144-159`."
    status: pending
    lastUpdated: 2026-07-16T17:30:58.028Z
    scopeBoundary:
      - não redirecionar Gemini para fallback quebrado e não anunciar suporte a artifact que apenas parseia sem ser invocável
    acceptance:
      - native é default, dual host conserva Codex e Gemini funcionais, commands opcional passa list/load/invoke e capability reporta o caminho efetivo
    verifier:
      kind: shell
      command: node --test tests/cli.test.js tests/detect.test.js tests/gemini-cli-contract.test.js tests/host-profile-contract.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/config.js
      - kind: file
        path: src/detect.js
      - kind: file
        path: src/ui.js
      - kind: file
        path: tests/cli.test.js
      - kind: file
        path: tests/detect.test.js
      - kind: file
        path: tests/gemini-cli-contract.test.js
      - kind: file
        path: tests/host-profile-contract.test.js
  - id: T-004
    title: Tornar classificação de paths portátil
    summary: Tornar classificação de paths portátil
    weight: 1
    description: "Extrair utilitário baseado em `dirname`, `basename` e segmentos normalizados, removendo `split('/')` de validator e normalizer. verified_by: `scripts/validate-state.js:122-154` e `src/normalize.js:205-214`."
    status: pending
    lastUpdated: 2026-07-16T17:30:58.028Z
    scopeBoundary:
      - não substituir por split de outro separador e não limitar CI contratual a Ubuntu
    acceptance:
      - path.win32 classifica plan, initiative, lesson e projectId; flat/nested POSIX continuam iguais; workflow executa contratos críticos no Windows
    verifier:
      kind: shell
      command: node --test tests/validate-state.test.js tests/normalize.test.js tests/windows-path-contract.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/state-paths.js
      - kind: file
        path: scripts/validate-state.js
      - kind: file
        path: src/normalize.js
      - kind: file
        path: tests/validate-state.test.js
      - kind: file
        path: tests/normalize.test.js
      - kind: file
        path: tests/windows-path-contract.test.js
      - kind: file
        path: .github/workflows/test.yml
  - id: T-005
    title: Usar projectId canônico e payload JSON seguro
    summary: Usar projectId canônico e payload JSON seguro
    weight: 1
    description: "Compartilhar `resolveRegisteredProjectId`, respeitar único folder de projeto em plan worktree e serializar register payload sem interpolação shell. verified_by: `skills/shared/project-assets/project-view.md:69-71,113-137` e `src/serve.js:246-257`."
    status: pending
    lastUpdated: 2026-07-16T17:30:58.028Z
    scopeBoundary:
      - não derivar id do basename quando há um projeto canônico e não montar JSON com concatenação de `$PWD`
    acceptance:
      - worktree plan-name registra canonical-id, normalização remove prefixo numérico/trunca 64, e roots com aspas produzem JSON válido
    verifier:
      kind: shell
      command: node --test tests/serve.test.js tests/project.test.js tests/project-registration.test.js
      expectExitCode: 0
    outputs:
      - kind: file
        path: src/serve.js
      - kind: file
        path: scripts/resolve-project-id.js
      - kind: file
        path: skills/shared/project-assets/project-view.md
      - kind: file
        path: tests/serve.test.js
      - kind: file
        path: tests/project.test.js
      - kind: file
        path: tests/project-registration.test.js
  - id: T-006
    title: Alinhar documentação e catálogo ao contrato novo
    summary: Alinhar documentação e catálogo ao contrato novo
    weight: 1
    description: "Remover layout flat como modelo recomendado, declarar Mode 2 e network corretamente e registrar a distinção entre closure authority e drift reconcile. verified_by: `docs/audits/project-implement-audit-2026-07-10.md:311-315,324-330`."
    status: pending
    lastUpdated: 2026-07-16T17:30:58.028Z
    scopeBoundary:
      - não apagar documentação de migração legacy e não editar catálogo gerado sem atualizar a fonte YAML
    acceptance:
      - docs ensinam layout nested, catálogo lista hosts/capabilities reais, network acompanha operações GitHub e geração produz zero diff
    verifier:
      kind: shell
      command: node --test tests/generate-catalog-json.test.js tests/project.test.js && npm run check-docs
      expectExitCode: 0
    outputs:
      - kind: file
        path: docs/concepts/project-tracking.md
      - kind: file
        path: docs/skills/project.md
      - kind: file
        path: meta/catalog.yaml
      - kind: file
        path: meta/catalog.json
      - kind: file
        path: skills/shared/project-assets/project-transitions.md
      - kind: file
        path: tests/generate-catalog-json.test.js
      - kind: file
        path: tests/project.test.js
parked: []
emerged: []
planTitle: Remediação integral de segurança, lifecycle e distribuição
planActive: true
current: true

---
# F5
