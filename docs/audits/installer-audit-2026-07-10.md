# Auditoria — installer (2026-07-10)

> Auditoria adversarial somente leitura do fluxo de install/update/uninstall,
> renderer, file-set, runtime global, registry, auto-update, status, pacote npm e
> testes. As hipóteses principais foram reproduzidas em instalações temporárias
> limpas e comparadas com a instalação user-scope real. Complementa
> `docs/audits/project-implement-audit-2026-07-10.md`.

## Veredito

Sim: o installer é causa direta de parte relevante dos erros observados.

Há três classes distintas que não devem ser misturadas:

1. **bugs reproduzíveis numa instalação limpa:** falta de atomicidade, colisão do
   diretório de instalação com o sentinel de setup do `project`, dependências
   runtime que não entram no file-set e renderização Codex com perfil Claude;
2. **instalação real defasada/mista:** 21 assets diferem do HEAD, o runtime global
   aponta para um checkout mutável e o registry contém um owner inexistente;
3. **bugs das próprias skills:** imports `./src/*`, contrato
   `Files`/`scopeBoundary` e bypass de verifier em `phase-done` continuam quebrados
   mesmo depois de uma instalação limpa correta.

Uma reinstalação do HEAD atualizaria 20 dos 21 assets defasados da instalação
real. Ela **não** corrige os defeitos estruturais do installer nem os bugs de
semântica das skills.

## Matriz de causalidade

| Sintoma | Classificação | Reproduz em instalação limpa? | Reinstall resolve? |
|---|---|---:|---:|
| instalação falha e deixa dezenas de arquivos sem manifest | installer/kernel | sim | não, pode piorar no retry |
| `project` pula setup após install `--project` | contrato installer + skill | sim | não |
| `implement` não encontra worktree/Mode 2/antipatterns | file-set + referências da skill | sim | não |
| Codex recebe `Bash`, `Read tool` e `Agent` | renderer | sim | não |
| Codex-only ganha `.claude/settings.json`, mas nenhum hook Codex | runtime provider | sim | não |
| projeto antigo pode trocar runtime de user install novo | runtime global/registry | sim | não |
| 7 assets por IDE não correspondem ao HEAD atual | snapshot local defasado | não | em geral, sim |
| `status` diz “up to date” apesar de assets stale/modified | status/observabilidade | sim | não |
| imports `./src/decompose.js`, `bootstrap.js`, `links-sidecar.js` falham no consumidor | skill | sim | não |
| `Files` inexistente, `scopeBoundary` invertido, `phase-done` sem verifier | skill/state machine | sim | não |

## Achados críticos

### C1 — install/update não são transacionais

O driver de `@henryavila/minimalist-installer@0.1.0` aplica todos os effects em
sequência e só grava o manifest no final:

- `node_modules/@henryavila/minimalist-installer/src/driver.js:44-58` executa
  `effect.apply()` dentro do loop e chama `writeManifest()` depois dele;
- o primeiro effect é o file-set inteiro
  (`src/providers/skills-provider.js:17-22`);
- os effects seguintes podem falhar no hook ou no merge de JSON
  (`src/runtime-layers/auto-update.js:31-49`);
- `src/install.js:348-353` não preflighta nem faz rollback.

#### Reprodução: fresh install com conflito tardio

Foi pré-criado um hook não pertencente ao installer e executado um install
Codex project-scope. Resultado:

```json
{
  "error": "stageRuntimeArtifacts conflict: refusing to replace non-owned path \".atomic-skills/hooks/version-check.sh\"",
  "fileCountAfterFailure": 73,
  "manifestExists": false,
  "implementSkillExists": true,
  "userHookPreserved": true
}
```

O file-set já estava no destino, mas não havia journal que permitisse ao
uninstaller reconhecê-lo ou revertê-lo. Um teste equivalente pela CLI deixou 74
arquivos porque o fixture incluía um arquivo adicional do repo temporário.

#### Reprodução: update falha, retry adota ownership incorreto

1. instalou-se a versão V1;
2. o source desejado mudou para V2;
3. `.claude/settings.json` foi tornado inválido;
4. o update escreveu V2 pelo `reconcileFileSet`, depois falhou no `jsonMerge`;
5. o manifest V1 permaneceu;
6. após reparar o JSON, o retry terminou com sucesso;
7. o uninstall deixou o arquivo V2 para trás.

