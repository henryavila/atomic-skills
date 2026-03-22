# Mapa de Técnicas — Índice Rápido

> Índice para localizar rapidamente técnicas por necessidade.
> Cada entrada aponta para a análise completa (`analise-superpowers-v5.0.5.md`) e template (`templates-reutilizaveis.md`).

---

## Por Necessidade

### "Preciso que o agente NUNCA pule esta regra"
| Técnica | ID | Template | Origem |
|---------|----|----------|--------|
| Iron Law | T01 | TPL-02 | TDD, debugging, verification |
| HARD-GATE | T02 | TPL-03 | brainstorming |
| Princípio Letra=Espírito | T05 | TPL-12 | TDD, verification, writing-skills |
| Tabela de Racionalização | T03 | TPL-04 | TDD, debugging, verification |
| Red Flags | T04 | TPL-05 | TDD, debugging, verification, using-superpowers |
| Persuasion Principles | T17 | — | writing-skills/persuasion-principles |

### "Preciso orquestrar subagentes"
| Técnica | ID | Template | Origem |
|---------|----|----------|--------|
| Prompt de Implementer | T07 | TPL-06 | subagent-driven-dev/implementer-prompt |
| Prompt de Reviewer Adversarial | T07 | TPL-07 | subagent-driven-dev/spec-reviewer-prompt |
| Prompt de Code Quality | T07 | TPL-08 | requesting-code-review/code-reviewer |
| Two-Stage Review | T10 | — | subagent-driven-development |
| Review Loop com Teto | T11 | TPL-16 | brainstorming, writing-plans, subagent-driven-dev |
| Seleção de Modelo | T12 | TPL-17 | subagent-driven-development |
| SUBAGENT-STOP | T22 | TPL-15 | using-superpowers |

### "Preciso criar uma skill bem escrita"
| Técnica | ID | Template | Origem |
|---------|----|----------|--------|
| Estrutura SKILL.md | — | TPL-01 | writing-skills |
| CSO (Claude Search Optimization) | T08 | — | writing-skills |
| Progressive Disclosure | T19 | — | anthropic-best-practices |
| Graus de Liberdade | T20 | — | anthropic-best-practices |
| Flowcharts Graphviz | T06 | TPL-11 | writing-skills |
| TDD para Documentação | T13 | TPL-10 | writing-skills, testing-skills-with-subagents |
| Commitment via Anúncio | T09 | TPL-14 | executing-plans, brainstorming |

### "Preciso debugar um problema"
| Técnica | ID | Template | Origem |
|---------|----|----------|--------|
| 4 Fases do Debugging | — | — | systematic-debugging |
| Root Cause Tracing | T15 | — | systematic-debugging/root-cause-tracing |
| Defense-in-Depth | T14 | — | systematic-debugging/defense-in-depth |
| Condition-Based Waiting | T16 | — | systematic-debugging/condition-based-waiting |

### "Preciso interagir com humano ou reviewer"
| Técnica | ID | Template | Origem |
|---------|----|----------|--------|
| Structured Options | T21 | TPL-09 | finishing-a-development-branch |
| Anti-sycophancy | — | — | receiving-code-review |
| YAGNI Check | — | — | receiving-code-review |
| Visual Companion | T23 | — | brainstorming/visual-companion |

### "Preciso garantir qualidade de testes"
| Técnica | ID | Template | Origem |
|---------|----|----------|--------|
| TDD Red-Green-Refactor | — | — | test-driven-development |
| Gate Functions (anti-padrões) | T18 | TPL-13 | testing-anti-patterns |
| Anti-padrões de mock | T18 | — | testing-anti-patterns |

---

## Por Arquivo-Fonte (Rastreabilidade)

Para facilitar análise em atualizações futuras do superpowers.

