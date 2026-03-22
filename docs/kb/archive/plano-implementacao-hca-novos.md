# Implementação de 3 Novos hca- Commands — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar 3 novos slash commands (`hca-resume`, `hca-refactor-prompt`, `hca-fix`) seguindo a estrutura canônica e as técnicas da KB.

**Architecture:** Cada command é um arquivo `.md` self-contained em `claude/commands/`. Todos seguem a estrutura canônica (`docs/kb/estrutura-canonica-commands.md`): Regra Fundamental, Processo com ferramentas nomeadas, Red Flags, Encerramento. Os commands não têm dependências entre si.

**Tech Stack:** Markdown puro (slash commands do Claude Code). Sem dependências.

**Referências:**
- Estrutura canônica: `docs/kb/estrutura-canonica-commands.md`
- KB de técnicas: `docs/kb/mapa-tecnicas.md`
- Feedback: `.ai/memory/feedback-prompts.md`
- Commands v2 existentes: `claude/commands/hca-*.md` (referência de estilo)

---

## Task 1: Criar hca-resume

**Files:**
- Create: `claude/commands/hca-resume.md`

O hca-resume é um **gerador de prompt de handoff**. Ele investiga o contexto
completo do projeto (memória, git, tasks, frameworks como BMAD/superpowers),
apresenta um resumo ao usuário, e após confirmação do que fazer a seguir,
gera um prompt pronto para colar numa sessão limpa — evitando o acúmulo de
contexto que aconteceria se o trabalho continuasse na mesma sessão.

- [ ] **Step 1: Escrever o command**

```markdown
Investigue o contexto deste projeto e gere um prompt de handoff para uma sessão limpa.

## Regra Fundamental

NO HANDOFF WITHOUT COMPLETE CONTEXT.
Não gere o prompt de handoff sem antes ter investigado TODAS as fontes de
contexto listadas no passo 1. Cada fonte ignorada é contexto perdido.

## Processo

### 1. Investigar contexto

Execute CADA item abaixo e registre os achados. Não pule nenhum.

**Memória do projeto:**
- Execute `ls .ai/memory/` — liste todos os arquivos
- Leia `.ai/memory/MEMORY.md` com a ferramenta Read
- Se existem arquivos de memória relevantes, leia-os com Read

**Estado do git:**
- Execute `git branch --show-current` — branch atual
- Execute `git log --oneline -15` — atividade recente
- Execute `git status` — trabalho não-commitado
- Execute `git stash list` — stashes pendentes
- Execute `git diff --stat` — mudanças unstaged (resumo)

**Trabalho em progresso:**
- Execute `ls docs/superpowers/plans/ 2>/dev/null` — planos existentes
- Execute `ls docs/ 2>/dev/null` — specs, brainstorms, artefatos
- Execute `grep -rn "TODO\|FIXME\|HACK" . --include="*.*" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | head -20` — TODOs no código

**Frameworks e ferramentas:**
- Execute `ls CLAUDE.md AGENTS.md nexus.yaml 2>/dev/null` — configs
- Execute `ls _bmad/ 2>/dev/null` — módulo BMAD presente?
- Leia `CLAUDE.md` com Read para entender o contexto do projeto
- Execute `ls claude/commands/ 2>/dev/null` — slash commands disponíveis

### 2. Apresentar resumo

Organize os achados em formato estruturado:

> **Projeto:** [nome do diretório]
> **Branch:** [branch atual] | **Último commit:** [mensagem]
>
> **Estado:**
> - [Trabalho não-commitado: sim/não — quais arquivos]
> - [Stashes: quantidade]
> - [Planos existentes: listar]
>
> **Memória relevante:**
> - [Resumo dos pontos-chave da memória]
>
> **Frameworks:** [BMAD, superpowers, etc.]
>
> O que você quer fazer a seguir?
> A) Continuar trabalho em progresso [descrever]
> B) Começar algo novo
> C) Outro: [descrever]

Aguarde a resposta do usuário.

### 3. Gerar prompt de handoff

Com base na escolha do usuário, gere um prompt autocontido que inclua:

**Estrutura do prompt gerado:**
```
Contexto do projeto:
- [1-3 frases sobre o que é o projeto, extraídas do CLAUDE.md/memória]
- Branch atual: [branch]
- [estado do trabalho: limpo / em progresso]

Memória relevante:
- [Apenas os pontos da memória que são relevantes para a tarefa escolhida]

