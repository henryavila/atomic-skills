# References — contexto da feature modelada no dogfood

Estes arquivos **não** são o plano do produto Project Flow.  
São o design/plan da feature **Sugestão de necessidade PDTI** (arch-legacy), copiados para o agente entender **por que** o grafo dogfood tem status 10/1/11, actors GETIN/Líder/Sistema e três XORs.

| Arquivo | Conteúdo |
|---------|----------|
| `pdti-feature-design.md` | Decisions de domínio (entity, status, Livewire, area_id) |
| `pdti-feature-plan.md` | Plan multi-phase F0–F3 com verifiers Pest |
| `pdti-feature-source.md` | Source narrative |
| `pdti-feature-research-digest.md` | Digest da feature |
| `pdti-decisions/` | Decision logs F0–F2 |
| `monorepo-paths.md` | Paths do atomic-skills |

**Regra:** ao implementar o **produto** flow, use estes arquivos só para interpretar a fixture. **Não** codifique regras PDTI no validator core.
