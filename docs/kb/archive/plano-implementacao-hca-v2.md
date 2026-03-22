# Implementação hca- Commands v2 — Plano

> **Goal:** Reescrever os 4 hca- commands aplicando as técnicas catalogadas da KB (superpowers v5.0.5) e os feedbacks de `.ai/memory/feedback-prompts.md`, elevando maturidade de "funcional" para "disciplinado e à prova de racionalização".

**Architecture:** Cada command será self-contained (sem referências externas entre commands). A estrutura canônica será aplicada a todos, com seções obrigatórias (Descrição, Regra Fundamental, Processo, Red Flags, Encerramento) e opcionais conforme o tipo (Mindset, Checklist, Severidade→Ação, Racionalização). Os dois reviews compartilham o mesmo padrão de loop mas mantêm checklists distintos, e ambos posicionam Checklist como seção separada ANTES de Processo.

**Tech Stack:** Markdown puro (slash commands do Claude Code). Sem dependências.

**Referências:**
- Análise: `docs/kb/analise-superpowers-v5.0.5.md`
- Templates: `docs/kb/templates-reutilizaveis.md`
- Diagnóstico: `docs/kb/plano-melhorias-hca-commands.md`
- Feedback: `.ai/memory/feedback-prompts.md`

---

## Task 1: Definir estrutura canônica para commands

**Files:**
- Create: `docs/kb/estrutura-canonica-commands.md`

Objetivo: documentar o padrão estrutural que todos os commands devem seguir,
servindo como referência para esta implementação e futuros commands.

- [ ] **Step 1: Escrever o template de estrutura canônica**

O template adapta TPL-01 (SKILL.md canônico) para o contexto de slash commands,
incorporando as lições de feedback-prompts (nomear ferramentas, exigir prova)
e as técnicas de disciplina do superpowers (Iron Law, Red Flags, racionalização).

```markdown
# Estrutura Canônica — hca- Commands

Template para novos commands e referência para refactoring dos existentes.

## Padrão

[Descrição em 1-2 frases do que o command faz]

## Regra Fundamental

[Uma declaração absoluta que não admite exceção]
[Formato: "NO X WITHOUT Y" — caixa alta, sem hedge words]
[Se necessário: complemento explicando a consequência]

<HARD-GATE> (se aplicável)
[Bloqueio pontual para ação específica perigosa]
</HARD-GATE>

## Mindset (se o command exige postura específica)

[Framing de como o agente deve abordar a tarefa]
[Ex: adversarial para reviews, verificador para push]

## Checklist (se o command tem itens a verificar)

[Lista numerada de itens concretos]
[Cada item deve ser verificável com ferramenta nomeada]

## Processo

[Steps numerados — cada step é UMA ação]
[Nomear a ferramenta: "Execute `git status`", "Leia com a ferramenta Read"]
[Exigir prova: "cite line numbers", "liste o output"]
[Loops: critério de parada + teto de iterações + contagem]

## Severidade → Ação (se o command classifica achados)

- **Crítico:** [ação obrigatória — bloqueia continuação]
- **Significativo:** [ação recomendada — corrigir antes de prosseguir]
- **Menor:** [registrar — corrigir se possível]

## Red Flags

[Lista de pensamentos que significam STOP]
[Cada item é uma racionalização real — capturada ou antecipada]
[Fecha com: "Se pensou qualquer item acima: PARE e [ação]"]

## Encerramento

[Formato exato do report final]
[Contagens obrigatórias: iterações, chamadas de ferramenta, achados]

## Regras de Escrita (meta — para quem cria/edita commands)

- Verbos abstratos (releia, verifique, confira) → nomear ferramenta
- Exigir prova observável de cada ação (line numbers, output)
- Preferir low/medium freedom (T20) para operações críticas
- Cada Red Flag deve corresponder a uma racionalização real
- Iron Law: 1 por command, no início, sem exceções
```

- [ ] **Step 2: Commit**

```bash
git add docs/kb/estrutura-canonica-commands.md
git commit -m "docs: define estrutura canônica para hca- commands"
```

---

## Task 2: Reescrever hca-save-and-push

**Files:**
- Modify: `claude/commands/hca-save-and-push.md`

Diagnóstico (do plano de melhorias): command mais frágil — sem verificação,
sem gate, sem detecção de secrets, verbos vagos. Incorpora: T01 (Iron Law),
T02 (HARD-GATE), T04 (Red Flags), T20 (Graus de Liberdade), feedback-prompts.