Resultado reduzido:

```json
{
  "firstUpdateFailedParsingJson": true,
  "fileChangedToV2BeforeFailure": true,
  "retryTrackedHashMatchesDisk": false,
  "leftoverAfterSuccessfulRetryAndUninstall": true
}
```

A causa secundária está em
`node_modules/@henryavila/minimalist-installer/src/kernel/reconciler.js:77-87`:
se `currentHash != previousInstalledHash`, o arquivo é classificado como edição
local, mesmo quando `currentHash == newDesiredHash`. O retry mantém no journal o
hash V1 e o uninstall, corretamente seguindo esse journal incorreto, preserva V2
como se fosse conteúdo do usuário.

**Impacto:** install parcialmente aplicado sem ownership, update com manifest
antigo, retries não idempotentes, uninstall com resíduos e UI que pode anunciar
sucesso sobre estado não recuperável.

O número anunciado pelo uninstall também não é observação do que foi apagado:
`src/uninstall.js:107,144` imprime a quantidade de chaves do manifest. Na
reprodução update→retry ele informou “73 files removed” mesmo com dois assets
instalados ainda presentes.

**Correção sugerida:**

- adicionar preflight side-effect-free de todos os effects;
- executar writes por staging + commit atômico, ou manter backups suficientes
  para rollback real em ordem inversa;
- tornar cada effect internamente atômico — não apenas a sequência externa;
- no reconciler, tratar `currentHash == newDesiredHash` como desired já aplicado
  e registrar o hash novo;
- persistir um estado de recuperação durável antes de começar a mutação;
- adicionar fault injection em cada boundary de effect.

O teste obrigatório é `baseline → falha no effect N → retry → uninstall`, tanto
para greenfield quanto update, exigindo igualdade byte a byte com o baseline.

### C2 — install project-scope cria o mesmo sentinel usado para detectar setup

O ledger do installer e o estado do produto compartilham `.atomic-skills/`:

- `src/manifest.js` define o manifest dentro de `.atomic-skills/`;
- o auto-update também grava `.atomic-skills/hooks/version-check.sh`;
- `skills/core/project.md:51,67-73` interpreta apenas a existência do diretório
  como prova de que o setup já ocorreu;
- `project-create-plan.md:20` e `project-create-initiative.md:9` repetem a mesma
  suposição.

Uma instalação project-scope limpa produziu:

```json
{
  ".atomic-skills/": true,
  "manifest.json": true,
  "hooks/version-check.sh": true,
  "projects/": false,
  "config.json": false
}
```

Portanto, a primeira invocação de `project` vê `.atomic-skills/`, não entra em
setup e tenta operar sobre um estado canônico que não existe.

**Impacto:** o caminho recomendado `install --project → usar project` já nasce
num estado que o router interpreta incorretamente.

**Correção sugerida:** detectar setup por um sentinel canônico forte — por
exemplo `config.json` mais um `PROJECT-STATUS.md`/`projects/*` válido — e nunca
pela mera existência do diretório. A separação mais segura é manter o ledger do
installer em um namespace/subdiretório que não sinalize lifecycle de produto.

### C3 — o file-set não fecha as dependências runtime das skills

`computeSkillsFileSet()` instala somente diretórios `<owner>-assets/` cujo owner
está registrado como core skill ou module
(`src/providers/skills-file-set.js:101-142`). Arquivos shared soltos e assets sem
owner registrado ficam fora.

Numa instalação Codex limpa, estes contratos obrigatórios não existem em nenhum
destino instalado:

```text
skills/shared/worktree-isolation.md
skills/shared/mode2-codex-lane.md
skills/shared/implement-antipatterns.md
skills/shared/debug-techniques.md
skills/shared/local-review-assets/diff-capture.md
skills/shared/local-review-assets/briefing-template.txt
```

Além da omissão física, as skills apontam para paths de source. Uma varredura do
file-set Codex renderizado encontrou **16 referências únicas
`skills/shared/...` em 14 arquivos instalados**. Mesmo assets que foram copiados
para `{{ASSETS_PATH}}` continuam sendo citados pelo path original, que não existe
no repositório consumidor.

Isso afeta, entre outras, `implement`, `project`, `fix`, `review-code`,
`review-plan`, `hunt`, `brainstorm`, `debate` e `parallel-dispatch`.

