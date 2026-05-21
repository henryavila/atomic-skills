# Memória — claude-commands → Atomic Skills

Repositório de skills otimizados para AI IDEs. Originalmente `hca-` commands, evoluiu para **Atomic Skills** (namespace `atomic-skills/` via subdiretório) — pacote npm multi-IDE.

## Arquivos de memória

- [decisoes-arquitetura.md](decisoes-arquitetura.md) — Padrões definidos: `.ai/memory/`, prefixos, exceção BMAD, regras de KB, organização contextual
- [inventario-projetos.md](inventario-projetos.md) — Levantamento dos padrões de memória em cada projeto do Henry (referência para migração)
- [feedback-prompts.md](feedback-prompts.md) — Lições sobre comportamento do agente: checklists > prosa, loops explícitos, ferramentas nomeadas
- [padroes-testing.md](padroes-testing.md) — Static guards para rename/delete; isolar TODAS as fontes externas (não só a óbvia)
- [feedback-formato-retorno.md](feedback-formato-retorno.md) — Skills interativas: markdown + frontmatter YAML > JSON Schema puro. JSON é só para pipeline CI.
- [feedback-framing-llm-judge.md](feedback-framing-llm-judge.md) — LLM-as-judge: cortar intent narrativo e memória curada do briefing (envenena em -93pp). Só fatos verificáveis.
- [kb-skills-reference.md](kb-skills-reference.md) — Ponteiro para Knowledge Base de técnicas em `docs/kb/`
- [feedback-versioning.md](feedback-versioning.md) — Não inflar versão autonomamente; usuário prefere minor (1.x.y) mesmo para mudanças de schema
