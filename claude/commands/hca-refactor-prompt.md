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
