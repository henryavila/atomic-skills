Identifique a causa raiz do problema e resolva com TDD.

Se {{ARG_VAR}} foi fornecido, use como descrição do problema.
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

Encontrar um bug significa que mais bugs provavelmente vivem por perto (defect clustering).
Um único teste para o sintoma exato é o mínimo — não a linha de chegada.

## Processo

### Fase 1: Observar

Colete evidências SEM formar hipóteses ainda.

- Leia a descrição do problema (argumento ou pergunta ao usuário)
- Execute os comandos relevantes para reproduzir/observar:
  - Testes: identifique o comando de teste do projeto (verifique `composer.json`,
    `package.json`, `Makefile`, `pyproject.toml` ou `CLAUDE.md`) e execute-o
  - Logs: execute `grep -rn "[mensagem de erro do sintoma]"` nos arquivos relevantes
  - Estado: execute `git log --oneline -5` para ver mudanças recentes
- Leia os arquivos relevantes com a {{READ_TOOL}} — cite line numbers

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
2. Teste: execute um comando via {{BASH_TOOL}} ou leia com a {{READ_TOOL}} para confirmar/refutar
3. Resultado: "Confirmada" ou "Refutada porque [evidência]"

Máximo 5 hipóteses. Se nenhuma for confirmada após 5:
PARE e escale para o usuário — o problema pode ser mais complexo.

Ao confirmar uma hipótese, documente:
> **Causa raiz:** [descrição precisa]
> **Arquivo:** [path:linha]
> **Por que acontece:** [mecanismo — não apenas "está errado"]

### Fase 3: Corrigir com TDD

**3a. Enumerar a superfície de teste:**
ANTES de escrever qualquer teste, leia a função afetada e crie uma Test List:

1. **Teste de regressão**: o caso exato do bug report
2. **Partições de equivalência**: para cada parâmetro de input da função afetada, identifique classes:
   zero, negativo, normal, fronteira, overflow/max — no mínimo um teste por partição relevante
3. **Valores de fronteira**: bordas entre partições (off-by-one, threshold exato, threshold ± 1)
4. **Inputs de erro**: valores que a função deveria rejeitar ou tratar graciosamente

Apresente a Test List ao usuário:
> Test List para [função]:
> 1. [regressão] caso exato reportado: [input] → [esperado]
> 2. [fronteira] [descrição]
> 3. [edge] [descrição]
> ...
> Mínimo 3, típico 5-8. Prosseguir?

Aguarde aprovação do usuário.

**3b. Escrever o teste de regressão:**
- O caso exato do bug report — DEVE FALHAR no estado atual
- Execute o teste — confirme que falha pelo motivo esperado
- Se o teste passa (bug não reproduzido): sua causa raiz está errada.
  Volte à Fase 2. Se já voltou 2 vezes: PARE e escale para o usuário.

**3c. Corrigir o código:**
- Faça a correção mínima necessária para passar o teste de regressão
- Execute o teste — confirme que agora passa
- Execute a suite completa — confirme que não quebrou nada

**3d. Escrever os testes de fronteira e edge:**
Percorra os items restantes da Test List, um teste por vez.
- Cada teste DEVE PASSAR se o fix trata corretamente a causa raiz
- **Se um teste FALHA**, determine a causa:
  - **Relacionado à causa raiz** (mesma classe de bug): o fix foi narrow demais — expanda.
    NÃO estreite o teste para bater com o comportamento quebrado.
  - **Não-relacionado** (bug pré-existente separado): registre como achado separado.
    NÃO tente corrigir agora — está fora do escopo da causa raiz atual. Continue caçando.

**3e. Spot-check via mutação mental:**
Para cada condição no seu fix, pergunte:
- "Se eu trocasse `>=` por `>`, algum teste pegaria?"
- "Se eu removesse esse null check, algum teste pegaria?"
- "Se eu usasse `+` em vez de `-`, algum teste pegaria?"

Se alguma resposta for "não": adicione um teste que pegaria.

**3f. Refatorar (se necessário):**
- Se a correção introduziu duplicação ou código feio: refatore
- Execute os testes novamente após refatorar

### Fase 4: Verificar

- Execute `git diff` — revise as mudanças
- Confirme que a correção é mínima (não toca em código não-relacionado)
- Execute a suite de testes completa uma última vez
- **Checagem de completude** (os três devem ser verdadeiros):
  1. Test List está vazia (todos os items implementados)
  2. Cada partição de input tem pelo menos um teste
  3. Mutação mental não encontrou casos não-cobertos

## Red Flags

- "Já sei o que é, vou corrigir direto"
- "É óbvio, não preciso de teste para isso"
- "Vou corrigir e testar depois"
- "O teste é difícil de escrever, vou testar manualmente"
- "Vou aproveitar e refatorar esse módulo todo"
- "A suite de testes demora, vou rodar só o teste que escrevi"
- "Um teste para o bug exato é suficiente"
- "Os testes de fronteira são exagero, o fix é simples"
- "O teste falhou após meu fix — vou estreitar o teste"

Se pensou qualquer item acima: PARE. Volte à fase que estava pulando.

## Racionalização

| Tentação | Realidade |
|----------|-----------|
| "A causa é óbvia" | Óbvia para quem? Documente e prove com evidência |
| "Não preciso de teste, é uma mudança pequena" | Mudanças pequenas quebram coisas grandes. HARD-GATE |
| "Vou corrigir primeiro, testo depois" | TDD invertido não é TDD — é esperança |
| "A suite é grande demais para rodar inteira" | Rodar parcial = não saber se quebrou algo |
| "Já tentei 5 hipóteses, vou chutar a 6ª" | 5 falhas = escale para o usuário, não chute |
| "Um teste de regressão é suficiente" | Um teste pega um caso. Bugs se agrupam — se achou um, há mais por perto |
| "O teste de fronteira falhou, vou ajustar o teste" | Se o código não bate com a spec na fronteira, é um SEGUNDO bug — corrija o código, não o teste |
| "Vou pular a Test List, o bug é simples" | Bugs simples têm irmãos simples. Liste-os ou perca-os |

## Encerramento

Reporte:
- Problema: [descrição original]
- Causa raiz: [arquivo:linha — descrição]
- Hipóteses testadas: [quantidade, quais foram refutadas]
- Testes criados: [quantidade] (regressão: 1, fronteira: N, edge: N)
- Correção: [resumo da mudança]
- Test List completude: [todos os items feitos / N restantes]
- Mutação mental: [N condições checadas, N testes adicionados]
- Suite completa: [passou/falhou]