- [ ] **Step 1: Ler o command atual**

Ler `claude/commands/hca-save-and-push.md` com a ferramenta Read.
Anotar os 5 passos atuais e o que cada um faz.

- [ ] **Step 2: Escrever a versão v2**

Reescrever seguindo a estrutura canônica (Task 1). O conteúdo completo:

```markdown
Revise esta conversa, salve aprendizados na memória, e faça commit + push do trabalho.

## Regra Fundamental

NO PUSH WITHOUT FRESH VERIFICATION.
Se não executou `git status` e `git diff` NESTA execução do command, não pode fazer push.

<HARD-GATE>
Se o branch atual é main ou master:
PARE. Pergunte ao usuário: push direto para main ou criar branch + PR?
NÃO faça push para main/master sem confirmação explícita.
</HARD-GATE>

## Processo

### 1. Salvar aprendizados na memória

Identifique aprendizados úteis para FUTURAS sessões:
- Decisões tomadas e seus motivos
- Bugs encontrados e suas causas raiz
- Padrões que funcionaram ou falharam
- Feedback do usuário sobre abordagem

NÃO salve: contexto desta conversa que não será útil depois, fatos que podem
ser derivados lendo o código ou `git log`, detalhes efêmeros (branches temporários,
tentativas descartadas, erros de digitação corrigidos).

Se `.ai/memory/` não existir, rode `/hca-init-memory` primeiro.
Atualize arquivos existentes em vez de criar duplicatas.
Mantenha `MEMORY.md` como índice atualizado.

### 2. Salvar trabalho em andamento

Se houver trabalho em progresso (brainstorm, plano, artefato, spec),
salve no arquivo correspondente. Não deixe trabalho só no contexto da conversa.

### 3. Preparar commits

Execute `git status` — liste o output completo.
Execute `git diff` — analise as mudanças staged e unstaged.

**Detecção de sensíveis:** Execute `git diff --name-only` e `grep -rn` nos arquivos
alterados procurando:
- Nomes de arquivo: `.env`, `.env.*`, `credentials.*`, `*secret*`, `*token*`, `*.pem`, `*.key`
- Conteúdo suspeito: execute `grep -rn "password\|api_key\|secret\|token\|Bearer" <arquivos alterados>`
Se encontrar qualquer item: PARE e pergunte ao usuário antes de incluir no commit.

**Agrupamento:** 1 commit por unidade de trabalho coerente.
Critérios de separação:
- Memória (`.ai/memory/`) = commit separado
- Documentação (`docs/`) = commit separado
- Código/commands = commit separado
- Config = commit separado
Se TUDO é da mesma natureza, 1 commit é suficiente.

**Mensagens:** Siga o padrão do repo. Execute `git log --oneline -5` para ver
o estilo recente. Use prefixos convencionais (feat, fix, docs, refactor).

### 4. Fazer push

Execute `git status` — confirme que está limpo após os commits.
Verifique o branch atual com `git branch --show-current`.
Aplique o HARD-GATE acima se for main/master.
Execute `git push` para o branch atual.
Execute `git status` novamente — confirme que o push foi aceito.

## Encerramento

Reporte:
- Aprendizados salvos: quais arquivos de memória foram alterados
- Commits: quantidade, mensagens, branch
- Push: status final (sucesso/falha)
- Se algo falhou: descreva o erro e sugira correção

## Red Flags

- "Vou fazer push sem verificar, já sei que está ok"
- "É só um arquivo pequeno, não precisa de git status"
- "Vou incluir o .env porque o usuário não mencionou secrets"
- "Vou fazer push para main, é só uma correção rápida"
- "Não preciso separar commits, é tudo relacionado"
- "Já vi o diff mentalmente, não preciso executar git diff"

Se pensou qualquer item acima: PARE. Execute a verificação que estava pulando.
```

- [ ] **Step 3: Ler o arquivo escrito com a ferramenta Read e verificar**

Verificar que:
- Tem Iron Law (regra fundamental)
- Tem HARD-GATE para main/master
- Todas as ferramentas são nomeadas (git status, git diff, git log, git push)
- Tem Red Flags
- Tem formato de encerramento
- Detecção de sensíveis está presente
- Critérios de agrupamento de commits são concretos

- [ ] **Step 4: Commit**

```bash
git add claude/commands/hca-save-and-push.md
git commit -m "feat: reescreve hca-save-and-push com Iron Law, HARD-GATE e Red Flags"
```

---

## Task 3: Reescrever hca-review-plan-internal

