# Bash embutido em skill bodies — portabilidade de shell (zsh/nullglob)

Snippets bash dentro de skill `.md` NÃO rodam necessariamente em bash: o Bash tool
do Claude Code nesta máquina executa **zsh 5.9** e o shell-snapshot da sessão faz
**`setopt nullglob`**.

## A armadilha

`if ls "$DIR/"*.md >/dev/null 2>&1` para testar "existe algum .md":

- **zsh + nullglob**: glob sem match expande para NADA → vira `ls` puro (lista o
  CWD, exit 0) → **falso positivo silencioso**. Foi exatamente isso que desarmou o
  Legacy-layout gate do project-view (2026-06: flat-only e nested-only ambos
  retornavam `LEGACY_FLAT=1 NESTED_TREE=1`).
- **zsh sem nullglob**: aborta com `zsh: no matches found` no stderr (o
  `2>/dev/null` não cobre — o erro é do shell, antes do exec).
- Só bash puro se comporta como o autor imaginou.

## O padrão correto

Detecção de existência **glob-free** via `find`:

```bash
[ -n "$(find "$DIR" -maxdepth 1 -name '*.md' -print -quit 2>/dev/null)" ]
```

Silencioso e correto em bash, zsh e zsh+nullglob. `-print -quit` para no primeiro
match (barato). Regression guard: `tests/project.test.js` ("gates the dashboard
open on a legacy flat tree") afere `-print -quit` e rejeita o padrão `ls <glob>`.

**Regra geral**: todo bash embutido em skill body deve ser POSIX-conservador —
sem glob em posição de comando/teste, sem bashismos que zsh trate diferente.
Teste empiricamente com `zsh -c 'setopt nullglob; …'` nos cenários match/no-match.

Relacionado: [[reference-readme-generator-contract]] (re-render obrigatório após
mudar skill source: `node bin/cli.js install --yes`).
