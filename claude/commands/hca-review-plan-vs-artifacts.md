Faça uma análise adversária do plano $ARGUMENTS
contra seus artefatos de origem.

Passos:
1. Leia o plano e identifique os artefatos listados em "Source Documents" ou equivalente
2. Execute o checklist abaixo contra cada artefato

Checklist:
1. Cobertura: todo FR, NFR e Story dos artefatos tem task no plano?
2. Acceptance criteria: tasks resumidas demais vs ACs dos epics?
3. Phase gates: cada critério de gate do PRD tem step concreto no plano?
4. Dependências: grafo de fases bate com o grafo dos epics?
5. Schema/API: migrations e endpoints batem com architecture?
6. UX: componentes, estados, tokens e responsive batem com UX spec?

Regras:
- Corrija o PLANO (não os artefatos)
- Documente divergências intencionais nos alignment notes
- Classifique: crítico/significativo/menor
- Pergunte só se ambíguo

Processo (OBRIGATÓRIO — não pule iterações):
1. Leia o plano inteiro e aplique o checklist contra os artefatos. Corrija os erros encontrados.
2. Releia o plano CORRIGIDO do início. Verifique se:
   - As correções não introduziram novos problemas
   - Algo escapou na passada anterior
3. Se encontrou novos erros, corrija e volte ao passo 2.
4. Se a releitura não encontrou nada, a revisão está completa.
5. Apresente a tabela resumo com TODOS os achados e correções de TODAS as iterações.
   Inclua quantas iterações foram necessárias.
