---
schemaVersion: "0.1"
slug: skills-restructuring-f5-nova-skill-design-brief
title: "Nova skill: design-brief"
goal: criar a skill design-brief que gera prompts DS-first e telas-consomem-DS,
  nascida enxuta, ancorada no modelo de 3 camadas + R1–R9 do briefing vendorizado
  (silêncio só no visual; interação e filosofia especificadas com valores concretos).
status: pending
branch: null
started: 2026-06-15T13:37:12.477Z
lastUpdated: 2026-06-15T14:21:04.364Z
nextAction: "Start T5.1: Corpo da skill design-brief"
parentPlan: skills-restructuring
phaseId: F5
tasksDone: 0
tasksTotal: 5
gatesMet: 0
gatesTotal: 1
exitGates:
  - id: F5-G1
    description: A skill design-brief e seus assets existem e a validação passa.
    status: pending
    verifier:
      kind: shell
      command: test -f skills/core/design-brief.md && test -f
        skills/shared/design-brief-assets/ds-prompt.md && test -f
        skills/shared/design-brief-assets/screens-prompt.md && test -f
        skills/shared/design-brief-assets/fixtures-recipe.md && test -f
        skills/shared/design-brief-assets/anti-contamination.md && grep -q
        'design-brief-assets' skills/core/design-brief.md && grep -qiE 'modelo de
        intera|filosofia|guardrail'
        skills/shared/design-brief-assets/screens-prompt.md && grep -qiE 'tr[eê]s
        camadas|3 camadas|substituir'
        skills/shared/design-brief-assets/anti-contamination.md && npm run
        validate-skills
      expectExitCode: 0
    verifierLabel: "shell: test -f skills/core/design-brief.md && test -f skills/share…"
stack:
  - id: 1
    title: "Nova skill: design-brief"
    type: task
    openedAt: 2026-06-15T13:37:12.477Z