**Impacto:** passos declarados obrigatórios não podem ser carregados justamente
fora do checkout de desenvolvimento. O pacote npm contém os arquivos-fonte, mas
o installer não os materializa no namespace consumível.

**Correção sugerida:** registrar dependências explícitas por skill, mover os
helpers para asset groups instaláveis, renderizar toda referência runtime via
`{{ASSETS_PATH}}` e preservar uma hierarquia sem colisões. Um closure validator
pós-render deve falhar a build se qualquer `READ`/path local não resolver dentro
do file-set desejado para cada IDE e scope.

## Achados altos

### H1 — Codex e outros hosts não-Gemini recebem o perfil de ferramentas Claude

`src/render.js:37-62` possui um branch Gemini e um fallback Claude. Codex,
Cursor, OpenCode e GitHub Copilot entram no fallback:

```text
BASH_TOOL         → Bash
READ_TOOL         → Read tool
WRITE_TOOL        → Write tool
INVESTIGATOR_TOOL → Agent
ARG_VAR           → $ARGUMENTS
```

Uma instalação Codex limpa confirmou esses literais nos SKILL.md renderizados.
A abstração dos templates está correta; o adapter que concretiza a abstração é
que não modela os hosts anunciados.

**Impacto:** instruções não nativas, dispatch ambíguo e falsa promessa de
compatibilidade equivalente entre IDEs.

**Correção sugerida:** perfis explícitos e testados por host; nenhum fallback
silencioso. Cada IDE público precisa de snapshots dos tokens renderizados e um
teste operacional mínimo.

### H2 — runtime global é singleton last-writer-wins

Toda instalação chama `installRuntimeArtifacts()` e sobrescreve
`~/.atomic-skills/package-root` com o `PACKAGE_ROOT` do processo atual
(`src/install.js:123-132,530-537,673-675`). O registry guarda apenas strings de
`basePath` (`src/install.js:149-155`), sem versão, fingerprint ou package root.

Reprodução com dois owners:

1. user-scope instalado a partir do HEAD;
2. project-scope instalado a partir de um pacote antigo;
3. `package-root` passou a apontar para o pacote antigo;
4. o project-scope antigo foi desinstalado;
5. o user manifest novo continuou presente, mas `package-root` continuou antigo.

O uninstall com owners restantes não reeleige nem restageia o runtime
(`src/uninstall.js:127-142`). Em instalações via npx, o path também pode apontar
para cache efêmero.

**Impacto:** skills novas podem executar scripts, schemas e dependências antigos;
o resultado depende da ordem das instalações e da sobrevivência de um cache
externo, não do manifest da skill invocada.

**Correção sugerida:** runtime versionado por owner/fingerprint ou resolução
scope-local. O registry deve guardar ao menos
`{basePath, packageRoot, version, fingerprint}` e restaurar um owner válido quando
o last writer sai.

### H3 — registry aceita owners fantasma e não reconcilia o mundo real

O registry real contém atualmente:

```text
/Users/henry                                            exists + manifest
/Volumes/External/code/atomic-skills/.worktrees/dogfood-materialize-f1
                                                        inexistente, sem manifest
```

`registerInstall()` e `unregisterInstall()` apenas adicionam/filtram strings
(`src/install.js:149-174`). Não há prune por existência de base/manifest. Um
owner removido fora do uninstaller mantém o refcount artificialmente acima de
zero e pode impedir para sempre a limpeza do runtime compartilhado.

Além disso, JSON inválido é capturado silenciosamente como registry vazio. Isso
pode produzir o efeito oposto: remover runtime ainda usado por instalações
reais.

**Correção sugerida:** reconciliação sob lock, schema/version do registry,
quarentena explícita para corrupção e prune seguro de owners sem manifest.

### H4 — auto-update é Claude-only mesmo em instalação Codex-only e erra o scope

`createAutoUpdateRuntimeProvider()` ignora `config.ides` e sempre faz merge em
`.claude/settings.json` (`src/runtime-layers/auto-update.js:21-50`). Fresh install
com apenas Codex produziu:

```json
{
  "codexSkill": true,
  ".claude/settings.json": true,
  ".codex/hooks.json": false
}
```

Assim, Codex não executa o check e ainda recebe uma mutação de configuração de
outro host.

O script detecta corretamente `SCOPE=project`, mas sempre recomenda
`npx -y @henryavila/atomic-skills@latest install --yes`
(`skills/shared/auto-update-hook/version-check.sh:12-23,74-81`). Sem `--project`,
o comando atualiza user-scope e deixa o project-scope que disparou o alerta
intocado.

