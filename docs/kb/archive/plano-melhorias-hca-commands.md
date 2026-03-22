# Plano de Melhorias — hca- Commands

> Análise dos 4 commands existentes à luz das 23 técnicas catalogadas do superpowers v5.0.5
> e dos feedbacks já acumulados em `.ai/memory/feedback-prompts.md`.

**Data:** 2026-03-21

---

## Sumário Executivo

Os commands atuais funcionam, mas operam num nível de maturidade significativamente
abaixo do que as técnicas do superpowers permitem. Os dois reviews (`internal` e
`vs-artifacts`) já incorporaram lições do feedback-prompts (nomear ferramenta, exigir
line numbers, loop explícito), mas nenhum command usa Iron Laws, Red Flags, tabelas
de racionalização, prompts adversariais estruturados, ou gates de verificação.

**Impacto estimado das melhorias:**
- Reviews: de "encontra problemas" para "encontra problemas E resiste à tentação de pular"
- Save-and-push: de "commit e push" para "verificação rigorosa antes de push"
- Init-memory: de "funcional" para "à prova de erro"

---

## 1. Análise por Command

### 1.1 hca-save-and-push

**Linhas:** 22 | **Tipo funcional:** Operacional
**Estado atual:** Lista de 5 passos simples, sem disciplina nem gates.

#### Diagnóstico

| Aspecto | Estado | Problema |
|---------|--------|----------|
| Verificação pré-push | Vaga ("verifique que git status está limpo") | Feedback-prompts: verbos abstratos = operações mentais. Não garante `git status` real |
| Gate destrutivo | Ausente | Push é irreversível em muitos workflows; sem confirmação |
| Commits lógicos | Vago ("agrupe em commits lógicos") | Alta liberdade (T20) onde deveria ser média — sem critério concreto |
| Segredos/sensíveis | Não mencionado | Risco real: `.env`, credentials, tokens |
| Aprendizados vs efêmero | Critério genérico | "NÃO salve: contexto efêmero" — mas sem exemplos concretos |
| Branch safety | Ausente | Pode fazer push para main sem querer |

#### Técnicas aplicáveis

| Técnica | Como aplicar | Prioridade |
|---------|-------------|------------|
| T01 Iron Law | `NO PUSH WITHOUT VERIFICATION EVIDENCE` — rodar git status/diff antes | Alta |
| T02 HARD-GATE | Gate antes de push para main/master | Alta |
| T04 Red Flags | "Estou fazendo push sem ter rodado os testes" | Média |
| T20 Graus de Liberdade | Reduzir liberdade nos commits: critérios concretos de agrupamento | Média |
| T21 Structured Options | Quando houver decisão ambígua (push direto vs PR) | Baixa |
| Feedback-prompts | Nomear `git status`, `git diff` explicitamente como ferramentas a executar | Alta |

---

### 1.2 hca-review-plan-internal

**Linhas:** 35 | **Tipo funcional:** Disciplinadora (review)
**Estado atual:** Já incorpora feedback-prompts (Read explícito, line numbers, loop com critério de parada).
É o command mais maduro.

#### Diagnóstico

| Aspecto | Estado | Problema |
|---------|--------|----------|
| Mindset adversarial | Mencionado no título ("análise adversária") mas não reforçado | Falta o framing de desconfiança do spec-reviewer (T07): "Do not trust. Verify independently" |
| Teto de iterações | Ausente ("repita até convergir") | Pode loopar infinitamente em plano problemático; superpowers usa max 3 (T11) |
| Racionalização | Ausente | Agente pode pular checklist items dizendo "parece ok" sem verificar |
| Severidade → ação | Classifica (crítico/significativo/menor) mas não diz o que fazer com cada | Code-reviewer do superpowers: Critical = must fix, Important = should fix, Minor = nice to have |
| Formato do report | Livre | Sem template estruturado — dificulta comparação entre execuções |
| Prova de execução | Parcial (line numbers) | Não exige contagem total de chamadas Read no final |

#### Técnicas aplicáveis