**Files:**
- Modify: `claude/commands/hca-review-plan-internal.md`

Diagnóstico: já tem loop+Read+line numbers (feedback-prompts). Precisa de:
mindset adversarial (T07), teto de iterações (T11), Iron Law (T01),
Red Flags (T04), tabela de racionalização (T03), severidade→ação,
contagem de chamadas Read, formato de report estruturado.

- [ ] **Step 1: Ler o command atual**

Ler `claude/commands/hca-review-plan-internal.md` com a ferramenta Read.
Anotar: checklist atual (7 itens), processo de loop, formato de encerramento.

- [ ] **Step 2: Escrever a versão v2**

Reescrever mantendo o checklist existente (que é bom) mas adicionando
todas as melhorias identificadas.

```markdown
Faça uma análise adversária do plano $ARGUMENTS
procurando erros internos, gaps e inconsistências.

## Regra Fundamental

NO APPROVAL WITHOUT EVIDENCE.
Cada item do checklist marcado como "ok" DEVE ter line numbers como prova.
"Parece consistente" sem citar onde no plano = item não verificado.

## Mindset

Leia o plano como se o autor estivesse errado. Sua função é encontrar onde
o plano falha, não confirmar que ele é bom.

CRITICAL: Do Not Trust the Plan.
Se você terminar a análise sem encontrar NENHUM problema, é mais provável
que você perdeu algo do que o plano ser perfeito. Nesse caso, releia
o checklist e force uma segunda passada mais agressiva.

## Checklist

Para cada item, cite line numbers do plano que comprovam a verificação.
Se não conseguir citar line numbers, o item NÃO foi verificado.

1. **Contradições:** uma task diz X, outra diz Y?
2. **Dependências quebradas:** task referencia arquivo/modelo que nenhuma task cria?
3. **Ordenação:** alguma task depende de algo que ainda não foi feito?
4. **Ambiguidade:** alguma task é vaga demais para implementar sem adivinhar?
5. **Schema:** migrations dentro do plano são consistentes entre si?
6. **File lists:** arquivos listados existem ou serão criados por task anterior?
7. **Test coverage:** tasks com código novo mas sem menção a testes?

## Severidade → Ação

- **Crítico:** bloqueia implementação — DEVE ser corrigido antes de prosseguir
- **Significativo:** causa retrabalho — corrigir agora, não depois
- **Menor:** incomoda mas não quebra — corrigir se possível, registrar se não

## Processo

### ITERAÇÃO 1:
1. Leia o plano inteiro com a ferramenta Read. Aplique CADA item do checklist.
   Para cada item, registre: status (ok/problema), line numbers verificados.
   Corrija os erros encontrados diretamente no plano.

### LOOP DE VERIFICAÇÃO (max 3 iterações):
2. Leia o plano CORRIGIDO do início usando a ferramenta Read
   (NÃO revisão mental — execute Read no arquivo). Cite line numbers.
3. Verifique se:
   - As correções não introduziram novos problemas
   - Algum item do checklist escapou na passada anterior
4. Se encontrou novos erros: corrija e volte ao passo 2.
5. Se a releitura não encontrou nada novo: o loop termina.
6. Se atingiu 3 iterações e ainda encontra problemas:
   PARE e escale para o usuário — o plano pode ter problemas estruturais
   que exigem decisão humana.

## Red Flags

- "Esse item do checklist parece ok, não preciso citar line numbers"
- "O plano é claro, não preciso verificar dependências"
- "Já li o plano inteiro mentalmente, não preciso usar Read de novo"
- "Esse erro é menor, posso ignorar"
- "Terminei sem achar nada — o plano está perfeito"
- "Vou pular a releitura, minhas correções estão certas"

Se pensou qualquer item acima: PARE. Volte ao passo que estava pulando.

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "Parece consistente" | Prove com line numbers ou não é verificação |
| "Já verifiquei mentalmente" | Verificação mental não conta — execute Read |
| "Esse item não se aplica a este plano" | Registre explicitamente como N/A com justificativa |
| "O plano é simples, não precisa de tudo isso" | Planos simples têm bugs simples que causam retrabalho |
| "Já são 3 iterações, vou aprovar" | Se ainda tem problemas, escale — não aprove com defeitos |

## Encerramento

Apresente o resumo neste formato:

### Resumo da Análise

**Iterações realizadas:** [N]
**Chamadas Read executadas:** [N]
**Total de achados:** [N] (críticos: X, significativos: Y, menores: Z)

| # | Achado | Correção aplicada | Severidade | Iteração |
|---|--------|-------------------|------------|----------|
| 1 | [resumo] | [o que foi corrigido] | crítico/significativo/menor | 1 |

**Status final:** [Plano aprovado / Plano com ressalvas / Escalado para usuário]
```

