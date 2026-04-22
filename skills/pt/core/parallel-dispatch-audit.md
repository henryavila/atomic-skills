Audite o output de um batch de parallel-dispatch. Leia o arquivo de plano, verifique os deliverables de cada agent no disco, aplique fixes menores, consolide memória se no escopo e produza um relatório.

Se {{ARG_VAR}} foi fornecido, use como o slug do batch (ex: `onboard-ci`). O arquivo de plano está em `.atomic-skills/dispatches/<slug>.md`.

Se nenhum slug foi fornecido: pergunte ao usuário. Se o usuário não tem um arquivo de plano (dispatch manual sem esta skill), entre em **modo degradado** — audite só pelo commit prefix, pule a validação per-agent, sinalize a limitação no relatório.

## Regra Fundamental

NO CONCLUSION WITHOUT EVIDENCE FROM DISK.
Mensagens de commit não são prova. Para todo deliverable esperado, abra o arquivo real com {{READ_TOOL}} e verifique o conteúdo. Um commit passando sobre um arquivo vazio continua sendo falha.

<HARD-GATE: Detecção de batch ativo>
Se o commit mais recente que bate com o dispatch prefix tem menos de 2 minutos: PARE. Confirme com o usuário que todos os N agents reportaram conclusão antes de auditar. Um agent lento ainda rodando seria misclassificado como failed.
</HARD-GATE>

<HARD-GATE: Modo read-only>
Dispara quando QUALQUER destes é verdadeiro:
  - ≥5 issues encontradas em todos os agents
  - Scope drift detectado (um agent escreveu fora dos paths declarados)
  - Abstração errada introduzida (dependência ou pattern que o plano não permitia)
  - Operação destrutiva comitada no batch (force push, reescrita de histórico)
  - Deliverable inteiro faltando (ausente, não parcial)
  - Breaking change em API pública não declarada como mudando

Quando o modo read-only dispara:
  - NÃO PODE: {{REPLACE_TOOL}} ou {{WRITE_TOOL}} em qualquer arquivo criado/tocado pelos agents despachados
  - NÃO PODE: `git commit`, `git revert`, `git reset`, `git rebase` de qualquer tipo
  - PODE: {{WRITE_TOOL}} só no arquivo de relatório de audit
  - PODE: {{READ_TOOL}}, {{GREP_TOOL}}, {{GLOB_TOOL}}, {{BASH_TOOL}} em uso read-only

Read-only significa que o relatório é escrito, nada mais muda. Cinco ou mais issues sinalizam que o próprio plano de dispatch estava errado; fixes fragmentados escondem a causa raiz.
</HARD-GATE>

## Mindset

Você é um reviewer, não um implementador. A autoridade da auditoria é estreita por design: verificar, aplicar fixes cosméticos, reportar. Refatorar o que os agents escreveram destrói a rastreabilidade que a convenção de commit-prefix comprou.

Não confie em nada até ler. Mensagens de commit mentem por omissão; linecounts mentem por peso; existência de arquivo mente por conteúdo. Abra e leia.

## Processo

### Fase 1 — Inventário e check de contagem

Não confie em nenhuma descrição do que os agents deveriam ter feito. Leia o output real do git e o plano.

**1.1 Ler o plano (modo full) ou entrar em modo degradado**
Com {{READ_TOOL}}, abra `.atomic-skills/dispatches/<slug>.md`. Extraia:
- Batch id (commit prefix)
- Branch esperado
- N (número de agents de tarefa)
- Escopos e deliverables por agent

Se o plano está ausente: entre em modo degradado. Pergunte ao usuário o commit prefix e N, e anote no relatório:
> **Modo: degradado** — nenhum arquivo de plano encontrado. Validação per-agent pulada; auditoria limitada ao inventário de commits.

**1.2 Inventariar commits**
Para cada repo no escopo (derive dos escopos do plano; geralmente 1 repo), rode com {{BASH_TOOL}}:

```bash
git log --grep='\[dispatch-<...>\]' --oneline
git log --grep='\[dispatch-<...>\]' --stat
git log --grep='\[dispatch-<...>\]' --name-only
```

Cheque o branch:
```bash
git rev-parse --abbrev-ref HEAD
```

Compare com o branch esperado do plano. Se divergente, registre como warning no relatório.

**1.3 Check de contagem**
- Esperado: N agents de tarefa conforme plano
- Encontrado: clusters distintos de commits batendo com o prefix (um cluster por escopo de agent)
- Se mismatch: sinalize imediatamente. Sinal de primeira ordem de que o dispatch está incompleto ou poluído.

**1.4 Check de batch ativo**
Cheque o timestamp do commit mais recente. Se < 2 min: dispare o HARD-GATE acima e confirme conclusão com o usuário antes de prosseguir.

### Fase 2 — Auditar cada agent