| Técnica | Como aplicar | Prioridade |
|---------|-------------|------------|
| T07 Adversarial mindset | Adicionar seção "CRITICAL: Do Not Trust the Plan" — ler como se o autor estivesse errado | Alta |
| T11 Review Loop com Teto | Max 3 iterações, depois escalar para humano | Alta |
| T03 Tabela de Racionalização | "Parece consistente" → "Prove com line numbers" | Média |
| T04 Red Flags | "Estou pulando um item do checklist" / "Parece óbvio que está certo" | Média |
| T01 Iron Law | `NO APPROVAL WITHOUT EVIDENCE FOR EACH CHECKLIST ITEM` | Média |
| Feedback-prompts (contagem) | Exigir total de chamadas Read no encerramento | Alta |

---

### 1.3 hca-review-plan-vs-artifacts

**Linhas:** 39 | **Tipo funcional:** Disciplinadora (review cruzado)
**Estado atual:** Quase idêntico ao internal, com checklist diferente. Mesma estrutura de loop.

#### Diagnóstico

| Aspecto | Estado | Problema |
|---------|--------|----------|
| Duplicação com internal | ~60% do processo é idêntico | Manutenção duplicada; correções num não propagam para o outro |
| Leitura de artefatos | Implícita ("leia o plano e identifique os artefatos") | Não nomeia ferramenta Read para cada artefato; não exige lista explícita |
| Rastreabilidade | "Documente divergências nos alignment notes" | Não define formato nem onde salvar |
| Mesmos gaps do internal | Sem teto, sem adversarial, sem racionalização | Herda todos os problemas |
| HARD-GATE para artefatos | Ausente | "Corrija o PLANO (não os artefatos)" é importante mas fácil de violar |

#### Técnicas aplicáveis

Todas do internal (1.2), mais:

| Técnica | Como aplicar | Prioridade |
|---------|-------------|------------|
| T02 HARD-GATE | `<HARD-GATE>` para "NUNCA altere artefatos de origem" | Alta |
| T19 Progressive Disclosure | Extrair processo de loop compartilhado para referência comum | Média |
| Feedback-prompts | Exigir lista explícita de artefatos encontrados com paths antes de iniciar review | Alta |

---

### 1.4 hca-init-memory

**Linhas:** 87 | **Tipo funcional:** Operacional (setup/migração)
**Estado atual:** O mais completo em estrutura. Tem confirmation gate, validação final com checklist.

#### Diagnóstico

| Aspecto | Estado | Problema |
|---------|--------|----------|
| Confirmação antes de destruir | Presente (passo 2) | Mas não tem HARD-GATE formal nem confirmação tipada para remoção |
| Validação final | Checklist com `- [ ]` | Não exige execução real (feedback-prompts: "verifique" ≠ executar ls/cat) |
| Operações destrutivas | Passo 3: "remova os diretórios originais" | Sem reversibilidade; deveria backup ou confirmar item a item |
| Edge cases | BMAD mencionado | Mas e se houver outros padrões não-previstos? Sem fallback |
| Anúncio | Ausente | Poderia usar commitment (T09) para explicitar o que vai fazer |
| Structured options | Passo 2 mostra achados mas formato é exemplo fixo | Poderia ser menu estruturado (T21) |

#### Técnicas aplicáveis

| Técnica | Como aplicar | Prioridade |
|---------|-------------|------------|
| T02 HARD-GATE | Antes de remover diretórios: confirmar com path completo | Alta |
| T09 Commitment | Anúncio no início: "Vou padronizar a memória para .ai/memory/" | Baixa |
| T21 Structured Options | Menu para passo 2 (migrar tudo / selecionar / cancelar) | Média |
| Feedback-prompts | Validação final: nomear `ls`, `cat`, `readlink` explicitamente | Alta |
| T01 Iron Law | `NO DELETION OF ORIGINAL DIRECTORIES WITHOUT CONFIRMED BACKUP` | Média |

---

## 2. Problemas Transversais

### 2.1 Ausência de estrutura consistente

Nenhum command segue um padrão estrutural. Cada um tem formato diferente.

**Proposta:** Adotar padrão inspirado no SKILL.md canônico (TPL-01), adaptado para commands:

```markdown
[Descrição de 1 linha do que o command faz]

## Regra Fundamental
[Iron Law se disciplinador, ou princípio norteador se operacional]

## Processo
[Steps numerados com ferramentas nomeadas]

## Red Flags
[Lista de pensamentos que significam STOP]

## Encerramento
[Report format exigido]
```