- [ ] **Step 3: Ler o arquivo escrito com a ferramenta Read e verificar**

Verificar que:
- Tem Iron Law (Regra Fundamental)
- Tem Mindset adversarial com "Do Not Trust"
- Checklist manteve os 7 itens originais + exige line numbers
- Tem Severidade → Ação com definição clara
- Loop tem teto de 3 iterações com escalação
- Ferramentas nomeadas (Read, não "releia")
- Tem Red Flags (6+ items)
- Tem tabela de Racionalização (5+ items)
- Encerramento exige contagem de chamadas Read
- Formato de report é tabela estruturada

- [ ] **Step 4: Commit**

```bash
git add claude/commands/hca-review-plan-internal.md
git commit -m "feat: reescreve hca-review-plan-internal com adversarial mindset, teto e racionalização"
```

---

## Task 4: Reescrever hca-review-plan-vs-artifacts

**Files:**
- Modify: `claude/commands/hca-review-plan-vs-artifacts.md`

Diagnóstico: mesmos gaps do internal + falta HARD-GATE para artefatos +
falta lista explícita de artefatos + falta formato de rastreabilidade.
O loop e encerramento devem seguir o mesmo padrão do internal (Task 3).

- [ ] **Step 1: Ler o command atual**

Ler `claude/commands/hca-review-plan-vs-artifacts.md` com a ferramenta Read.
Anotar: checklist atual (6 itens), processo de loop, diferenças vs internal.

- [ ] **Step 2: Escrever a versão v2**

Reescrever mantendo o checklist existente, adicionando HARD-GATE para artefatos,
lista explícita de artefatos, e o mesmo padrão de disciplina do internal.

```markdown
Faça uma análise adversária do plano $ARGUMENTS
comparando-o contra seus artefatos de origem (PRD, specs, designs).

## Regra Fundamental

NO APPROVAL WITHOUT CROSS-REFERENCE.
Cada requirement dos artefatos deve ter correspondência verificável no plano,
com line numbers de AMBOS os documentos como prova.

<HARD-GATE>
Este command corrige o PLANO, NUNCA os artefatos de origem.
Se encontrar erro no artefato: registre como "divergência do artefato"
e pergunte ao usuário como resolver. NÃO edite artefatos.
</HARD-GATE>

## Mindset

Os artefatos são a fonte de verdade. O plano é a interpretação — e
interpretações frequentemente perdem detalhes, simplificam demais, ou
adicionam coisas que ninguém pediu.

CRITICAL: Do Not Trust the Plan's Coverage.
Se o plano diz "cobre todos os requirements", prove. Se não conseguir
provar com line numbers cruzados, a cobertura é incompleta.

## Checklist

Para cada item, cite line numbers do plano E do artefato correspondente.
Se não conseguir citar line numbers de ambos, o item NÃO foi verificado.

1. **Cobertura:** todo FR, NFR e Story dos artefatos tem task no plano?
2. **Acceptance criteria:** tasks resumidas demais vs ACs dos epics?
3. **Phase gates:** cada critério de gate do PRD tem step concreto no plano?
4. **Dependências:** grafo de fases do plano bate com o grafo dos epics?
5. **Schema/API:** migrations e endpoints batem com architecture doc?
6. **UX:** componentes, estados, tokens e responsive batem com UX spec?

## Severidade → Ação

- **Crítico:** requirement ausente ou contradição com artefato — DEVE ser corrigido
- **Significativo:** cobertura parcial ou simplificação excessiva — corrigir agora
- **Menor:** diferença de nomenclatura ou formatação — registrar

## Processo

### 0. Identificar artefatos
Leia o plano com a ferramenta Read. Identifique todos os artefatos listados
em "Source Documents", "References", ou equivalente.

Para CADA artefato, execute Read e registre:
- Path completo do arquivo
- Tipo (PRD, epic, spec, architecture, UX)
- Quantidade de requirements/stories/FRs identificados

Apresente a lista antes de iniciar o review:
> Artefatos encontrados:
> - `path/to/prd.md` (PRD, 12 FRs, 3 NFRs)
> - `path/to/epic-1.md` (Epic, 5 stories)
> Prosseguir com o review?

Aguarde confirmação. O usuário pode adicionar artefatos que o plano não listou.

### ITERAÇÃO 1:
1. Aplique CADA item do checklist cruzando plano × artefatos.
   Para cada item, registre: status, line numbers do plano, line numbers do artefato.
   Corrija divergências no plano. Se a divergência é intencional, documente
   como "alignment note" no próprio plano.

### LOOP DE VERIFICAÇÃO (max 3 iterações):
2. Leia o plano CORRIGIDO com a ferramenta Read. Cite line numbers.
3. Verifique se:
   - As correções não introduziram novos problemas
   - Algum requirement dos artefatos escapou
4. Se encontrou novos gaps: corrija e volte ao passo 2.
5. Se a releitura não encontrou nada novo: o loop termina.
6. Se atingiu 3 iterações e ainda encontra problemas:
   PARE e escale para o usuário.

## Red Flags

- "O plano provavelmente cobre isso, não preciso verificar no artefato"
- "Esse artefato é muito longo, vou verificar por alto"
- "Os nomes são parecidos, deve ser a mesma coisa"
- "Vou pular a UX spec, o plano é backend"
- "Já verifiquei cruzando mentalmente, não preciso do Read"
- "Vou editar o artefato para ficar consistente com o plano"

Se pensou qualquer item acima: PARE. Volte ao passo que estava pulando.

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "O plano cobre todos os requirements" | Prove com line numbers cruzados |
| "Esse artefato não é relevante" | Se foi listado como source, é relevante — leia |
| "Vou ler o artefato por alto" | Ler por alto = perder requirements. Read completo |
| "Divergência intencional, não preciso documentar" | Se não está documentada, não é intencional |
| "Editar o artefato é mais rápido" | HARD-GATE: nunca edite artefatos |

## Encerramento

### Resumo da Análise Cruzada

**Artefatos analisados:** [lista com paths]
**Iterações realizadas:** [N]
**Chamadas Read executadas:** [N] (plano: X, artefatos: Y)
**Total de achados:** [N] (críticos: X, significativos: Y, menores: Z)

| # | Achado | Artefato:linha | Plano:linha | Correção | Severidade |
|---|--------|---------------|-------------|----------|------------|
| 1 | [resumo] | prd.md:42 | plan.md:108 | [correção] | crítico |

**Alignment notes adicionadas:** [N]
**Status final:** [Plano aprovado / Plano com ressalvas / Escalado para usuário]
```