**Correção sugerida:** adapters de hook condicionais por IDE e mensagem
scope-aware; teste Codex-only deve provar zero mutações Claude e o alerta de
project-scope deve incluir `--project`.

### H5 — `status` produz falso verde e a UI esconde conflitos preservados

`src/status.js:68-72` define “up to date” comparando apenas o semver do manifest
com o `package.json` do processo. Em `:81-103`, verifica somente existência dos
paths sob `IDE_CONFIG[id].dir`; os shared assets ficam num diretório irmão e não
entram na contagem. Hashes nunca são comparados.

Na instalação real:

- manifest: v2.0.0, atualizado em 2026-07-08;
- HEAD local: ainda v2.0.0;
- 21 paths stale = 7 assets × 3 IDEs;
- 20 ainda batem o hash do journal e são apenas um snapshot antigo;
- `~/.claude/atomic-skills/_assets/project-finalize.md` difere também do journal
  e é preservado como modificação local;
- o comando ainda mostra `v2.0.0 (up to date)` e ✓ para Claude, Codex e Cursor.

`installSkills()` também monta o resumo a partir de todo o desired set
(`src/install.js:379-399`), inclusive itens que o reconciler decidiu preservar.
Não há lista de `updated`, `unchanged`, `preserved` ou `conflict` para o usuário.

**Impacto:** não há como distinguir instalação atual, source same-version
defasado, asset alterado ou partial update apenas pelo comando oficial.

**Correção sugerida:** `status --verify` deve verificar todo o manifest — skills,
assets e hooks — e reportar `missing`, `modified`, `stale` e runtime mismatch. O
install deve devolver/classificar decisões do reconciler, não apenas o desired.

### H6 — runtime global e registry estão fora da transação do manifest

`src/installer.js:22-26` documenta que
`~/.atomic-skills/{bin,dashboard,aideck-consumer,src,package-root}` e o registry
ficam fora do journal. `src/install.js:530-537,673-675` primeiro conclui o
file-set, depois muta o runtime e por último registra o owner.

Uma falha entre esses passos pode deixar:

- manifest válido sem runtime/owner;
- runtime sobrescrito sem owner registrado;
- owner registrado para runtime incompleto;
- dois manifests dependentes de um singleton cujo conteúdo não pertence a
  nenhum deles de forma verificável.

**Correção sugerida:** incluir a aquisição/seleção do runtime numa transação
durável e refcountada, com lock e recuperação, ou eliminar o singleton em favor
de runtime imutável por versão.

## Achados médios

### M1 — colisões de destino são descartadas silenciosamente

O helper `add()` em `src/providers/skills-file-set.js:59-66` retorna quando um
path já está em `seen`. Como todos os asset groups são achatados em um mesmo
`_assets/`, duas origens com o mesmo basename podem fazer a segunda desaparecer
sem erro. Não foi encontrada colisão ativa no conjunto atual, mas o mecanismo
transforma uma futura colisão em perda silenciosa.

### M2 — recursão de assets é limitada a um nível

`src/providers/skills-file-set.js:119-131` visita somente arquivos diretamente
dentro de um subdiretório. Profundidade maior é ignorada sem diagnóstico. O
file-set deve recursar de forma geral ou rejeitar a estrutura no validation gate.

### M3 — artefatos prometidos não fazem parte do pacote consumível

`package.json:9-18` exclui `docs/`. Por isso o fluxo `project help --html`, que
espera `docs/design/project-onboarding/index.html`, não pode funcionar a partir
do pacote publicado. O installer também copia apenas
`src/provision-consumer.js` para `~/.atomic-skills/src/`
(`src/install.js:116-121`), enquanto algumas skills procuram outros módulos
nessa pasta.

O segundo caso é responsabilidade compartilhada: o runtime pretende que módulos
e dependências sejam carregados por `package-root`, mas as skills não seguem o
resolver de forma consistente.

### M4 — project install→uninstall deixa resíduo global vazio

Um ciclo real em HOME e Git repo temporários retornou exit 0 no install e no
uninstall, mas terminou assim:

```json
{
  "homeEntries": [".atomic-skills/"],
  "homeAtomicSkillsExists": true,
  "homeAtomicSkillsEmpty": true
}
```

