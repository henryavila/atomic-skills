---
verdict: needs_changes
counts: {blocker: 0, critical: 0, major: 5, minor: 0, nit: 0}
reviewer: gpt-5-codex
pass: blind
schema_version: "1.0"
---

## Summary
O plano tem riscos materiais de execução: mistura contratos de fonte única, declara fontes externas sem registrá-las na estrutura que as ferramentas usam, e define gates que podem passar sem provar os comportamentos prometidos. Os maiores problemas são verificabilidade insuficiente e inconsistência entre objetivos declarados e comandos de saída.

## Findings

### F-001 [major] Contradiction — .atomic-skills/projects/atomic-skills/skills-restructuring/plan.md:38-91

**Evidence:**
```yaml
  - term: verifier-exec
    definition: os padrões canônicos de execução de verifier, fonte única em
      project-transitions.md.
  - term: DS
    definition: design system (tokens + componentes + 1 template base).
phases:
  - id: F0
    slug: skills-restructuring-f0-pente-fino-de-consistencia
    title: Pente fino de consistência
    goal: corrigir resíduo e drift documental de baixo risco nas skills, sem mudar
      comportamento.
    dependsOn: []
    subPhaseCount: 7
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F0-G1
          description: Suite de validação de skills passa após as correções de pente fino.
          status: pending
          verifier:
            kind: shell
            command: npm run validate-skills
            expectExitCode: 0
    status: active
    summary: "Quick-wins de consistência: contagem de stages, caminhos mortos,
      cheat-sheets e gates."
  - id: F1
    slug: skills-restructuring-f1-economia-de-tokens-project-e-implement
    title: "Economia de tokens: project e implement"
    goal: restaurar o router fino e o driver enxuto movendo conteúdo não-ambiente
      para detail/asset lazy, sem perder comportamento.
    dependsOn:
      - F0
    subPhaseCount: 4
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F1-G1
          description: project.md e implement.md encolhem e a suite de validação continua
            verde.
          status: pending
          verifier:
            kind: shell
            command: test $(wc -c < skills/core/project.md) -lt 22000 && test $(wc -c <
              skills/core/implement.md) -lt 22000 && npm run validate-skills
            expectExitCode: 0
    status: pending
    summary: Enxuga o router project e o driver implement movendo conteúdo
      não-ambiente para lazy.
  - id: F2
    slug: skills-restructuring-f2-economia-de-tokens-padroes-transversais
    title: "Economia de tokens: padrões transversais"
    goal: aplicar uma receita por padrão repetido em N skills de uma vez. Depende de
      F1 (verifier-exec.md nasce em T1.4).
```

**Claim:** O contrato `verifier-exec` tem duas fontes únicas declaradas, porque o glossário aponta para `project-transitions.md` enquanto F2 depende de `verifier-exec.md`.

**Impact:** Implementadores podem deixar parte do contrato em `project-transitions.md` e outra parte em `verifier-exec.md`, quebrando P1 e produzindo callers que referenciam documentos diferentes para o mesmo gate.

**Recommendation:** Corrigir o glossário para declarar `skills/shared/project-assets/verifier-exec.md` como fonte única após T1.4 e explicitar que `project-transitions.md` deve apenas apontar para esse asset.

**Confidence:** high

---

### F-002 [major] Coverage Gap — .atomic-skills/projects/atomic-skills/skills-restructuring/plan.md:171-180

**Evidence:**
```yaml
references: []
planActive: true
planTitle: Reestruturação das skills atomic-skills
---

# Reestruturação das skills atomic-skills

## 1. Context

Consolida pente fino de consistência, economia de tokens da arquitetura, a feature `project review` e a skill nova `design-brief`. Fontes: `docs/audits/project-implement-audit-2026-06-15.md` e `docs/audits/token-economy-all-skills-2026-06-15.md`. Execução prevista via codex (Mode 2) com review Opus.
```

**Claim:** As fontes normativas são citadas apenas em prosa enquanto `references` fica vazio, então a cobertura contra os audits não é rastreável pelo plano.

**Impact:** Revisões e automações que dependem de `references` podem rodar como revisão interna e deixar requisitos dos audits fora do escopo verificável, especialmente antes de F4.2 existir.

**Recommendation:** Preencher `references` com os dois arquivos de audit e adicionar uma tarefa ou gate que valide cobertura dos achados desses documentos contra F0-F5.

**Confidence:** high

---

### F-003 [major] Test Coverage — .atomic-skills/projects/atomic-skills/skills-restructuring/plan.md:64-83