- [ ] **Step 3: Ler o arquivo escrito com a ferramenta Read e verificar**

Verificar que:
- Tem Iron Law com cross-reference
- Tem HARD-GATE para artefatos (nunca editar)
- Passo 0 exige lista explícita de artefatos com confirmação
- Checklist manteve os 6 itens originais + exige line numbers cruzados
- Loop tem teto de 3 iterações
- Ferramentas nomeadas (Read)
- Tem Red Flags (6+ items) incluindo "vou editar o artefato"
- Tem tabela de Racionalização (5+ items)
- Encerramento exige contagem de chamadas Read separada (plano vs artefatos)
- Report tem coluna de artefato:linha + plano:linha

- [ ] **Step 4: Commit**

```bash
git add claude/commands/hca-review-plan-vs-artifacts.md
git commit -m "feat: reescreve hca-review-plan-vs-artifacts com HARD-GATE, adversarial e cross-reference"
```

---

## Task 5: Reescrever hca-init-memory

**Files:**
- Modify: `claude/commands/hca-init-memory.md`

Diagnóstico: command mais completo em estrutura, mas validação final é vaga,
operações destrutivas sem gate formal, e ferramentas não nomeadas.
Incorpora: T01 (Iron Law), T02 (HARD-GATE), T04 (Red Flags),
T09 (Commitment), T21 (Structured Options), feedback-prompts.

- [ ] **Step 1: Ler o command atual**

Ler `claude/commands/hca-init-memory.md` com a ferramenta Read.
Anotar: 8 passos atuais, confirmation gate existente, checklist de validação.

- [ ] **Step 2: Escrever a versão v2**

Manter a lógica dos 8 passos (que é boa) mas adicionar Iron Law,
HARD-GATE para deleção, Structured Options, ferramentas nomeadas
na validação, e Red Flags.