| Arquivo | Técnicas |
|---------|----------|
| `brainstorming/SKILL.md` | T02, T09, T11, T23 |
| `brainstorming/spec-document-reviewer-prompt.md` | T07 |
| `brainstorming/visual-companion.md` | T23 |
| `dispatching-parallel-agents/SKILL.md` | T07 |
| `executing-plans/SKILL.md` | T09 |
| `finishing-a-development-branch/SKILL.md` | T21 |
| `receiving-code-review/SKILL.md` | T18 (anti-sycophancy) |
| `requesting-code-review/SKILL.md` | T07, T10 |
| `requesting-code-review/code-reviewer.md` | T07 |
| `subagent-driven-development/SKILL.md` | T06, T07, T10, T11, T12, T22 |
| `subagent-driven-development/implementer-prompt.md` | T07 |
| `subagent-driven-development/spec-reviewer-prompt.md` | T07 |
| `subagent-driven-development/code-quality-reviewer-prompt.md` | T07 |
| `systematic-debugging/SKILL.md` | T01, T03, T04 |
| `systematic-debugging/root-cause-tracing.md` | T15 |
| `systematic-debugging/defense-in-depth.md` | T14 |
| `systematic-debugging/condition-based-waiting.md` | T16 |
| `test-driven-development/SKILL.md` | T01, T03, T04, T05, T06 |
| `test-driven-development/testing-anti-patterns.md` | T18 |
| `using-git-worktrees/SKILL.md` | T09 |
| `using-superpowers/SKILL.md` | T04, T09, T22 |
| `verification-before-completion/SKILL.md` | T01, T03, T04, T05 |
| `writing-plans/SKILL.md` | T09, T11 |
| `writing-plans/plan-document-reviewer-prompt.md` | T07 |
| `writing-skills/SKILL.md` | T05, T06, T08, T13, T19 |
| `writing-skills/anthropic-best-practices.md` | T19, T20 |
| `writing-skills/persuasion-principles.md` | T17 |
| `writing-skills/testing-skills-with-subagents.md` | T03, T13 |

---

## Mapeamento: Técnicas vs Commands `hca-` Existentes

| Command | Técnicas aplicadas (v2) |
|---------|------------------------|
| `hca-save-and-push` | T01 (Iron Law), T02 (HARD-GATE main/master), T04 (Red Flags), T20 (Graus de Liberdade — critérios de agrupamento), feedback-prompts (ferramentas nomeadas, detecção de sensíveis) |
| `hca-review-plan-internal` | T01 (Iron Law), T03 (Tabela racionalização), T04 (Red Flags), T07 (Adversarial mindset), T11 (Loop max 3), Severidade→Ação, feedback-prompts (Read nomeado, contagem, line numbers) |
| `hca-review-plan-vs-artifacts` | T01 (Iron Law), T02 (HARD-GATE artefatos), T03 (Tabela racionalização), T04 (Red Flags), T07 (Adversarial mindset), T11 (Loop max 3), Severidade→Ação, feedback-prompts (Read nomeado, contagem, cross-reference) |
| `hca-init-memory` | T01 (Iron Law), T02 (HARD-GATE deleção), T04 (Red Flags), T09 (Commitment), T21 (Structured Options A/B/C), feedback-prompts (ferramentas nomeadas na validação) |
| `hca-resume` | T01 (Iron Law), T03 (Racionalização), T04 (Red Flags), T21 (Structured Options), feedback-prompts |
| `hca-refactor-prompt` | T01 (Iron Law), T03 (Racionalização), T04 (Red Flags), T11 (Loop com Teto — max 2), T21 (Structured Options), feedback-prompts |
| `hca-fix` | T01 (Iron Law), T02 (HARD-GATE), T03 (Racionalização), T04 (Red Flags), T15 (Root Cause Tracing), Mindset (investigativo), feedback-prompts |

### Técnicas do feedback-prompts.md já alinhadas com superpowers

| Feedback existente | Técnica superpowers equivalente |
|---|---|
| "Loops explícitos com critério de parada" | T11 (Review Loop com Teto) |
| "Nomear ferramenta e exigir prova" | T01 (Iron Law) + verificação com evidência de `verification-before-completion` |
| "Instruções vagas são ignoradas" | T20 (Graus de Liberdade — usar baixa liberdade para operações críticas) |
