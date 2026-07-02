---
name: reference-git-worktree-external-volume-remount
description: Linked worktrees on external macOS volumes can retain absolute gitdir paths when the volume remounts with a numeric suffix.
metadata:
  type: reference
---

# Git worktree em volume externo remontado: reparar `gitdir` absoluto

**Contexto:** em 2026-07-01, o worktree `phase-materialization` existia em
`/Volumes/External/code/...`, mas o macOS remontou o disco como `/Volumes/External 1/...`.
O diretório de arquivos ainda estava acessível, porém `git status` dentro do worktree
falhava com "Not a git repository".

**Causa:** linked worktrees gravam caminhos absolutos em dois lados:

- `<worktree>/.git` aponta para `<main-repo>/.git/worktrees/<name>`.
- `<main-repo>/.git/worktrees/<name>/gitdir` aponta de volta para `<worktree>/.git`.

Quando o prefixo `/Volumes/...` muda, esses ponteiros continuam com o caminho antigo.
`git worktree repair <path>` pode não corrigir todos os ponteiros nesse cenário.

**Correção validada:** editar os dois arquivos de metadados locais para o novo prefixo
real antes de qualquer operação Git no worktree:

```text
<worktree>/.git
<main-repo>/.git/worktrees/<name>/gitdir
```

Depois rode `git status` no worktree e confirme a branch antes de commit/push. Esses
arquivos são metadados locais, não entram no commit.