```markdown
Padronize a memória deste projeto para `.ai/memory/` (canônica, versionada no git),
com `~/.claude/projects/.../memory/` sendo apenas um symlink.

Anuncie ao iniciar: "Vou padronizar a memória deste projeto para `.ai/memory/`."

## Regra Fundamental

NO DELETION WITHOUT CONFIRMED BACKUP.
Diretórios originais de memória só podem ser removidos APÓS confirmar que
TODOS os arquivos foram copiados com sucesso para `.ai/memory/`.
Confirmar = executar `ls` em ambos os diretórios e comparar.

## Processo

### 1. Detectar memória existente

Escaneie o projeto executando `ls` e `find` nos locais conhecidos:
- `.ai/memory/`
- `.memory/`
- `.claude/memory/`
- `docs/claude-memory/`
- `~/.claude/projects/{path-encoded}/memory/` (path encoded: `/a/b/c` → `-a-b-c`)
- Qualquer outro diretório referenciado em `CLAUDE.md` como memória

Execute `grep -r "memory\|memória" CLAUDE.md AGENTS.md 2>/dev/null` para
encontrar referências não-óbvias.

Ignore automaticamente `_bmad/_memory/` — é memória do módulo BMAD.
Se encontrar diretórios não-previstos, liste e pergunte ao usuário.

### 2. Apresentar achados e pedir confirmação

Liste o que encontrou com origem, quantidade de arquivos, e tamanho total.

Apresente como Structured Options:

> Encontrei memória em:
> 1. `.memory/` (8 arquivos, 12KB)
> 2. `~/.claude/projects/-home-henry-projeto/memory/` (3 arquivos, 4KB)
> 3. `_bmad/_memory/` — **ignorado automaticamente** (memória BMAD)
>
> Opções:
> A) Migrar tudo (itens 1 e 2) para `.ai/memory/`
> B) Selecionar quais migrar
> C) Cancelar

Aguarde resposta antes de prosseguir.

### 3. Migrar arquivos

- Crie `.ai/memory/` se não existir
- Copie os arquivos aprovados para `.ai/memory/`
- Se houver múltiplos `MEMORY.md`, mescle num único índice
- Execute `ls` no destino para confirmar que todos os arquivos chegaram

<HARD-GATE>
NÃO remova os diretórios originais ainda.
A remoção só acontece no passo 8, após TODA a validação.
Se o usuário pedir para remover agora: explique que a validação
garante segurança e a remoção vem no final.
</HARD-GATE>

### 4. Organizar conteúdo

- **Já tem estrutura** (múltiplos arquivos temáticos): preserve como está
- **Sem memória nenhuma**: crie `.ai/memory/MEMORY.md` com índice vazio
- **Blob único** (um arquivo gigante com tudo misturado): separe em arquivos
  temáticos agrupados por afinidade. Nomes descritivos conforme o domínio.
  Único obrigatório: `MEMORY.md` como índice.

### 5. Criar symlink

- Calcule o path encoded: `/home/user/projeto` → `-home-user-projeto`
- Se `~/.claude/projects/{encoded}/memory/` existir (diretório real ou symlink),
  remova o antigo (é seguro — os arquivos já estão em `.ai/memory/`)
- Crie: `ln -s {repo}/.ai/memory/ ~/.claude/projects/{encoded}/memory/`
- Crie o diretório pai se não existir

### 6. Atualizar CLAUDE.md

- Se NÃO existir: crie com seção de memória
- Se JÁ existir: adicione ou atualize a seção de memória

Conteúdo mínimo da seção:
```
## Memória
Consulte `.ai/memory/MEMORY.md` antes de implementar.
Atualize a memória ao aprender algo relevante para sessões futuras.
```

### 7. Atualizar referências quebradas

Execute `grep -r` nos paths antigos de memória pelo projeto inteiro.

- **Arquivos operacionais** (CLAUDE.md, AGENTS.md, configs):
  atualize as referências para `.ai/memory/`
- **Docs históricos** (plans, designs, specs): liste as referências
  mas NÃO altere sem perguntar — são registros históricos

### 8. Validação e cleanup

Verifique executando cada comando (não apenas "verifique"):

- Execute `ls -la ~/.claude/projects/{encoded}/memory/` via symlink
  — deve mostrar os arquivos de `.ai/memory/`
- Execute `readlink ~/.claude/projects/{encoded}/memory/`
  — deve apontar para `{repo}/.ai/memory/`
- Execute `grep -l "memory\|memória" CLAUDE.md`
  — deve encontrar referência a `.ai/memory/`
- Execute `ls .ai/memory/MEMORY.md`
  — deve existir

Se TUDO passou: agora remova os diretórios originais (os que foram migrados).
Para cada diretório a remover, liste o path completo e peça confirmação:

> Remover diretório original `.memory/`? (arquivos já estão em `.ai/memory/`)
> Digite "remover" para confirmar.

## Encerramento

Apresente relatório:
- Arquivos migrados: [quantidade] de [origem(s)]
- Symlink: `~/.claude/projects/{encoded}/memory/` → `{repo}/.ai/memory/`
- CLAUDE.md: [criado/atualizado]
- Referências atualizadas: [quais arquivos]
- Diretórios removidos: [quais]
- Problemas encontrados: [se houver]

## Red Flags

- "Vou remover o diretório original antes de validar"
- "O symlink provavelmente está certo, não preciso testar"
- "CLAUDE.md já deve ter a referência, não preciso verificar"
- "Vou editar um doc histórico para atualizar o path"
- "Esse diretório de memória não-previsto provavelmente não é importante"

Se pensou qualquer item acima: PARE. Execute a verificação que estava pulando.
```