Para todo agent listado no plano, responda 4 perguntas. Use {{READ_TOOL}} para conteúdo, {{BASH_TOOL}} para checks estruturais:

1. **Completude** — Os arquivos esperados existem? (`ls`, `test -f`)
2. **Qualidade** — O conteúdo bate com a descrição original da tarefa do usuário (do plano)? ABRA E LEIA. Não confie em linecounts ou mensagens de commit.
3. **Integração** — Referências cruzadas estão corretas? (`MEMORY.md` aponta pros novos arquivos? Badges do README linkam pros workflows que existem? Imports resolvem?)
4. **Executabilidade** — Para outputs executáveis (scripts, workflows, Dockerfiles):
   - `bash -n <script>` para sintaxe
   - `yamllint` ou `actionlint` para workflows (se disponível localmente)
   - NÃO force `docker build` ou rodadas destrutivas se as ferramentas não estão presentes — registre como "não verificado localmente"

Classifique cada agent:
- ✅ **Passou** — entregou completo e correto
- 🟡 **Parcial** — entregou com issues menores fixáveis (typos, links quebrados, frontmatter faltando)
- ❌ **Falhou** — não entregou ou quebrado (pode precisar de revert ou decisão do usuário)

### Fase 2.5 — Cross-checks operacionais

Mesmo quando um agent "passa" no próprio escopo, ele pode ter perdido atualizações em docs irmãos que referenciam seus artefatos. Rode um segundo passe focado em **integridade de documentação**:

- Docs de onboarding/setup (`docs/onboard-*.md`, `README.md`, guias de migração) ainda referenciam os arquivos certos?
- Links entre artefatos recém-criados e docs existentes estão intactos?
- Algum doc existente menciona arquivos que foram renomeados ou movidos?
- Referências de CI/workflow (badges, status checks) apontam para paths que de fato existem?

Também cheque **colisões de shared state** (lockfiles, build artifacts, config de raiz) modificados por mais de um agent — avise mesmo que o conteúdo tenha feito merge limpo.

Registre referências quebradas e warnings de colisão como issues 🟡 fixáveis.

### Fase 3 — Aplicar fixes com prefix de audit

Para cada issue 🟡 que seja **cosmético ou fixável em nível de referência**:
- Fix com {{REPLACE_TOOL}} ou {{WRITE_TOOL}}
- Commit com prefix `[audit-dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]` — derivado do slug do batch para que commits de audit sejam rastreáveis

Exemplos fixáveis:
- Typos, links internos quebrados, frontmatter faltando
- Referências de path erradas em YAML/docs
- `MEMORY.md` sem ponteiro pro arquivo recém-criado

NÃO fixáveis (escalar ao usuário como decisão pendente):
- Decisões arquiteturais
- Scope drift (agent escreveu fora dos paths declarados)
- Deliverable inteiro faltando
- Qualquer coisa que exija `git revert` — NÃO reverta sem confirmação explícita do usuário. Se acredita que revert é necessário, registre como decisão pendente no relatório, não como fix

Se o modo read-only foi disparado no HARD-GATE: PULE esta fase inteira.

### Fase 4 — Consolidar memória (se no escopo)

Somente se o plano de dispatch incluiu uma tarefa de consolidação de memória.