### 2.2 Duplicação review-internal / review-vs-artifacts

60% do processo é idêntico (loop de Read + correção + convergência + encerramento).

**Proposta:** Duas opções:
1. **Extrair processo de loop para referência comum** — um arquivo `_review-loop-process.md` que ambos referenciam
2. **Manter inline mas com template** — garantir que mudanças são aplicadas nos dois

### 2.3 Nenhum command usa racionalização ou red flags

Os commands confiam que o agente vai seguir as instruções. O superpowers mostrou que isso é insuficiente sob pressão.

**Proposta:** Adicionar pelo menos Red Flags nos 2 reviews e no save-and-push.

### 2.4 Feedback-prompts parcialmente aplicado

As lições de feedback-prompts (nomear ferramenta, exigir prova) foram aplicadas nos reviews mas **não** no save-and-push nem no init-memory.

**Proposta:** Aplicar universalmente.

---

## 3. Plano de Implementação

### Fase 1 — Quick Wins (alto impacto, baixo esforço)

| # | Command | Melhoria | Técnicas | Esforço |
|---|---------|----------|----------|---------|
| 1.1 | review-internal | Adicionar teto de 3 iterações + escalate | T11 | ~5 min |
| 1.2 | review-vs-artifacts | Idem + HARD-GATE "nunca altere artefatos" | T11, T02 | ~5 min |
| 1.3 | review-internal | Exigir contagem de chamadas Read no encerramento | feedback-prompts | ~2 min |
| 1.4 | review-vs-artifacts | Idem | feedback-prompts | ~2 min |
| 1.5 | save-and-push | Nomear ferramentas (git status, git diff) explicitamente | feedback-prompts | ~5 min |
| 1.6 | init-memory | Nomear ferramentas na validação final (ls, readlink) | feedback-prompts | ~3 min |

### Fase 2 — Disciplina e Adversarialidade

| # | Command | Melhoria | Técnicas | Esforço |
|---|---------|----------|----------|---------|
| 2.1 | review-internal | Adicionar mindset adversarial ("Do Not Trust the Plan") | T07 | ~10 min |
| 2.2 | review-vs-artifacts | Idem + exigir lista explícita de artefatos antes de começar | T07, feedback | ~10 min |
| 2.3 | save-and-push | Iron Law: verificação obrigatória + HARD-GATE para push em main | T01, T02 | ~15 min |
| 2.4 | save-and-push | Red Flags: push sem testes, push com secrets, push para main | T04 | ~5 min |
| 2.5 | reviews (ambos) | Severidade → ação (Critical=bloqueia, Important=fix, Minor=nota) | superpowers code-reviewer | ~5 min |

### Fase 3 — Reestruturação

| # | Command | Melhoria | Técnicas | Esforço |
|---|---------|----------|----------|---------|
| 3.1 | todos | Adotar estrutura consistente (regra fundamental, processo, red flags, encerramento) | TPL-01 adaptado | ~30 min |
| 3.2 | reviews | Extrair loop compartilhado ou aplicar template unificado | T19 | ~15 min |
| 3.3 | init-memory | HARD-GATE antes de deletar + Structured Options no passo 2 | T02, T21 | ~10 min |
| 3.4 | reviews (ambos) | Tabela de racionalização (3-5 desculpas comuns) | T03 | ~10 min |

### Fase 4 — Validação (opcional mas recomendada)

| # | Ação | Técnica |
|---|------|---------|
| 4.1 | Testar cada command melhorado em cenário real | T13 (TDD para docs) |
| 4.2 | Capturar racionalizações do agente e adicionar counters | T13 REFACTOR |
| 4.3 | Documentar lições no feedback-prompts.md | memória |

---

## 4. Priorização Recomendada

**Executar nesta ordem:**