O project-scope install cria runtime global no HOME; `removeRuntimeArtifacts()`
remove seu conteúdo quando o último owner sai, mas o fluxo de
`src/uninstall.js:136-142` só tenta podar o state dir relativo ao `basePath` do
projeto. Isso viola a regra de paridade install/uninstall mesmo que o resíduo
seja apenas um diretório vazio.

## O que está sólido

Nem todo o installer está quebrado. Os seguintes controles foram revalidados:

- **64/64 testes focados passaram** para install, providers, runtime effects,
  refcount e install→update→uninstall;
- o reconciler preserva arquivos realmente modificados pelo usuário;
- uninstall respeita ownership e evita deleção sem prova;
- install→uninstall normal retorna ao baseline nos casos cobertos;
- effects recusam paths que escapam do basePath;
- o tarball npm inclui `skills/`, `src/`, `scripts/`, `meta/` e os helpers shared
  soltos — a omissão dos helpers acontece no file-set de instalação, não no pack.

Esses controles explicam por que a suíte fica verde, mas não cobrem falha no
effect N, retry após partial apply, closure de referências, matriz multi-versão
ou a instalação real fora dos fixtures.

## Gaps de teste que permitiram os falsos verdes

1. **Atomicidade:** não existe fault injection após cada effect e cada write.
2. **Retry:** não há `failed update → repaired cause → retry → uninstall`.
3. **Closure:** nenhum teste extrai referências locais do conteúdo renderizado e
   exige um destino correspondente.
4. **Oracle independente:** provider parity compara o file-set novo com a mesma
   definição de footprint; a ausência pode existir nos dois lados e passar.
5. **Consumer real:** não há smoke test executando cada skill instalada a partir
   de um repo sem `skills/`, `src/` ou `node_modules` do atomic-skills.
6. **IDE isolation:** não se prova que uma seleção Codex-only deixa configs Claude
   intocadas.
7. **Multi-owner/multi-version:** o refcount é testado com strings, não com
   runtimes divergentes e ordens diferentes de install/uninstall.
8. **Status:** só se verifica presença de skill bodies, não hashes de todos os
   assets/runtime.
9. **Project-scope lifecycle:** falta o E2E `install --project → invoke project →
   first-time setup`.

## Ordem recomendada de correção

### P0 — impedir corrupção/estado parcial

1. Tornar install/update atômicos e recuperáveis.
2. Corrigir retry quando `currentHash == desiredHash`.
3. Adicionar fault-injection E2E e verificação byte a byte do baseline.

### P0 — restaurar o contrato runtime das skills

4. Separar o sentinel de setup do ledger de instalação.
5. Definir closure explícita de assets e reescrever referências para
   `{{ASSETS_PATH}}`.
6. Bloquear build/install quando uma referência renderizada não resolver.

### P1 — eliminar mistura entre hosts e versões

7. Criar perfis de renderer e hooks por IDE.
8. Versionar o runtime por owner/fingerprint ou torná-lo scope-local.
9. Tornar registry schema-validado, locked e auto-reconciliável.
10. Fazer auto-update respeitar IDE e scope.

### P1 — tornar divergência observável

11. Adicionar verificação de hashes/fingerprint ao `status`.
12. Reportar decisões `updated/unchanged/preserved/conflict` no install.
13. Detectar source drift same-version em instalações locais/development.

### P2 — completar a superfície publicada

14. Entregar o guia HTML ou remover/alterar a promessa.
15. Falhar em colisões de destino e suportar/rejeitar profundidade arbitrária de
    assets explicitamente.
16. Remover o diretório global vazio no último project-scope uninstall e cobrir o
    HOME, não apenas o repo, no teste de round-trip.

## Conclusão operacional

O estado atual não pode ser explicado apenas por “esquecer de reinstalar”. Há
staleness real que uma reinstalação corrigiria, mas também há bugs fresh-install
e uma falha transacional capaz de criar resíduos precisamente durante tentativas
de atualização.

Para diagnosticar qualquer erro específico daqui em diante, a ordem segura é:

1. verificar manifest + hashes + runtime owner, não apenas semver;
2. reproduzir em HOME/repo temporários sem checkout `atomic-skills` no CWD;
3. confirmar closure de cada asset lido pela skill;
4. só então atribuir o restante à lógica de `project`/`implement`.

Nenhuma instalação real foi alterada durante esta auditoria.