Tarefa:
- [O que o usuário quer fazer, conforme respondido no passo 2]
- [Se continuar trabalho: onde parou, quais arquivos, qual o próximo passo]
- [Se novo: o que precisa ser feito]

Referências:
- [Paths de arquivos que o agente deve ler para ter contexto]
```

**Regras para o prompt gerado:**
- Incluir APENAS informação necessária para a tarefa escolhida
- Não incluir toda a memória — filtrar por relevância
- Incluir paths concretos para que o agente da próxima sessão possa ler
- O prompt deve ser copiável — sem formatação que dependa de contexto

Apresente o prompt em um bloco de código para fácil cópia:

> Prompt de handoff gerado. Cole numa nova sessão:
> ```
> [prompt aqui]
> ```

### 4. Verificar o prompt gerado

Releia o prompt gerado e verifique que:
- Não referencia "esta sessão" ou contexto que só existe aqui
- Inclui paths concretos de arquivos (não referências vagas)
- A tarefa está clara para um agente sem nenhum contexto prévio
- Não inclui memória irrelevante para a tarefa escolhida

Se algo faltar: ajuste (max 1 iteração de correção).

## Red Flags

- "Não preciso ler a memória, o git log é suficiente"
- "Vou pular a verificação de frameworks, é só código"
- "Vou incluir tudo no prompt — mais contexto é melhor"
- "O prompt pode ser vago, o agente descobre o resto"
- "Não preciso esperar o usuário escolher, já sei o que ele quer"

Se pensou qualquer item acima: PARE. Execute o passo que estava pulando.

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "Mais contexto é sempre melhor" | Contexto demais polui — filtre por relevância para a tarefa |
| "Já sei o que o usuário quer" | Você não sabe — pergunte e aguarde |
| "O git log basta como contexto" | Git mostra o quê mudou, não o porquê nem o que falta |
| "Não preciso verificar o prompt, acabei de gerar" | Prompts auto-referenciais são invisíveis para quem escreve |

## Encerramento

Reporte:
- Fontes investigadas: [quantidade e quais]
- Chamadas de ferramenta executadas: [N] (Read: X, Bash: Y)
- Prompt gerado: [sim/não, tamanho aproximado em linhas]
- Tarefa selecionada: [resumo da escolha do usuário]
```

- [ ] **Step 2: Ler o arquivo escrito com a ferramenta Read e verificar**

Verificar que:
- Tem Iron Law (NO HANDOFF WITHOUT COMPLETE CONTEXT)
- Passo 1 nomeia TODAS as ferramentas (ls, git, Read, grep)
- Passo 2 usa Structured Options (A/B/C)
- Passo 3 tem estrutura do prompt gerado com regras de filtragem
- Passo 4 tem verificação do prompt gerado
- Tem Red Flags (5+ items)
- Tem Racionalização (4 items)
- Tem Encerramento
- O prompt gerado é autocontido (não depende de contexto da sessão)

- [ ] **Step 3: Commit**

```bash
git add claude/commands/hca-resume.md
git commit -m "feat: cria hca-resume — gerador de prompt de handoff entre sessões"
```

---

## Task 2: Criar hca-refactor-prompt

**Files:**
- Create: `claude/commands/hca-refactor-prompt.md`

O hca-refactor-prompt aplica as técnicas da KB de forma padronizada
a qualquer command existente, elevando sua maturidade. É o meta-command
que formaliza o processo que foi feito manualmente na implementação v2.

- [ ] **Step 1: Escrever o command**