- [ ] **Step 3: Ler o arquivo escrito com a ferramenta Read e verificar**

Verificar que:
- Tem Iron Law (no deletion without backup)
- Tem HARD-GATE para deleção prematura (passo 3)
- Passo 1 nomeia ferramentas (ls, find, grep)
- Passo 2 usa Structured Options (A/B/C)
- Passo 8 nomeia ferramentas de validação (ls, readlink, grep)
- Confirmação tipada para remoção ("remover")
- Tem Red Flags
- Tem formato de encerramento
- Lógica dos 8 passos originais está preservada

- [ ] **Step 4: Commit**

```bash
git add claude/commands/hca-init-memory.md
git commit -m "feat: reescreve hca-init-memory com Iron Law, HARD-GATE e validação rigorosa"
```

---

## Task 6: Verificação cruzada final

**Files:**
- Read: todos os 4 commands reescritos
- Read: `docs/kb/plano-melhorias-hca-commands.md` (diagnóstico original)

Objetivo: confirmar que TODAS as melhorias identificadas no plano foram implementadas.

- [ ] **Step 1: Ler todos os commands reescritos**

Executar Read nos 4 arquivos:
- `claude/commands/hca-save-and-push.md`
- `claude/commands/hca-review-plan-internal.md`
- `claude/commands/hca-review-plan-vs-artifacts.md`
- `claude/commands/hca-init-memory.md`

- [ ] **Step 2: Ler o diagnóstico original**

Executar Read em `docs/kb/plano-melhorias-hca-commands.md`.

- [ ] **Step 3: Verificar cobertura técnica→command**

Para cada técnica do diagnóstico, confirmar que foi implementada:

| Técnica | save-push | review-int | review-art | init-mem |
|---------|-----------|------------|------------|----------|
| T01 Iron Law | ☐ | ☐ | ☐ | ☐ |
| T02 HARD-GATE | ☐ | — | ☐ | ☐ |
| T03 Racionalização | — | ☐ | ☐ | — |
| T04 Red Flags | ☐ | ☐ | ☐ | ☐ |
| T07 Adversarial | — | ☐ | ☐ | — |
| T09 Commitment | — | — | — | ☐ |
| T11 Teto iterações | — | ☐ | ☐ | — |
| T20 Graus Liberdade | ☐ | — | — | — |
| T21 Structured Options | — | — | — | ☐ |
| Feedback: nomear ferramenta | ☐ | ☐ | ☐ | ☐ |
| Feedback: exigir prova | ☐ | ☐ | ☐ | ☐ |
| Feedback: contagem | — | ☐ | ☐ | — |
| Severidade → ação | — | ☐ | ☐ | — |

Marcar cada ☐ como ✅ ou ❌.
Se algum ❌: corrigir no command correspondente.

- [ ] **Step 4: Verificar consistência entre commands**

- Mesmo formato de Iron Law (NO X WITHOUT Y)?
- Mesmo formato de Red Flags (lista + "Se pensou...")?
- Mesmo formato de Encerramento (report estruturado)?
- Review-internal e review-vs-artifacts: loop idêntico em estrutura?

Se inconsistências: alinhar.

- [ ] **Step 5: Commit final (se houve ajustes)**

```bash
git add claude/commands/
git commit -m "fix: ajusta consistência entre hca- commands após verificação cruzada"
```

---

## Task 7: Atualizar documentação e memória

**Files:**
- Modify: `docs/kb/mapa-tecnicas.md` (atualizar seção "Técnicas vs Commands")
- Modify: `.ai/memory/feedback-prompts.md` (adicionar lições desta implementação)

