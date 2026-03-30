Faça uma análise adversária do plano $ARGUMENTS
comparando-o contra seus artefatos de origem (PRD, specs, designs).

## Regra Fundamental

NO APPROVAL WITHOUT CROSS-REFERENCE.
Cada requirement dos artefatos deve ter correspondência verificável no plano,
com line numbers de AMBOS os documentos como prova.

<HARD-GATE>
Esta skill corrige o PLANO, NUNCA os artefatos de origem.
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
Leia o plano com a ferramenta {{READ_TOOL}}. Identifique todos os artefatos listados
em "Source Documents", "References", ou equivalente.

Para CADA artefato, execute {{READ_TOOL}} e registre:
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
2. Leia o plano CORRIGIDO com a ferramenta {{READ_TOOL}}. Cite line numbers.
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
- "Já verifiquei cruzando mentalmente, não preciso do {{READ_TOOL}}"
- "Vou editar o artefato para ficar consistente com o plano"

Se pensou qualquer item acima: PARE. Volte ao passo que estava pulando.

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "O plano cobre todos os requirements" | Prove com line numbers cruzados |
| "Esse artefato não é relevante" | Se foi listado como source, é relevante — leia |
| "Vou ler o artefato por alto" | Ler por alto = perder requirements. {{READ_TOOL}} completo |
| "Divergência intencional, não preciso documentar" | Se não está documentada, não é intencional |
| "Editar o artefato é mais rápido" | HARD-GATE: nunca edite artefatos |

## Encerramento

### Resumo da Análise Cruzada

**Artefatos analisados:** [lista com paths]
**Iterações realizadas:** [N]
**Chamadas {{READ_TOOL}} executadas:** [N] (plano: X, artefatos: Y)
**Total de achados:** [N] (críticos: X, significativos: Y, menores: Z)

| # | Achado | Artefato:linha | Plano:linha | Correção | Severidade |
|---|--------|---------------|-------------|----------|------------|
| 1 | [resumo] | prd.md:42 | plan.md:108 | [correção] | crítico |

**Alignment notes adicionadas:** [N]
**Status final:** [Plano aprovado / Plano com ressalvas / Escalado para usuário]
