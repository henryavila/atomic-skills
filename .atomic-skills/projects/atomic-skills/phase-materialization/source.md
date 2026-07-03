# Materialização lazy de fases e validação de intenção de negócio

O plano implementa a mudança decidida em `design.md`: `new plan` deixa de
materializar todas as fases de uma vez, preserva fases futuras como descritores
sem arquivo de iniciativa, e ativa cada fase futura por um verbo `materialize`
que coleta intenção de negócio antes de gerar tasks.

## Principles

### P1 Lazy forte

Fases futuras permanecem sem arquivo de iniciativa e sem tasks extraídas até a
ativação da fase.

### P2 Intenção de negócio antes de execução

Cada fase ativada carrega `businessIntent` completo nas duas superfícies
versionadas: descritor do plano e iniciativa materializada.

### P3 Compatibilidade aditiva

Planos existentes continuam validando; novos campos entram fora de `required` e
os bloqueios vivem nos fluxos e detectores.

### P4 Verificação determinística

Toda nova regra de avanço tem detector ou teste que roda localmente sem decisão
manual.

### P5 aiDeck agnóstico

O dashboard apenas lê estado emitido; regras de negócio e reparos permanecem no
consumer `atomic-skills`.

## Glossary

| Term | Definition |
| --- | --- |
| Descriptor-only phase | Fase presente em `plan.phases[]` sem arquivo correspondente em `phases/`. |
| Materialized phase | Fase com arquivo de iniciativa em `projects/<project-id>/<plan-slug>/phases/`. |
| businessIntent | Objeto com `value`, `workflow`, `rules`, `outOfScope`, `doneWhen` e `derived[]` opcional. |
| Lazy forte | Estratégia que retém fonte de fase e adia a extração de tasks, não apenas o write do arquivo. |

## F0 — Contrato de estado e detector de intenção de negócio

Goal: Adicionar o contrato aditivo para `businessIntent`, `definitionOfDone[]` e o detector que bloqueia fases ativadas sem intenção completa.

### T-001 Schema aditivo para businessIntent e DoD técnico

Adicionar `businessIntent` opcional em `plan.phases[]` e iniciativas, com os cinco campos canônicos e `derived[]` opcional, além de `definitionOfDone[]` opcional no plano.

- Files: meta/schemas/plan.schema.json, meta/schemas/initiative.schema.json, tests/validate-state.test.js, tests/aideck-state-schema.test.js
- scopeBoundary: não tornar os novos campos obrigatórios no schema e não alterar `schemaVersion`.
- acceptance: schemas aceitam planos legados sem os campos, aceitam planos novos com os campos completos, e rejeitam campos extras dentro de `businessIntent`.
- verifier: { kind: shell, command: "npm test -- tests/validate-state.test.js tests/aideck-state-schema.test.js", expectExitCode: 0 }

### T-002 Detector find-missing-business-intent

Criar detector puro que varre planos e iniciativas, reporta campo ausente, vazio ou `[NEEDS CLARIFICATION]`, e diferencia fase descriptor-only de fase materializada.

- Files: scripts/find-missing-business-intent.js, tests/find-missing-business-intent.test.js, package.json
- scopeBoundary: não modificar arquivos de estado reais em `.atomic-skills/` e não executar verifiers de tasks.
- acceptance: detector retorna exit 0 para legado sem `businessIntent`, exit 1 para fase materializada com campo faltante, e reporta descriptor e initiative quando divergem.
- verifier: { kind: shell, command: "npm test -- tests/find-missing-business-intent.test.js", expectExitCode: 0 }

### T-003 Validação de estado para descriptor-only

Atualizar validação JS para tratar fase sem arquivo de iniciativa como estado válido quando ela está pendente, preservando erro para fase ativa sem iniciativa materializada.

