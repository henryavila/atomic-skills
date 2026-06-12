# Feedback — UX de argumentos em skills: arg obrigatório é atrito

**Contexto (2026-06-12):** o usuário reportou que `review-code` exigir um git
ref exato era "inviável na prática" — o caso de uso dominante é *acabei de
implementar, está tudo sem commit (ou em vários commits recentes)*, e a skill
abortava. Reformulado em 2026-06-12 (ver `git log skills/core/review-code.md`).

**Princípios para skills futuras:**

1. **Arg posicional obrigatório só quando indispensável.** Se o insumo pode
   ser detectado do estado do repo (worktree sujo, commits ahead da base),
   ofereça invocação zero-arg com picker interativo sobre escopos REAIS
   detectados (com contagens), mais keywords para pular o picker
   (`wip` | `branch` | `all` no review-code).
2. **Hard abort só no caminho não-interativo.** Com TTY, prefira pergunta de
   3 opções a abortar; sem TTY, aborto determinístico com mensagem que diz
   exatamente o que passar.
3. **Gates condicionais ao sujeito, não globais.** O gate de dirty-tree punia
   o caso mais seguro: quando o worktree É o assunto do review, árvore suja é
   esperada. Antes de um gate global, perguntar "essa condição é perigo ou é
   o próprio insumo neste fluxo?".

**Como aplicar:** ao criar/revisar skill com arg obrigatório, validar contra o
fluxo "acabei de fazer e quero rodar a skill agora, sem cerimônia". Se exige
preparação manual (commit, montar range, descobrir sintaxe), adicionar
detecção de escopo. Relacionado: [[feedback-prompts]],
[[feedback-skill-body-review-rules]].
