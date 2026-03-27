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
6. **File lists:** arquivos/comandos/scripts listados existem? Execute Glob ou Grep para confirmar — NÃO confie no nome. Se o plano diz "execute X", verifique que X existe. Para arquivos que uma task anterior do plano cria, verifique que a task de criação existe e vem antes.
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
| "O arquivo provavelmente existe, o nome faz sentido" | Nomes que fazem sentido é como bugs se escondem. Execute Glob para confirmar |

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
