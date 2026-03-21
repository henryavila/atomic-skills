Faça uma análise adversária do plano $ARGUMENTS
procurando erros internos, gaps e inconsistências.

Checklist:
1. Contradições: uma task diz X, outra diz Y?
2. Dependências quebradas: task referencia arquivo/modelo que nenhuma task cria?
3. Ordenação: alguma task depende de algo que ainda não foi feito?
4. Ambiguidade: alguma task é vaga demais para implementar sem adivinhar?
5. Schema: migrations dentro do plano são consistentes entre si?
6. File lists: arquivos listados existem ou serão criados por task anterior?
7. Test coverage: tasks com código novo mas sem menção a testes?

Regras:
- Corrija o plano diretamente
- Classifique: crítico/significativo/menor
- Pergunte só se ambíguo

Processo (OBRIGATÓRIO — não pule iterações):
1. Leia o plano inteiro e aplique o checklist. Corrija os erros encontrados.
2. Releia o plano CORRIGIDO do início. Verifique se:
   - As correções não introduziram novos problemas
   - Algo escapou na passada anterior
3. Se encontrou novos erros, corrija e volte ao passo 2.
4. Se a releitura não encontrou nada, a revisão está completa.
5. Apresente a tabela resumo com TODOS os achados e correções de TODAS as iterações.
   Inclua quantas iterações foram necessárias.