```markdown
Analise o command $ARGUMENTS e aplique as técnicas da KB para elevar sua maturidade.

## Regra Fundamental

NO REFACTOR WITHOUT DIAGNOSIS.
Não modifique o command sem antes ter lido, diagnosticado gaps, e apresentado
as melhorias ao usuário. Mudança sem diagnóstico é chute.

## Processo

### 1. Ler referências

Leia com a ferramenta Read (3 arquivos — não pule nenhum):
- `docs/kb/estrutura-canonica-commands.md` — template de estrutura
- `docs/kb/mapa-tecnicas.md` — técnicas disponíveis
- `.ai/memory/feedback-prompts.md` — lições de escrita de prompts

### 2. Ler e diagnosticar o command

Leia o command alvo com a ferramenta Read: `claude/commands/$ARGUMENTS`
(se $ARGUMENTS não incluir o path, assuma `claude/commands/` como prefixo).

Para cada seção da estrutura canônica, registre:
- **Presente e adequada:** cite line numbers
- **Presente mas fraca:** descreva o gap
- **Ausente:** marcar como ausente

Para cada técnica do mapa (T01-T23), avalie:
- **Aplicável e presente:** cite line numbers
- **Aplicável e ausente:** candidata a melhoria
- **Não aplicável:** justifique brevemente

Para cada lição do feedback-prompts, verifique:
- Ferramentas nomeadas ou verbos vagos?
- Exige prova observável?
- Loops têm critério de parada e teto?

### 3. Apresentar diagnóstico

Apresente o diagnóstico em formato estruturado:

> **Command:** `$ARGUMENTS`
> **Linhas:** [N] | **Seções canônicas:** [X de Y presentes]
>
> **Gaps estruturais:**
> | Seção | Estado | Ação sugerida |
> |-------|--------|---------------|
> | Regra Fundamental | ausente/fraca/ok | [sugestão] |
> | ... | ... | ... |
>
> **Técnicas aplicáveis não utilizadas:**
> | Técnica | Como aplicar | Impacto |
> |---------|-------------|---------|
> | T01 Iron Law | [sugestão] | alto/médio/baixo |
> | ... | ... | ... |
>
> **Feedback-prompts:**
> - [x] Ferramentas nomeadas / [ ] Ferramentas vagas
> - [x] Prova exigida / [ ] Sem prova
> - [x] Loops com teto / [ ] Loops abertos
>
> Opções:
> A) Aplicar todas as melhorias
> B) Selecionar quais aplicar
> C) Cancelar

Aguarde resposta antes de modificar.

### 4. Aplicar melhorias

Reescreva o command usando a ferramenta Write (reescrita completa)
ou Edit (alterações pontuais), aplicando as melhorias aprovadas.
Mantenha o conteúdo funcional existente (checklists, lógica de negócio).
Adicione apenas as seções/técnicas aprovadas.

### 5. Verificar resultado

Leia o command REESCRITO com a ferramenta Read.
Verifique que:
- Todas as melhorias aprovadas foram aplicadas (cite line numbers)
- O conteúdo funcional original está preservado
- Segue a estrutura canônica
- Ferramentas nomeadas (não verbos vagos)
- Prova exigida em cada ação

Se algo faltou: corrija e releia novamente (max 2 iterações de correção).

## Red Flags

- "Esse command é simples, não precisa de Iron Law"
- "Vou reescrever sem ler as referências, já sei as técnicas"
- "Vou aplicar tudo sem perguntar ao usuário"
- "O conteúdo funcional está implícito, não preciso preservar"
- "Vou pular a verificação, acabei de escrever"
- "Essa técnica não se aplica" (sem justificativa)

Se pensou qualquer item acima: PARE. Volte ao passo que estava pulando.

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "Já conheço as técnicas de cor" | Leia as referências — elas mudam, sua memória não |
| "Todas as melhorias são óbvias, não preciso de diagnóstico" | Diagnóstico existe para o usuário decidir, não para você |
| "Vou remover conteúdo que parece redundante" | Preservar conteúdo funcional — você não sabe o contexto de uso |
| "A verificação é formalidade" | Verificação encontra gaps que a escrita não vê |

## Encerramento

Reporte:
- Command analisado: [path]
- Chamadas Read executadas: [N] (referências: X, command: Y, verificação: Z)
- Gaps encontrados: [quantidade por tipo: estrutural, técnica, feedback]
- Melhorias aplicadas: [lista]
- Melhorias recusadas: [lista, se houver]
- Verificação: [passou/falhou, iterações de correção]
```

- [ ] **Step 2: Ler o arquivo escrito com a ferramenta Read e verificar**

Verificar que:
- Tem Iron Law (NO REFACTOR WITHOUT DIAGNOSIS)
- Passo 1 nomeia os 3 arquivos de referência com paths
- Passo 2 tem diagnóstico estruturado (seções + técnicas + feedback)
- Passo 3 usa Structured Options (A/B/C)
- Passo 5 tem verificação com Read + teto de 2 iterações
- Tem Red Flags (6 items)
- Tem tabela de Racionalização (4 items)
- Tem Encerramento com contagens

- [ ] **Step 3: Commit**

```bash
git add claude/commands/hca-refactor-prompt.md
git commit -m "feat: cria hca-refactor-prompt — meta-command para melhorar commands com KB"
```

---

## Task 3: Criar hca-fix

**Files:**
- Create: `claude/commands/hca-fix.md`