1. **Fase 1** (todos os quick wins de uma vez) — ~22 min
2. **Fase 2.3** (save-and-push é o mais frágil) — ~15 min
3. **Fase 2.1 + 2.2** (adversarialidade nos reviews) — ~20 min
4. **Fase 3.1** (estrutura consistente — faz enquanto toca nos commands) — incorporar nas edições acima
5. **Fase 2.4 + 2.5 + 3.3 + 3.4** (refinamentos) — ~30 min
6. **Fase 3.2** (DRY dos reviews — só se a duplicação incomodar) — ~15 min
7. **Fase 4** (validação — em sessão futura, quando usar os commands) — contínuo

**Total estimado:** ~2h para Fases 1-3, com ganho significativo de robustez.

---

## 5. Exemplos de Before/After

### save-and-push — Before (atual)

```markdown
4. Commit e push de TUDO que foi alterado nesta sessão:
   - Agrupe em commits lógicos (não um commit gigante)
   - Mensagens de commit descritivas
   - Push para o branch atual
```

### save-and-push — After (proposta)

```markdown
## Regra Fundamental

NO PUSH WITHOUT FRESH VERIFICATION.
Se não rodou `git status` e `git diff --cached` NESTA execução, não pode fazer push.

<HARD-GATE>
Se o branch atual é main ou master:
PARE. Pergunte ao usuário se quer push direto ou criar branch + PR.
NÃO faça push para main/master sem confirmação explícita.
</HARD-GATE>

## Processo

### 3. Commit
- Execute `git status` — liste o output completo
- Execute `git diff` — analise as mudanças
- Identifique arquivos sensíveis (.env, credentials, tokens, secrets) — se encontrar,
  PARE e pergunte ao usuário antes de incluir no commit
- Agrupe em commits lógicos: 1 commit por unidade de trabalho coerente
  (ex: "memória" separado de "código" separado de "config")
- Mensagens descritivas seguindo o padrão do repo (veja git log --oneline -5)

### 4. Push
- Execute `git status` depois do commit — deve estar limpo
- Execute `git push` para o branch atual
- Execute `git status` depois do push — confirme que foi aceito

Reporte no final: quantos commits, para qual branch, status final.

## Red Flags

- "Vou fazer push sem verificar, já sei que está tudo ok"
- "É só um arquivo, não precisa de commit separado"
- "Vou incluir o .env porque o usuário não mencionou"
- Push para main sem ter perguntado
```

### review-internal — Before (trecho)

```markdown
Faça uma análise adversária do plano $ARGUMENTS
procurando erros internos, gaps e inconsistências.
```

### review-internal — After (proposta)

```markdown
Faça uma análise adversária do plano $ARGUMENTS.

## Regra Fundamental

NO APPROVAL WITHOUT EVIDENCE.
Cada item do checklist que você marca como "ok" deve ter line numbers do plano como prova.
"Parece consistente" sem citar onde = item não verificado.

## Mindset

Leia o plano como se o autor estivesse errado. Sua função não é confirmar
que o plano é bom — é encontrar onde ele falha. Se você terminar sem encontrar
nada, é mais provável que você perdeu algo do que o plano ser perfeito.

CRITICAL: Do Not Trust the Plan.
Assuma que há pelo menos 1 erro que você ainda não encontrou.
```

---

## 6. Técnicas NÃO Aplicáveis aos Commands Atuais

Para completude — técnicas da KB que **não fazem sentido** aqui:

| Técnica | Razão |
|---------|-------|
| T12 Seleção de Modelo | Commands não despacham subagentes |
| T10 Two-Stage Review | Commands são single-pass, não têm spec+quality |
| T13 TDD para Docs | Aplicável na Fase 4 (validação), não na escrita |
| T16 Condition-Based Waiting | Não há operações async nos commands |
| T23 Visual Companion | Commands são text-only |
| T14 Defense-in-Depth | Commands não são código com múltiplas camadas |
| T15 Root Cause Tracing | Commands não fazem debugging |
| T22 SUBAGENT-STOP | Commands não são invocados por subagentes |

---

## Apêndice: Referências Cruzadas

- Análise do superpowers: `docs/kb/analise-superpowers-v5.0.5.md`
- Templates: `docs/kb/templates-reutilizaveis.md`
- Mapa de técnicas: `docs/kb/mapa-tecnicas.md`
- Feedback existente: `.ai/memory/feedback-prompts.md`
- Decisões de arquitetura: `.ai/memory/decisoes-arquitetura.md`
