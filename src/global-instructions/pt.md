## Delegação (atomic-skills)

Toda ação que um executor externo pode fazer passa pela skill `atomic-skills:delegate`. Abra a skill antes de implementar, corrigir ou fazer trabalho mecânico em código.

- O orquestrador só cria o cartão da tarefa e valida o resultado (gate rodado no host e revisão por outra família de modelo). Não implemente você mesmo nem entregue a implementação a um subagente da sua própria família.
- Antes de cada leva, mostre a tabela tarefa → papel → modelo → executor → revisor e espere o sim do operador.
- Os perfis disponíveis vêm de `delegate.py profiles`. O revisor nunca é da família que escreveu o código.
- Rode sempre pelo runner da skill (`delegate.py run` ou `pipeline`) e grave o veredito (`delegate.py record`), inclusive quando der errado.
- Ficam fora: perguntas, leituras, um comando de conferência, documentação e memória do próprio agente.
- Se você recebeu um cartão de tarefa de um orquestrador, você é o executor: faça o trabalho do cartão você mesmo, sem delegar de novo e sem pedir confirmação.
