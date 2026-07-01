# Padrões — Testing

## Static guards para deleção/rename de símbolos

Quando uma função é deletada ou renomeada e o caminho que a usava é difícil de
exercitar (ex.: prompts interativos do `@clack/prompts`, branches condicionais
raros), os testes de comportamento não pegam regressões. A grep estática contra
o source é uma rede de proteção de baixo custo (<1ms) que captura essa classe
específica de bug.

**Why:** Observado em 2026-05-11 — refatoração de `deduplicateGeminiCodex` para
`normalizeIDESelection` em `src/install.js` deletou a função mas deixou duas
chamadas órfãs no modo interativo (linhas 381/394). Os testes só exercitavam o
modo `--yes`, então o `ReferenceError` em runtime passou silenciosamente. Um
teste de string-search no source teria detectado.

**How to apply:** Após renomear/deletar um helper, adicionar um teste do tipo:
```js
const SRC = readFileSync('src/<file>.js', 'utf8');
assert.ok(!SRC.includes('<deletedSymbol>'), 'Stale reference — use <newSymbol>');
```
Não substitui testes de comportamento, mas é a única defesa prática quando o
caminho problemático é interativo ou raramente coberto. Vale como segundo
mecanismo, não como primeiro.

## Isolar TODAS as fontes externas, não só a óbvia

Um teste é apenas tão hermético quanto a fonte de dado menos isolada. Limpar uma
variável de ambiente (ex.: `LANG`) não basta se a função consulta outra fonte da
mesma natureza (ex.: `Intl.DateTimeFormat().resolvedOptions().locale`).

**Why:** Em 2026-05-11, `tests/detect.test.js` falhava com 3 testes em máquinas
com locale `pt` (apesar de passar em CI com locale `en`). A função `detectLanguage`
consulta LANG **e** Intl como fallback. Os testes só isolavam LANG. Fix: mock de
`Intl.DateTimeFormat` no `beforeEach`/`afterEach` retornando locale fixo `en-US`.

**How to apply:** Ao testar funções que detectam ambiente (locale, OS, arch,
network):
1. Mapear TODAS as fontes que a função consulta (env vars, APIs nativas, FS).
2. Mockar/isolar cada uma no setup, não só a primeira.
3. Adicionar pelo menos um teste que exercita explicitamente o fallback
   (ex.: "LANG vazio + Intl pt → pt") para garantir que o caminho de fallback
   funciona quando o primário falha.

## Novo lazy asset de skill exige contratos de instalação e budget

Quando adicionar um arquivo em `skills/shared/project-assets/` (ou outro asset
copiado para namespaces das IDEs), atualize os testes que fixam a quantidade de
arquivos instalados e inclua um spot-check do novo asset. O `npm test` completo
pega isso via `tests/install.test.js`, mas a suíte focada da feature pode passar
sem perceber o drift.

Também confira `tests/skill-byte-budget.test.js` quando mexer em
`skills/core/project.md`: uma nova linha residente de grammar/dispatch pode
estourar o teto de bytes. Prefira encurtar a superfície residente e deixar o
detalhe no lazy asset, em vez de aumentar o teto.