- [ ] **Step 1: Atualizar mapa de técnicas**

Ler `docs/kb/mapa-tecnicas.md`. Atualizar a tabela "Mapeamento: Técnicas vs Commands"
para refletir o estado pós-implementação (trocar "poderiam ser adicionadas" por
"aplicadas na v2").

- [ ] **Step 2: Registrar lições aprendidas**

Se durante a implementação surgiram insights sobre escrita de prompts que não
estão no feedback-prompts.md, adicioná-los.

- [ ] **Step 3: Commit**

```bash
git add docs/kb/mapa-tecnicas.md .ai/memory/feedback-prompts.md
git commit -m "docs: atualiza mapa de técnicas e feedback após implementação v2"
```

---

## Task 8: Validação runtime dos commands (Phase 4)

**Files:**
- Read: todos os 4 commands reescritos
- Modify: `.ai/memory/feedback-prompts.md` (se surgirem lições)

Objetivo: testar cada command em cenário real para confirmar que funciona
como esperado e capturar racionalizações do agente para futuro refinamento.

**Nota:** Esta task pode ser executada em sessões futuras, quando os commands
forem usados em projetos reais. Não precisa ser executada imediatamente.

- [ ] **Step 1: Testar hca-save-and-push**

Usar o command ao final de uma sessão de trabalho real. Observar:
- O agente executou git status/diff antes do push? (Iron Law)
- O agente detectou o branch e aplicou HARD-GATE se main?
- O agente separou commits por natureza?
- O agente verificou arquivos sensíveis?

Se o agente pulou algum passo: anotar a racionalização usada.

- [ ] **Step 2: Testar hca-review-plan-internal**

Usar o command num plano real com defeitos conhecidos. Observar:
- O agente usou Read (não revisão mental)?
- O agente citou line numbers para cada item do checklist?
- O loop respeitou o teto de 3 iterações?
- O report final seguiu o formato exigido com contagens?

Se o agente pulou algum passo: anotar a racionalização usada.

- [ ] **Step 3: Testar hca-review-plan-vs-artifacts**

Usar o command num plano com artefatos. Observar:
- O agente listou artefatos no Passo 0 e aguardou confirmação?
- Line numbers cruzados (plano × artefato) foram citados?
- O HARD-GATE para artefatos foi respeitado?

Se o agente pulou algum passo: anotar a racionalização usada.

- [ ] **Step 4: Testar hca-init-memory**

Usar o command num projeto sem memória padronizada. Observar:
- O agente usou Structured Options no passo 2?
- O HARD-GATE para deleção prematura foi respeitado?
- A validação final executou ls/readlink/grep (não apenas "verificou")?
- Confirmação tipada ("remover") foi exigida?

Se o agente pulou algum passo: anotar a racionalização usada.

- [ ] **Step 5: Incorporar lições**

Para cada racionalização capturada nos steps 1-4:
1. Adicionar à tabela de Racionalização do command correspondente
2. Adicionar como Red Flag se for um padrão novo
3. Registrar em `.ai/memory/feedback-prompts.md` se for uma lição genérica

- [ ] **Step 6: Commit**

```bash
git add claude/commands/ .ai/memory/feedback-prompts.md
git commit -m "refactor: refina hca- commands com lições da validação runtime"
```

---

## Notas de Implementação

### Ordem de execução
Task 1 define o template de referência (documentação — pode ser feita em paralelo com Tasks 2-5 se necessário).
Tasks 2-5 contêm conteúdo completo inline e podem ser executadas em qualquer ordem, mas a sequência 2→3→4→5 é recomendada (save-and-push primeiro por ser o mais frágil).
Task 6 depende de Tasks 2-5 estarem completas.
Task 7 depende de Task 6.
Task 8 (validação runtime) pode ser executada em sessões futuras.

### Princípios durante implementação
- Cada step de escrita (Step 2) deve ser seguido de um step de Read (Step 3)
  para verificar o que foi escrito — não confiar em revisão mental
- Commits frequentes — 1 por task, não 1 no final
- Se durante a escrita de um command surgir uma melhoria não prevista
  neste plano: aplicar e registrar na Task 7

### O que NÃO fazer
- Não criar arquivos compartilhados entre commands (cada um é self-contained)
- Não adicionar técnicas marcadas como "não aplicáveis" no plano de melhorias
- Não mudar a lógica/propósito dos commands — só a disciplina e estrutura
- Não remover funcionalidade existente que funciona