**Evidence:**
```yaml
  - id: F1
    slug: skills-restructuring-f1-economia-de-tokens-project-e-implement
    title: "Economia de tokens: project e implement"
    goal: restaurar o router fino e o driver enxuto movendo conteúdo não-ambiente
      para detail/asset lazy, sem perder comportamento.
    dependsOn:
      - F0
    subPhaseCount: 4
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F1-G1
          description: project.md e implement.md encolhem e a suite de validação continua
            verde.
          status: pending
          verifier:
            kind: shell
            command: test $(wc -c < skills/core/project.md) -lt 22000 && test $(wc -c <
              skills/core/implement.md) -lt 22000 && npm run validate-skills
            expectExitCode: 0
```

**Claim:** F1 promete preservar comportamento, mas o gate só prova tamanho de arquivo e validação estrutural, sem executar nenhum fluxo funcional de `project` ou `implement`.

**Impact:** A fase pode passar mesmo se um bloco lazy for movido para o caminho errado, se um ponteiro quebrar em runtime, ou se comandos antes resident deixarem de carregar quando invocados.

**Recommendation:** Adicionar ao gate de F1 pelo menos um verifier funcional para um fluxo `project` e um fluxo `implement` que atravessem os novos ponteiros lazy, além do limite de bytes.

**Confidence:** high

---

### F-004 [major] Test Coverage — .atomic-skills/projects/atomic-skills/skills-restructuring/plan.md:129-147

**Evidence:**
```yaml
  - id: F4
    slug: skills-restructuring-f4-feature-project-review
    title: "Feature: project review"
    goal: dar ao project um subcomando de auditoria de plano/iniciativa
      materializados, compondo linters, verify, review-plan e review-code.
    dependsOn:
      - F3
    subPhaseCount: 3
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F4-G1
          description: O subcomando existe e a suite de validação passa.
          status: pending
          verifier:
            kind: shell
            command: test -f skills/shared/project-assets/project-review.md && npm run
              validate-skills
            expectExitCode: 0
```

**Claim:** O gate de F4 não prova que o subcomando está registrado, dispatchável, nem que compõe `linters`, `verify`, `review-plan` e `review-code`.

**Impact:** F4 pode concluir com apenas um asset morto no disco, deixando o usuário sem comando funcional apesar do objetivo da fase estar marcado como entregue.

**Recommendation:** Trocar o gate por um verifier que confira grammar/dispatch em `skills/core/project.md` e valide no asset `project-review.md` as chamadas ou ponteiros obrigatórios para linters, verify, review-plan e review-code.

**Confidence:** high

---

### F-005 [major] Test Coverage — .atomic-skills/projects/atomic-skills/skills-restructuring/plan.md:150-167

**Evidence:**
```yaml
  - id: F5
    slug: skills-restructuring-f5-nova-skill-design-brief
    title: "Nova skill: design-brief"
    goal: criar a skill design-brief que gera prompts DS-first e telas-consomem-DS,
      nascida enxuta, com os quatro aprendizados do dogfooding.
    dependsOn:
      - F4
    subPhaseCount: 5
    exitGate:
      summary: 1 criterion to meet
      criteria:
        - id: F5-G1
          description: A skill design-brief e seus assets existem e a validação passa.
          status: pending
          verifier:
            kind: shell
            command: test -f skills/core/design-brief.md && npm run validate-skills
            expectExitCode: 0
```

**Claim:** O gate de F5 declara que os assets existem, mas o comando só verifica o corpo da skill e a validação geral.

**Impact:** A fase pode passar sem `ds-prompt.md`, `screens-prompt.md`, fixtures ou checklist anti-contaminação, resultando numa skill registrada mas sem os materiais lazy necessários para executar o fluxo.

**Recommendation:** Expandir F5-G1 para testar a existência dos assets de DS, telas, fixtures e anti-contaminação, e verificar que `skills/core/design-brief.md` aponta para eles.

**Confidence:** high

## Questions (non-findings)

- .atomic-skills/projects/atomic-skills/skills-restructuring/plan.md:180 — Os dois arquivos em `docs/audits/` são requisitos normativos de cobertura ou apenas histórico de origem?

## Out of scope

- Otimização das skills `prompt` e `save-and-push`.
- Recolapsar conteúdo lazy para dentro dos corpos das skills.
- Substituir GATE-R2 determinístico por avaliação via LLM.
- Estética ou decisões visuais da futura `design-brief`.