- Files: scripts/validate-state.js, tests/validate-state.test.js, tests/decompose.test.js
- scopeBoundary: não relaxar validação de gates nem permitir `status: done` em exit gate.
- acceptance: `validate-state` aceita descritores pendentes sem arquivo, falha quando `currentPhase` aponta para fase sem iniciativa, e mantém validação de iniciativas existentes.
- verifier: { kind: shell, command: "npm test -- tests/validate-state.test.js tests/decompose.test.js", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: F0-G1
      description: "Schema e validate-state preservam compatibilidade com planos legados e aceitam o novo contrato aditivo."
      verifier: { kind: shell, command: "npm test -- tests/validate-state.test.js tests/aideck-state-schema.test.js", expectExitCode: 0 }
    - id: F0-G2
      description: "O detector de businessIntent diferencia ausente legado, incompleto em fase ativada e divergência entre descriptor e initiative."
      verifier: { kind: shell, command: "npm test -- tests/find-missing-business-intent.test.js", expectExitCode: 0 }
```

## F1 — Lazy materialization no decompositor

Goal: Refatorar `src/decompose.js` para decompor uma fase por vez, persistir fonte por fase e materializar apenas F0 no `new plan`.

### T-001 Extrair decomposição e escrita por fase

Extrair funções reutilizáveis para decompor uma fase isolada e escrever o arquivo de iniciativa, mantendo a gramática markdown atual.

- Files: src/decompose.js, tests/decompose.test.js
- scopeBoundary: não alterar a gramática de source markdown nem remover suporte ao layout flat legado.
- acceptance: testes cobrem `decomposeOnePhase`, `writeInitiativeFile` e equivalência do output para a F0 em fontes existentes.
- verifier: { kind: shell, command: "npm test -- tests/decompose.test.js", expectExitCode: 0 }

### T-002 Materializar apenas F0 e reter fonte das fases futuras

Alterar `materializeDecomposition` para emitir `plan.md`, a iniciativa da F0 e sidecars de fonte para F1..N, deixando descritores futuros com `subPhaseCount: 0`.

- Files: src/decompose.js, tests/decompose.test.js, meta/schemas/plan.schema.json
- scopeBoundary: não pré-extrair tasks de F1..N e não escrever arquivos de iniciativa para fases futuras.
- acceptance: materialização nested gera somente `phases/f0-*.md`, mantém todos os descritores em `plan.phases[]`, e sidecars permitem recompor F1 sem reler o source completo.
- verifier: { kind: shell, command: "npm test -- tests/decompose.test.js", expectExitCode: 0 }

### T-003 Atualizar criação de plano e documentação do fluxo lazy

Atualizar a skill de criação de plano para descrever F0 materializada, fases futuras descriptor-only e source sidecars.

- Files: skills/shared/project-assets/project-create-plan.md, skills/core/project.md, tests/project.test.js
- scopeBoundary: não implementar o verbo `materialize` nesta tarefa e não alterar a política de confirmação da decomposição.
- acceptance: `project.test.js` verifica que a documentação do create-plan menciona descriptor-only, source sidecars e materialização só da F0.
- verifier: { kind: shell, command: "npm test -- tests/project.test.js", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: F1-G1
      description: "A materialização de novo plano escreve apenas a iniciativa da F0 e mantém descritores futuros válidos."
      verifier: { kind: shell, command: "npm test -- tests/decompose.test.js", expectExitCode: 0 }
    - id: F1-G2
      description: "A documentação da criação de plano reflete o contrato lazy forte."
      verifier: { kind: shell, command: "npm test -- tests/project.test.js", expectExitCode: 0 }
```

## F2 — Verbo materialize e transições de fase

Goal: Adicionar `/atomic-skills:project materialize <phase>` e conectar `phase-done`, `switch` e `phase-reopen` ao mesmo caminho de ativação.

### T-001 Router e asset do verbo materialize

Adicionar a gramática do verbo, seu arquivo de procedimento lazy e testes de documentação que garantem o dispatch.

- Files: skills/core/project.md, skills/shared/project-assets/project-materialize.md, tests/project.test.js
- scopeBoundary: não materializar fases automaticamente sem passagem pelo procedimento e não chamar `new initiative` como fallback.
- acceptance: router lista `materialize <phase>`, dispatch carrega `project-materialize.md`, e os testes impedem regressão para `new initiative`.
- verifier: { kind: shell, command: "npm test -- tests/project.test.js", expectExitCode: 0 }

### T-002 Implementar fluxo materialize com gate de negócio

Especificar e implementar o fluxo que lê o source sidecar, aplica lessons, coleta `businessIntent`, decompõe a fase e escreve a iniciativa.

- Files: skills/shared/project-assets/project-materialize.md, src/decompose.js, scripts/find-missing-business-intent.js, tests/decompose.test.js, tests/find-missing-business-intent.test.js
- scopeBoundary: não aceitar aprovação genérica como preenchimento dos campos de negócio e não preencher campos canônicos com texto plausível gerado pela IA.
- acceptance: procedimento exige valores escritos para os cinco campos, grava descriptor e initiative, e o detector passa após a materialização.
- verifier: { kind: shell, command: "npm test -- tests/decompose.test.js tests/find-missing-business-intent.test.js", expectExitCode: 0 }

### T-003 Conectar phase-done, switch e phase-reopen

Atualizar transições para chamar o fluxo `materialize` quando a fase alvo ainda é descriptor-only.

- Files: skills/shared/project-assets/project-transitions.md, tests/project.test.js, tests/transition.test.js
- scopeBoundary: não duplicar a lógica do gate de negócio dentro das transições e não avançar `currentPhase` para fase sem iniciativa.
- acceptance: documentação das três transições aponta para `project-materialize.md`, e testes cobrem ausência da instrução vestigial `new initiative` como caminho de fase seguinte.
- verifier: { kind: shell, command: "npm test -- tests/project.test.js tests/transition.test.js", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: F2-G1
      description: "O router expõe `materialize <phase>` e carrega um procedimento próprio."
      verifier: { kind: shell, command: "npm test -- tests/project.test.js", expectExitCode: 0 }
    - id: F2-G2
      description: "Transições de fase reutilizam `materialize` e não instruem `new initiative` para fase futura."
      verifier: { kind: shell, command: "npm test -- tests/project.test.js tests/transition.test.js", expectExitCode: 0 }
```

## F3 — Backstops de execução e leitores

Goal: Garantir que `implement`, `status`, `verify`, foco e emissão do dashboard entendam fases descriptor-only e bloqueiem execução sem businessIntent.

### T-001 Backstop no implement

Adicionar checagem inicial no `implement` para recusar fase descriptor-only ou fase materializada sem `businessIntent` completo.

- Files: skills/core/implement.md, tests/implement.test.js, scripts/find-missing-business-intent.js
- scopeBoundary: não mudar a regra de microcommits, verify-on-done ou execução serial do `implement`.
- acceptance: teste confirma que `implement.md` instrui a rodar o detector e abortar antes de carregar tasks quando a fase não está materializada.
- verifier: { kind: shell, command: "npm test -- tests/implement.test.js tests/find-missing-business-intent.test.js", expectExitCode: 0 }

### T-002 Leitores de status, verify e foco

Atualizar leitores para reportar fases descriptor-only como pendentes de materialização em vez de quebrar ou parecer fase vazia.

- Files: skills/shared/project-assets/project-view.md, skills/shared/project-assets/project-verify.md, scripts/emit-focus.js, scripts/reconcile-focus.js, tests/project.test.js, tests/focus-digest.test.js, tests/reconcile-focus.test.js
- scopeBoundary: não alterar status de plano ou iniciativa durante views read-only.
- acceptance: status/verify descrevem a fase sem arquivo como descriptor-only, foco não seleciona task inexistente, e verify falha quando fase ativa não tem arquivo.
- verifier: { kind: shell, command: "npm test -- tests/project.test.js tests/focus-digest.test.js tests/reconcile-focus.test.js", expectExitCode: 0 }

### T-003 Emissão aiDeck e rollups

Atualizar emissão de estado para projetar fases descriptor-only sem fabricar iniciativa ou rollup de tasks.

- Files: scripts/emit-consumer-state.js, scripts/compute-rollups.js, tests/emit-consumer-state.test.js, tests/compute-rollups.test.js, meta/schemas/aideck-state.schema.json
- scopeBoundary: não exigir que aiDeck compute regras de negócio e não persistir campos derivados fora dos scripts existentes.
- acceptance: emitted state contém fase descriptor-only com marcador de materialização pendente, não contém iniciativa sintética, e rollups ignoram tasks inexistentes.
- verifier: { kind: shell, command: "npm test -- tests/emit-consumer-state.test.js tests/compute-rollups.test.js tests/aideck-state-schema.test.js", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: F3-G1
      description: "Implementação recusa execução de fase não materializada ou sem businessIntent completo."
      verifier: { kind: shell, command: "npm test -- tests/implement.test.js tests/find-missing-business-intent.test.js", expectExitCode: 0 }
    - id: F3-G2
      description: "Views, verify, foco e aiDeck projetam descriptor-only sem fabricar tasks."
      verifier: { kind: shell, command: "npm test -- tests/project.test.js tests/focus-digest.test.js tests/reconcile-focus.test.js tests/emit-consumer-state.test.js tests/compute-rollups.test.js", expectExitCode: 0 }
```

## F4 — Compatibilidade, documentação e regressão completa

Goal: Fechar a mudança com documentação pública, catálogo atualizado, scripts de runtime empacotados e suíte completa verde.

### T-001 Documentar o ciclo lazy no conceito de project tracking

Atualizar documentação de conceito e skill docs gerados para explicar descriptor-only, materialize e businessIntent.

- Files: docs/concepts/project-tracking.md, docs/skills/project.md, meta/catalog.yaml, meta/catalog.json, README.md
- scopeBoundary: não editar documentação de skills não relacionadas ao project tracking.
- acceptance: docs explicam o ciclo `new plan` -> F0 -> `phase-done` -> `materialize F1`, e catálogo expõe o novo verbo.
- verifier: { kind: shell, command: "npm run generate-docs && npm run check-docs", expectExitCode: 0 }

### T-002 Garantir empacotamento dos novos assets e scripts

Validar que o novo detector, asset `project-materialize.md` e docs entram no pacote npm e no renderer instalado.

- Files: package.json, tests/install.test.js, tests/install-uninstall-roundtrip.test.js, tests/validate-skills.test.js
- scopeBoundary: não reintroduzir mutação de `.gitignore` e não deixar resíduo sem reversão no uninstall.
- acceptance: install inclui o novo asset e script, uninstall volta ao baseline, e validação de skills passa.
- verifier: { kind: shell, command: "npm test -- tests/install.test.js tests/install-uninstall-roundtrip.test.js tests/validate-skills.test.js", expectExitCode: 0 }

### T-003 Regressão final e state validation

Executar a suíte completa, validação de skills e validação do estado versionado após a mudança.

- Files: package.json, scripts/validate-state.js, .atomic-skills/projects/atomic-skills/phase-materialization/plan.md
- scopeBoundary: não fechar o plano sem registrar evidência dos comandos executados.
- acceptance: `npm test`, `npm run validate-skills` e `npm run validate-state` passam no repositório.
- verifier: { kind: shell, command: "npm test && npm run validate-skills && npm run validate-state", expectExitCode: 0 }

```yaml
exit_gate:
  criteria:
    - id: F4-G1
      description: "Documentação e catálogo refletem o novo ciclo de materialização lazy."
      verifier: { kind: shell, command: "npm run check-docs", expectExitCode: 0 }
    - id: F4-G2
      description: "Suíte completa e validações do pacote passam no repositório."
      verifier: { kind: shell, command: "npm test && npm run validate-skills && npm run validate-state", expectExitCode: 0 }
```
