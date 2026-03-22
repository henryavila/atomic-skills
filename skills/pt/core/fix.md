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