tasks:
  - id: T5.1
    title: Corpo da skill design-brief
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Corpo enxuto da skill design-brief
    description: "Criar o corpo fino da skill com a Iron Law anti-contaminação (modelo
      de 3 camadas: silêncio só no visual; interação + filosofia especificadas), o fluxo
      DS-first, auto-detecção de fonte + mineração dos parâmetros comportamentais do
      código (R2: timers/contagens/comprimentos/modalidade/gatilhos/o-que-fica-oculto) e a
      auditoria de omissão interativa por tela (R3), a fixação do idioma de saída (pt-BR ou
      a língua configurada) e ponteiros para os assets lazy. Arquivos:
      skills/core/design-brief.md"
    scopeBoundary:
      - não embutir os esqueletos de prompt nem a recipe de fixtures no corpo;
        eles vivem em assets.
    acceptance:
      - o corpo existe e cita anti-contaminação (3 camadas), DS-first, consumo do DS
        herdado e a auditoria de omissão.
      - o corpo enumera a lista de mineração R2 (timers/contagens/comprimentos/
        modalidade/gatilhos/o-que-fica-oculto) e a pergunta da auditoria R3.
      - o corpo fixa o idioma de saída do prompt gerado: pt-BR ou a língua configurada.
    verifier:
      kind: shell
      command: test -f skills/core/design-brief.md && grep -qiE
        'anti-contamin|DS-first|herdado' skills/core/design-brief.md && grep -qiE
        'omiss|tr[eê]s camadas|3 camadas' skills/core/design-brief.md && grep -qiE
        'modalidade|gatilho' skills/core/design-brief.md && grep -qiE 'pt-BR|l[ií]ngua'
        skills/core/design-brief.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/core/design-brief.md
  - id: T5.2
    title: Asset do prompt de Design System
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Asset do prompt de DS (token contract + 1 template base)
    description: "Criar o esqueleto do prompt de DS com token contract semântico,
      inventário de componentes com estados, 1 template base que exercita o DS,
      e constraints WCAG 2.2. Arquivos:
      skills/shared/design-brief-assets/ds-prompt.md"
    scopeBoundary:
      - pedir exatamente 1 template (não um set); templates por papel, sem
        hardcodar componentes de projeto.
    acceptance:
      - o asset existe e cita 1 template e token contract semântico.
    verifier:
      kind: shell
      command: test -f skills/shared/design-brief-assets/ds-prompt.md && grep -qiE '1
        template|um template' skills/shared/design-brief-assets/ds-prompt.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/design-brief-assets/ds-prompt.md
  - id: T5.3
    title: Asset do prompt de telas
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Asset do prompt de telas (consome DS herdado + estados)
    description: "Criar o esqueleto do prompt de telas com (a) preâmbulo R9 (não
      prescrevemos forma visual; prescrevemos comportamento + filosofia, vinculantes;
      consumo do DS herdado), (b) por tela com interação, blocos OBRIGATÓRIOS 'Modelo
      de interação' (atributos de comportamento da R4 com os valores concretos minerados
      da R2: tempos/contagens/comprimentos/modalidade/gatilhos/paridade) e
      'Filosofia/guardrails' (eixo humano × sistema da R5, o que fica oculto, anti-padrão
      proibido nomeado da R6), (c) a auditoria de omissão R3, (d) o template de tela com
      as 8 seções obrigatórias da §4 (para-que-serve · informação-visível · o-que-a-pessoa
      -faz · Modelo de interação · Filosofia/guardrails · fluxo · estados · restrições) e o
      checklist de estados (vazio/carregando/erro/offline/primeira-vez/populado),
      mobile+desktop e claro+escuro, (e) instrução de forkar do template base, e (f) a
      regra de PARAR e sinalizar se a tela precisar de algo fora do DS. Arquivos:
      skills/shared/design-brief-assets/screens-prompt.md"
    scopeBoundary:
      - o prompt de telas não redeclara tokens; consome o DS por nome.
      - descreve interação por atributo de comportamento, nunca nomeando widget/cor/forma
        (R4); ao des-induzir um rótulo, substitui pela essência, não deleta (R7).
      - se a tela precisa de algo que o DS não tem, o prompt manda parar e sinalizar,
        nunca improvisar.
    acceptance:
      - o asset existe e cita consumo do DS herdado, checklist de estados e os blocos
        obrigatórios Modelo de interação + Filosofia/guardrails.
      - o template cobre as 8 seções da §4 (inclui fluxo e restrições) e a regra
        parar-e-sinalizar quando o DS não tiver algo.
    verifier:
      kind: shell
      command: test -f skills/shared/design-brief-assets/screens-prompt.md && grep
        -qiE 'herdado|consom|estados'
        skills/shared/design-brief-assets/screens-prompt.md && grep -qiE 'modelo de
        intera' skills/shared/design-brief-assets/screens-prompt.md && grep -qiE
        'filosofia|guardrail' skills/shared/design-brief-assets/screens-prompt.md && grep
        -qiE 'fluxo' skills/shared/design-brief-assets/screens-prompt.md && grep -qiE
        'sinaliz' skills/shared/design-brief-assets/screens-prompt.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/design-brief-assets/screens-prompt.md
  - id: T5.4
    title: Assets de fixtures e anti-contaminação
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: Assets de fixtures state-aware e anti-contaminação
    description: "Criar (a) a recipe de fixtures state-aware (cardinalidade,
      comprimento, distribuição, edge-rows) que carrega a TEXTURA — a brevidade do
      conteúdo no momento da decisão é parte do dado (R8); e (b) o asset
      anti-contamination com o modelo de 3 camadas (silêncio só no visual; interação +
      filosofia especificadas), a tabela DEFINE/DECIDE, a regra substituir-nunca-deletar
      (R7), a auditoria de omissão (R3) e o checklist de aceitação por tela (§6 — a
      auto-verificação de pré-envio: blocos obrigatórios presentes, anti-padrão nomeado,
      sem widget, fixtures com textura, mobile/desktop + claro/escuro + todos os estados,
      DS consumido por nome). Arquivos:
      skills/shared/design-brief-assets/fixtures-recipe.md,
      skills/shared/design-brief-assets/anti-contamination.md"
    scopeBoundary:
      - fixtures sintéticos sem PII; o checklist converte requisito visual em
        constraint, nunca em solução.
      - codificar 3 camadas + R1–R9 de forma agnóstica; Lekto/FSRS só como exemplo-ouro.
    acceptance:
      - ambos os assets existem
      - a recipe cita cardinalidade e edge-rows
      - o anti-contamination cita as 3 camadas e a regra substituir-nunca-deletar
      - o anti-contamination inclui o checklist de aceitação por tela (auto-verificação §6).
    verifier:
      kind: shell
      command: test -f skills/shared/design-brief-assets/fixtures-recipe.md && test -f
        skills/shared/design-brief-assets/anti-contamination.md && grep -qiE
        'cardinalidade|edge'
        skills/shared/design-brief-assets/fixtures-recipe.md && grep -qiE 'tr[eê]s
        camadas|3 camadas|substituir'
        skills/shared/design-brief-assets/anti-contamination.md && grep -qiE
        'aceita|checklist'
        skills/shared/design-brief-assets/anti-contamination.md
      expectExitCode: 0
    outputs:
      - kind: file
        path: skills/shared/design-brief-assets/fixtures-recipe.md
      - kind: file
        path: skills/shared/design-brief-assets/anti-contamination.md
  - id: T5.5
    title: Registrar e validar a skill no catálogo
    status: pending
    lastUpdated: 2026-06-15T13:53:44.618Z
    summary: design-brief registrada no catálogo e validada
    description: "Registrar design-brief no meta/catalog.yaml e garantir que a
      validação de skills passa com a skill nova e seus assets. Arquivos:
      meta/catalog.yaml"
    scopeBoundary:
      - não alterar outras entradas do catálogo; só adicionar design-brief.
    acceptance:
      - o catálogo cita design-brief
      - a suite de validação de skills passa.
    verifier:
      kind: shell
      command: grep -q 'design-brief' meta/catalog.yaml && npm run validate-skills
      expectExitCode: 0
    outputs:
      - kind: file
        path: meta/catalog.yaml