O hca-fix encadeia diagnóstico de causa raiz + TDD fix. Substitui o prompt
manual "identifique a causa raiz e resolva com TDD" por um command disciplinado
que força a sequência correta: entender → testar → corrigir → verificar.

- [ ] **Step 1: Escrever o command**

```markdown
Identifique a causa raiz do problema e resolva com TDD.

Se $ARGUMENTS foi fornecido, use como descrição do problema.
Se não, pergunte ao usuário: "Qual é o problema? Descreva o sintoma observado."

## Regra Fundamental

NO FIX WITHOUT ROOT CAUSE.
Não escreva código de correção sem antes ter identificado e documentado
a causa raiz. "Acho que é isso" não é causa raiz — é hipótese.
Causa raiz = você sabe EXATAMENTE qual linha/condição causa o problema E por quê.

<HARD-GATE>
Se você está prestes a modificar código de produção sem ter um teste
que reproduz o bug: PARE. Escreva o teste primeiro.
A única exceção é se o problema é no próprio setup de testes.
</HARD-GATE>

## Mindset

Você é um detetive, não um bombeiro. Investigar primeiro, agir depois.
A urgência de "corrigir rápido" é o que causa correções erradas e regressões.

## Processo

### Fase 1: Observar

Colete evidências SEM formar hipóteses ainda.

- Leia a descrição do problema (argumento ou pergunta ao usuário)
- Execute os comandos relevantes para reproduzir/observar:
  - Testes: identifique o comando de teste do projeto (verifique `package.json` scripts,
    `Makefile`, `pyproject.toml`, ou `CLAUDE.md`) e execute-o
  - Logs: execute `grep -rn "[mensagem de erro do sintoma]"` nos arquivos relevantes
  - Estado: execute `git log --oneline -5` para ver mudanças recentes
- Leia os arquivos relevantes com a ferramenta Read — cite line numbers

Registre as evidências coletadas:
> **Sintoma:** [o que acontece]
> **Onde:** [arquivo:linha]
> **Quando:** [em que condição]
> **Evidência:** [output de comandos, line numbers]

Apresente as evidências ao usuário: "Fase 1 completa. Evidências coletadas acima. Passando para diagnóstico."

### Fase 2: Diagnosticar

Forme hipóteses e teste cada uma.

Para cada hipótese:
1. Declare: "Hipótese: [causa raiz candidata] em [arquivo:linha]"
2. Teste: execute um comando via Bash ou leia com a ferramenta Read para confirmar/refutar
3. Resultado: "Confirmada" ou "Refutada porque [evidência]"

Máximo 5 hipóteses. Se nenhuma for confirmada após 5:
PARE e escale para o usuário — o problema pode ser mais complexo.

Ao confirmar uma hipótese, documente:
> **Causa raiz:** [descrição precisa]
> **Arquivo:** [path:linha]
> **Por que acontece:** [mecanismo — não apenas "está errado"]

### Fase 3: Corrigir com TDD

**3a. Escrever teste que reproduz o bug:**
- Crie um teste que FALHA no estado atual
- Execute o teste — confirme que falha pelo motivo esperado
- Se o teste passa (bug não reproduzido): sua causa raiz está errada.
  Volte à Fase 2. Se já voltou 2 vezes: PARE e escale para o usuário.

**3b. Corrigir o código:**
- Faça a correção mínima necessária
- Execute o teste — confirme que agora passa
- Execute a suite completa — confirme que não quebrou nada

**3c. Refatorar (se necessário):**
- Se a correção introduziu duplicação ou código feio: refatore
- Execute os testes novamente após refatorar

### Fase 4: Verificar

- Execute `git diff` — revise as mudanças
- Confirme que a correção é mínima (não toca em código não-relacionado)
- Execute a suite de testes completa uma última vez

## Red Flags

- "Já sei o que é, vou corrigir direto"
- "É óbvio, não preciso de teste para isso"
- "Vou corrigir e testar depois"
- "O teste é difícil de escrever, vou testar manualmente"
- "Vou aproveitar e refatorar esse módulo todo"
- "A suite de testes demora, vou rodar só o teste que escrevi"

Se pensou qualquer item acima: PARE. Volte à fase que estava pulando.

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "A causa é óbvia" | Óbvia para quem? Documente e prove com evidência |
| "Não preciso de teste, é uma mudança pequena" | Mudanças pequenas quebram coisas grandes. HARD-GATE |
| "Vou corrigir primeiro, testo depois" | TDD invertido não é TDD — é esperança |
| "A suite é grande demais para rodar inteira" | Rodar parcial = não saber se quebrou algo |
| "Já tentei 5 hipóteses, vou chutar a 6ª" | 5 falhas = escale para o usuário, não chute |

## Encerramento

Reporte:
- Problema: [descrição original]
- Causa raiz: [arquivo:linha — descrição]
- Hipóteses testadas: [quantidade, quais foram refutadas]
- Teste criado: [path do teste]
- Correção: [resumo da mudança]
- Suite completa: [passou/falhou]
```