{{#if modules.memory}}
1. Verifique que o arquivo canônico de snapshot existe em `{{memory_path}}` (ex: `project_current_state.md`) e está coerente.
2. **Zero churn por churn:** se o agent de consolidação entregou ✅, pule rewrite. Apenas atualize o ponteiro em `MEMORY.md` se estiver faltando ou desatualizado.
3. **Critério de contradição:** se handoffs ou arquivos de memória se contradizem, prefira a entrada com **timestamp mais recente** E registre a resolução explicitamente no relatório:
   > Ambiguidade resolvida: `<X>` preferido sobre `<Y>` pelo critério `<timestamp | decisão explícita do usuário | consistência interna>`
4. Respeite o soft cap de 200 linhas / 25 KB em `MEMORY.md`.
5. Commit com `[audit-dispatch-<slug>] consolidate memory after batch`.
{{/if}}

### Fase 5 — Relatório

Escreva `.atomic-skills/dispatches/<slug>-audit.md` usando {{WRITE_TOOL}} com esta estrutura:

```markdown
# Audit Report — <slug> <data>

**Modo:** full / degradado
**Batch id:** `[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`
**Branch:** `<branch>` (divergente do plano: yes/no)
**Check de contagem:** esperado N, encontrado M → match / mismatch

## Status Matrix

| Agent | Escopo | Status | Commits | Issues |
|-------|--------|--------|---------|--------|
| 1     | ...    | ✅/🟡/❌ | N       | ...    |
| 2     | ...    | ✅/🟡/❌ | N       | ...    |
| ...   |        |        |         |        |

## Evidências por Agent

### Agent 1
- Arquivos criados: [lista]
- Avaliação de qualidade: [1-2 linhas]
- Issues encontradas: [lista]
- Fixes aplicados: [SHAs de commits com `[audit-dispatch-<slug>]`]

### Agent 2
(mesma estrutura)

## Fixes `[audit-dispatch-<slug>]` aplicados

- `<sha>` — descrição
- ...

## Ambiguidades resolvidas

- `<X>` preferido sobre `<Y>` pelo critério `<...>`

## Notas de shared state

- Colisões de lockfile / build / config observadas: yes / no [descreva]

## Pendências para o usuário decidir

- [issues não fixadas]
- [decisões arquiteturais]
- [reverts sugeridos com justificativa]

## Recomendação de passo único

[Uma frase — o que o usuário deve fazer primeiro ao retornar.]
```

Depois de escrever o relatório, apresente o path e PEÇA CONFIRMAÇÃO antes de abrir o browser:

> Relatório de auditoria escrito em `.atomic-skills/dispatches/<slug>-audit.md`.
>
> Abrir no browser via mdprobe para revisão e anotação? (y/n)

Abrir um browser é um side effect invasivo — nunca dispare automaticamente. Só rode o mdprobe depois que o usuário responder "y".

Se confirmado, rode com {{BASH_TOOL}}:

```bash
mdprobe .atomic-skills/dispatches/<slug>-audit.md 2>/dev/null || npx -y @henryavila/mdprobe .atomic-skills/dispatches/<slug>-audit.md
```

Se recusado: "Abra o arquivo manualmente em `.atomic-skills/dispatches/<slug>-audit.md` quando quiser."

### Fase 6 — Summary no chat

No chat, produza:

1. Modo: full / degradado
2. Check de contagem: esperado vs encontrado
3. Status por agent: ✅/🟡/❌ uma linha cada
4. Ações tomadas: lista de commits `[audit-dispatch-<slug>]` (SHA + descrição de uma linha)
5. Recomendação de passo único: uma ação clara
6. Localização do relatório: `.atomic-skills/dispatches/<slug>-audit.md`
7. **Status de push (OBRIGATÓRIO):**
   > Commits de audit locais pendentes de push: N em `<repo-A>`, M em `<repo-B>`.
   > Para propagar: `git -C <repo> push`

NÃO pushe automaticamente. Deixe o usuário decidir ao retornar.

## Red Flags

- "A mensagem de commit diz que funcionou — confio"
- "O linecount bate com o esperado — não vou abrir o arquivo"
- "Um refactorzinho enquanto estou aqui ficaria mais limpo"
- "Reverto o agent quebrado pra economizar trabalho do usuário"
- "Push dos fixes pro usuário achar pronto"
- "≥5 issues mas ainda dou conta, não vou abortar"
- "Contradições — pico uma quieto"
- "Scope drift é ok se o código ficou melhor"
- "Commit mais recente é de 30 segundos mas provavelmente terminou"
- "Arquivo de plano faltando — invento os escopos esperados"

Se pensou em qualquer uma das acima: PARE. A autoridade da auditoria é estreita por design.

## Tabela de Racionalização

| Tentação | Realidade |
|----------|-----------|
| "O commit existe, o trabalho está feito" | Commits vazios e conteúdo errado também comitam bem. Abra o arquivo |
| "Consigo fixar esse issue arquitetural rápido" | Você é o auditor, não o implementador. Escale |
| "Dar push economiza tempo do usuário" | O usuário decide quando propagar — não antecipe |
| "Reverto o agent que falhou" | Reverts sem confirmação do usuário destroem trabalho recuperável |
| "Issues menores — posso passar dos 5" | 5+ issues significa que o plano de dispatch estava errado; fixes fragmentados escondem a causa raiz |
| "Contradição entre docs? Pico uma quieto" | Registre a resolução — picks silenciosos apagam evidência |
| "Scope drift é ok se o código ficou melhor" | O usuário não aprovou essa mudança. Escale |
| "Commit mais recente é de agora mas provavelmente terminou" | <2 min é a linha do HARD-GATE. Confirme com o usuário |
| "Plano faltando, invento os escopos esperados" | Isso é modo degradado — anuncie, não finja |

## Relatório de Fechamento

Reporte inline:
- Modo: full / degradado
- Batch id: `[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`
- Check de contagem: esperado N, encontrado M (match / mismatch)
- Status dos agents: [X ✅ / Y 🟡 / Z ❌]
- Commits de audit: M (prefix `[audit-dispatch-<slug>]`)
- Push pendente: N em repo-A, M em repo-B (comando: `git -C <repo> push`)
- Relatório: `.atomic-skills/dispatches/<slug>-audit.md`
- Próxima ação: [1 frase]