parked: []
emerged: []
summary: "Skill design-brief: gera prompts DS-first + telas-consomem-DS, sem
  contaminar o visual."
planTitle: Reestruturação das skills atomic-skills
planActive: true
---

# Narrative / notes

Initiative for phase **F5 — Nova skill: design-brief**.

## Decisions

- **2026-06-15 — D5 reformulado (post-mortem Lekto).** A anti-contaminação deixa de ser só
  "vocabulário-banido + silêncio" e passa a ser o **modelo de 3 camadas + R1–R9** do briefing
  vendorizado `docs/design/design-brief-three-layer-briefing.md`: silêncio vale **só** para a
  forma visual (camada 1); **modelo de interação** (camada 2) e **filosofia / quem-decide**
  (camada 3) são blocos OBRIGATÓRIOS por tela, com valores concretos minerados do código (R2)
  + auditoria de omissão interativa (R3), vocabulário de comportamento e não de widget (R4),
  eixo humano × sistema (R5), anti-padrão proibido nomeado (R6) e substituir-nunca-deletar (R7).
  Decidido com o operador (4 respostas): entrega = atualizar o plano e parar; D5 reformulado;
  parâmetros via auto-extração + auditoria interativa; skill agnóstica (Lekto = só exemplo-ouro).
- **Impacto nas tasks:** T5.1 (corpo cita 3 camadas + auditoria de omissão), T5.3
  (screens-prompt ganha os dois blocos obrigatórios + R3/R4/R5/R6), T5.4 (anti-contamination =
  3 camadas + DEFINE/DECIDE + R7; fixtures carregam a textura/R8). Verifiers reforçados para
  grepar os blocos novos (Modelo de interação / Filosofia / 3 camadas / substituir).

## Links

- Spec canônica (vendorizada no repo): `docs/design/design-brief-three-layer-briefing.md`
- Proveniência (origem externa): `~/lekto/docs/design/2026-06-15-instrucoes-skill-gerador-de-prompt-de-telas.md`
- Formato-alvo de saída: `docs/design/claude-design-handoff/`
