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

## Lifecycle E2E deve afirmar estado pós-transição

Em testes que simulam transições de lifecycle, não basta checar a lista inicial
de arquivos emitida pelo setup. Depois que a ação sob teste roda, asserte o
estado mutado no filesystem/frontmatter resultante.

**Why:** Em 2026-07-01, o E2E de materialização lazy checava que F2 continuava
descriptor-only olhando o array inicial de `materializeDecomposition`. Se o fluxo
de ativação de F1 escrevesse `phases/f2-*.md` por acidente, o teste continuaria
verde porque a lista pré-ação não mudaria. A revisão local pegou esse
falso-verde antes do fechamento da fase.

**How to apply:** Em testes de `phase-done`, `switch`, `phase-reopen`,
`materialize` ou fluxos similares:
1. Execute a transição.
2. Releia o frontmatter ou consulte o filesystem produzido pela transição.
3. Asserte presença/ausência de arquivos e campos no estado pós-ação, não em
   estruturas capturadas antes da ação.

## Hooks e testes de ambiente precisam de HOME isolado

Hooks de sessão podem ler arquivos globais do usuário (`~/.atomic-skills/env`,
`~/.aideck/env`, package-root etc.). Se a suíte usa o HOME real, um estado local
válido da máquina do Henry pode contaminar um teste que esperava contexto vazio.

**Why:** Em 2026-07-03, `tests/hooks/session-start.test.sh` falhou localmente no
caso "sem .atomic-skills/" porque o hook injetou "Dashboard running" a partir de
`~/.atomic-skills/env`. A lógica estava correta; o teste não isolava todas as
fontes externas.

**How to apply:** Ao rodar ou criar testes de hooks, envolver a suíte com HOME
temporário quando o teste não quer ler estado global:

```bash
tmp_home=$(mktemp -d)
HOME="$tmp_home" npm run test:hooks
```

Quando um teste precisa exercitar o env global, crie explicitamente o arquivo no
HOME temporário dentro do próprio caso.

## Runtime artifacts precisam testar recuperação de journals antigos

Efeitos de runtime que usam journal como prova de ownership precisam cobrir não
só install limpo e update atual, mas também estados históricos defeituosos que
podem existir no `$HOME` do usuário. Se um journal antigo perdeu ownership
(`stageRuntimeArtifacts.beforeState.created: []`) mas o arquivo em disco é
byte-a-byte igual ao artefato desejado, o update pode adotar esse arquivo com
segurança; se os bytes divergem, continua sendo conflito de usuário.

**Why:** Em 2026-07-08, `node bin/cli.js install` falhou com
`stageRuntimeArtifacts conflict` para `.atomic-skills/hooks/version-check.sh`.
O arquivo no disco era idêntico ao source, mas o manifest tinha `created: []`;
o efeito só aceitava `!existedBefore` ou `previous.created`, então bloqueava a
recuperação de um artefato nosso deixado por journal antigo.

**How to apply:** Ao alterar efeitos runtime:
1. Adicionar teste de regressão de integração com manifest antigo realista.
2. Adicionar teste unitário para adoção byte-idêntica de arquivo único.
3. Manter teste de conflito para bytes diferentes, provando que user-owned não
   é sobrescrito.
4. Não aplicar a adoção a `sourceTree`; árvore precisa continuar exigindo
   ownership explícito para evitar apagar diretórios de usuário.

## Run records de rollback registram antes da escrita canônica

Fluxos resumíveis que prometem rollback por `filesWritten` precisam persistir o
alvo antes de tentar escrever o arquivo canônico. Registrar só depois da escrita
abre uma janela de crash/interrupção em que o arquivo existe mas o run record não
consegue removê-lo no resume.

**Why:** Em 2026-07-03, o review de `project-create-plan.md` encontrou a
instrução "write file, then append to filesWritten". Isso contradizia a regra de
não inferir metade-criada por scan de `.atomic-skills/projects/`.

**How to apply:** Para cada path materializado:
1. Calcule `filesPlanned`.
2. Antes da escrita canônica, adicione o path a `filesWritten` e persista o run
   record.
3. Escreva o arquivo.
4. No rollback/resume, delete exatamente `filesWritten`; deletar path
   registrado mas não criado é no-op aceitável, arquivo criado sem registro é
   proibido.

Regressão útil: teste textual/estrutural que falha se o skill voltar a instruir
"write then append". Para scripts executáveis, preferir teste de fault-injection
entre registro e escrita.

## Round-trip feliz não prova atomicidade do installer

Um installer orientado a effects precisa ser testado em cada boundary, não só no
caminho em que todos os effects terminam. Se o file-set é aplicado antes de um
hook/jsonMerge e o manifest só fica durável no final, uma falha tardia deixa
arquivos sem ownership. Em update, o retry ainda pode confundir bytes já
atualizados com edição local e perpetuar resíduos.

**Como aplicar:** para fresh install e update, injete falha após cada effect e
asserte quatro estados:

1. a falha não deixa mutação sem journal recuperável;
2. reparar a causa e repetir é idempotente;
3. `currentHash === desiredHash` é re-adotado pelo novo journal;
4. uninstall após o retry retorna HOME e repo ao baseline byte a byte.

Também faça o contador exibido pelo uninstall derivar das remoções observadas,
não da quantidade de entradas que existia no manifest.

## Closure renderizado precisa de oracle independente

Contagem fixa de arquivos, spot-check de alguns assets ou "provider novo reproduz
provider antigo" não provam que a instalação entrega tudo que as skills citam.
Uma omissão compartilhada pelos dois lados passa verde.

**Como aplicar:** para cada IDE pública e scope, renderize numa instalação
temporária, extraia todas as referências locais acionáveis e exija que cada uma
resolva dentro do file-set/runtime instalado. Rode o smoke a partir de um repo
consumidor sem `skills/`, `src/` ou `node_modules` do checkout atomic-skills.
Falhe também em destination collisions e em níveis de diretório ignorados.