- [ ] **Step 2: Ler o arquivo escrito com a ferramenta Read e verificar**

Verificar que:
- Tem Iron Law (NO FIX WITHOUT ROOT CAUSE)
- Tem HARD-GATE (não corrigir sem teste)
- Tem Mindset (detetive, não bombeiro)
- Fase 1 nomeia ferramentas (grep, git log, Read) sem placeholders
- Fase 1 tem gate explícito antes de Fase 2
- Fase 2 tem teto de 5 hipóteses com escalação
- Fase 3 segue TDD (red-green-refactor) com bound de 2 retornos à Fase 2
- Fase 4 exige suite completa
- Tem Red Flags (6 items)
- Tem tabela de Racionalização (5 items)
- Tem Encerramento com contagens
- Nenhum placeholder não-resolvido (`[...]` que não seja template)

- [ ] **Step 3: Commit**

```bash
git add claude/commands/hca-fix.md
git commit -m "feat: cria hca-fix — diagnóstico de causa raiz + TDD fix"
```

---

## Task 4: Verificação cruzada

**Files:**
- Read: todos os 3 commands novos
- Read: `docs/kb/estrutura-canonica-commands.md`

- [ ] **Step 1: Ler os 3 commands**

Executar Read nos 3 arquivos criados.

- [ ] **Step 2: Verificar aderência à estrutura canônica**

Para cada command, verificar presença de cada seção obrigatória:

| Seção | hca-resume | hca-refactor-prompt | hca-fix |
|-------|-----------|-------------------|---------|
| Regra Fundamental | ☐ | ☐ | ☐ |
| Processo (ferramentas nomeadas) | ☐ | ☐ | ☐ |
| Red Flags | ☐ | ☐ | ☐ |
| Encerramento | ☐ | ☐ | ☐ |

Seções opcionais aplicadas conforme necessidade:

| Seção | hca-resume | hca-refactor-prompt | hca-fix |
|-------|-----------|-------------------|---------|
| HARD-GATE | — | — | ☐ |
| Mindset (investigativo) | — | — | ☐ |
| Racionalização | ☐ | ☐ | ☐ |
| Structured Options | ☐ | ☐ | — |

- [ ] **Step 3: Verificar consistência com commands v2 existentes**

- Mesmo formato de Iron Law "NO X WITHOUT Y"?
- Mesmo formato de Red Flags (lista + "Se pensou...")?
- Mesmo formato de Encerramento (report estruturado)?
- Ferramentas nomeadas (não verbos vagos)?

Se inconsistências: corrigir.

- [ ] **Step 4: Commit final (se houve ajustes)**

```bash
git add claude/commands/
git commit -m "fix: ajusta consistência dos novos hca- commands"
```

---

## Task 5: Atualizar documentação

**Files:**
- Modify: `docs/kb/mapa-tecnicas.md` (adicionar novos commands à tabela)

- [ ] **Step 1: Atualizar mapa de técnicas**

Ler `docs/kb/mapa-tecnicas.md` com Read. Adicionar os 3 novos commands à
tabela "Mapeamento: Técnicas vs Commands `hca-`":

| Command | Técnicas aplicadas |
|---------|-------------------|
| `hca-resume` | T01 (Iron Law), T03 (Racionalização), T04 (Red Flags), T21 (Structured Options), feedback-prompts |
| `hca-refactor-prompt` | T01 (Iron Law), T03 (Racionalização), T04 (Red Flags), T11 (Loop com Teto — max 2), T21 (Structured Options), feedback-prompts |
| `hca-fix` | T01 (Iron Law), T02 (HARD-GATE), T03 (Racionalização), T04 (Red Flags), T15 (Root Cause Tracing), Mindset (investigativo), feedback-prompts |

- [ ] **Step 2: Commit**

```bash
git add docs/kb/mapa-tecnicas.md
git commit -m "docs: adiciona novos commands ao mapa de técnicas"
```
