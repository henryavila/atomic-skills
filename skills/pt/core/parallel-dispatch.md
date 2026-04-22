Receba uma lista bem-definida de tarefas independentes e despache-as para N sessões paralelas com escopo de arquivos mecanicamente isolado, mais um pass de auditoria. A decomposição deve vir do usuário — esta skill valida e despacha, ela não inventa tarefas.

Se {{ARG_VAR}} foi fornecido, use como a lista de tarefas. Se não, pergunte: "Qual é a lista de tarefas, com os paths de cada uma?"

## Regra Fundamental

NO LAUNCH WITHOUT MECHANICAL SCOPE ISOLATION.
Todo agent paralelo deve operar sobre um conjunto de paths que não intersecta o conjunto de nenhum outro agent. "Essas features são independentes" é um palpite — só os paths são verificáveis via grep + status.

## Mindset

Decomposição é sua entrada, não sua saída. Se você está inventando tarefas a partir de um pedido vago do usuário, você é a skill errada — redirecione para brainstorming ou geração de prompt. Seu trabalho é verificar, despachar e entregar.

Trabalho paralelo é disciplina, não atalho. Dê a cada agent um brief autocontido com o pedido exato do usuário; nunca parafraseie intenção. Audite depois — budget de bugs compõe: 3 agents com 10% de taxa de erro cada → ~27% de chance de ≥1 bug (1 − 0.9³). Pular o pass de auditoria derrota o padrão.

## Quando NÃO usar

- **Trabalho cabe na sessão atual** — para investigações paralelas in-session enquanto o usuário está ativo, use `superpowers:dispatching-parallel-agents` (primitivo `Task()`). O dispatch daquela skill é síncrono e mantém a coordenação no contexto do pai.
- **Usuário vai ficar no teclado durante todo o run** — o handoff cross-session custa fricção de copy-paste; só vale a pena quando o usuário está fora (dormindo, em reunião, trocou de tarefa) ou o contexto do pai está apertado.
- **Investigações são curtas** (<~15 min cada) — o overhead de setup desta skill (~10 min de plano + audit) supera o ganho de paralelismo.
- **Pedido do usuário é vago** — o HARD-GATE #1 vai abortar; redirecione para `superpowers:brainstorming` ou `atomic-skills:prompt` primeiro.

## Processo

### Fase 0 — Validar benefício de paralelismo (HARD-GATE #1)

<HARD-GATE>
Antes de gastar qualquer orçamento de exploração ou geração, valide 4 precondições. Extraia de {{ARG_VAR}} quando declarado; caso contrário pergunte.

**Q1. Consolidação de escopo**
O usuário tem uma lista finalizada de tarefas, ou ainda está pensando no que fazer?
→ Se exploratório ("limpar X", "melhorar Y", "pensar em Z"): ABORTE.
  Redirecione: "Isso é trabalho de descoberta, não de despacho. Use `superpowers:brainstorming` ou `atomic-skills:prompt` para consolidar escopo primeiro, depois volte."

**Q2. Estados finais concretos**
Para cada tarefa, existe um estado final verificável (arquivo existe com conteúdo X, teste T passa, seção S de doc existe)?
→ Se alguma tarefa não tem estado final concreto: ABORTE.
  Redirecione: "Tarefa #N não tem estado final verificável. Refine em deliverable concreto antes de despachar."

**Q3. Benefício de wallclock**
O trabalho se beneficia de paralelismo além do overhead da skill (~10 min de plano + auditoria)?
→ Se o total combinado é trivial em sequência: ABORTE.
  Redirecione: "Muito pequeno para o overhead de paralelismo. Rode sequencial via `atomic-skills:prompt`."

**Q4. Independência das tarefas**
Classifique as dependências entre tarefas:
- **Nenhuma**: tarefas totalmente desacopladas ✓
- **Soft**: Tarefa B referencia artefato de A em doc ou import, mas não bloqueia no timing de A ✓
- **Hard**: código de B requer que o output de A exista antes de B ser escrita ✗

→ Se algum par tem hard dep: ABORTE.
  Redirecione: "Dependência sequencial dura entre Tarefa A e B. Use `atomic-skills:prompt` em sequência, ou separe as tarefas paralelizáveis das sequenciais."

Se as 4 passarem: prossiga para a Fase 1.
</HARD-GATE>

### Fase 1 — Verificar decomposição

O usuário trouxe a decomposição. Seu trabalho é provar que os escopos são disjuntos, não inventar novos.

**1.1 Extrair escopos por tarefa**
De {{ARG_VAR}} ou da resposta do usuário, colete para cada tarefa:
- Título (texto verbatim do usuário)
- Paths que a tarefa vai tocar (usuário declara; nunca infira)
- Critérios de aceitação (verbatim do usuário, se fornecido)

Se paths não foram declarados para alguma tarefa: PERGUNTE. Nunca adivinhe.

**1.2 Examinar estado do repo**
Rode com {{BASH_TOOL}}:
- `git rev-parse --abbrev-ref HEAD` — registre o branch atual (necessário na Fase 3)
- `git status --porcelain` — inclui tracked-modificados E untracked (cobertura maior que `git diff`)

Intersecte escopos declarados com paths atualmente modificados/untracked. Sinalize sobreposição — WIP num path que um agent despachado vai tocar = risco de colisão.

**1.3 Grep pareado por cross-references**
Para cada par de escopos (A, B), verifique disjunção com {{GREP_TOOL}}: escopo A não aparece referenciado em paths de B e vice-versa. Registre a saída real do grep como evidência para o plano.

**1.4 Read dirigido (só se estrutura for ambígua)**
Leia cabeçalhos de módulos, arquivos index/init, READMEs de módulos — nunca implementação completa. Você está verificando fronteiras, não debugando.

**1.5 Check de convergência (HARD-GATE #2)**

<HARD-GATE>
Pare a exploração quando puder responder SIM aos três:
1. Cada escopo tem conjunto exato de paths que consigo enumerar (sem formulações fuzzy tipo "mais ou menos em src/")
2. Tenho saída de grep provando zero cross-references entre qualquer par de escopos
3. O próximo Read/Grep que eu faria não mudaria a hipótese de decomposição

Se a exploração não converge (cada op nova revela novos unknowns): a tarefa não é cleanly decomposable. Classifique confidence como LOW e ABORTE. Sugira execução sequencial ou decomposição mais fina.

Sem limites operacionais (nada de "max N greps") — convergência é o critério. Se ainda está aprendendo, continue. Se não, pare.

Evidência obrigatória na saída:
- Saídas de grep pareado (cite no arquivo de plano)
- Saída de `git status --porcelain`
- Branch atual registrado
</HARD-GATE>

**1.6 Classificar confidence**
- **HIGH** — todos os escopos são diretórios net-new OU cross-refs grep = zero com zero coupling
- **MEDIUM** — escopos em módulos separados com coupling indireto que não toca os paths declarados
- **LOW** — coupling detectado OU exploração não convergiu

Apresente ao usuário:

> **Decomposição verificada:**
> 1. [Tarefa 1] — escopo: `<paths>`, deliverables: `<lista>`
> 2. [Tarefa 2] — escopo: `<paths>`, deliverables: `<lista>`
> ...
>
> **Evidência:**
> - Grep pareado (Tarefa 1 ↔ Tarefa 2): `<saída>`
> - `git status --porcelain`: `<saída>`
> - Branch: `<branch>`
>
> **Confidence:** HIGH / MEDIUM / LOW
>
> Prosseguir? (y/n)

Aguarde aprovação. LOW recusa por default; prosseguir exige "proceed LOW" explícito do usuário e é considerado excepcional.

### Fase 2 — Gerar o batch id (commit prefix)

Auto-gere um batch id único neste formato:

```
[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]
```

- `<slug>` é um kebab curto semântico derivado do título da primeira tarefa (ou fornecido pelo usuário)
- Segundos no timestamp evitam colisão se a skill rodar duas vezes no mesmo minuto
- Exemplo: `[dispatch-20260422-153045-onboard-ci]`

Registre também o prefix de audit para depois: `[audit-dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]` — derivado da mesma base para que commits de audit sejam rastreáveis ao seu dispatch.

Brackets precisam ser escapados no grep: `\[dispatch-...\]`.

### Fase 3 — Gerar N prompts de tarefa

Para cada tarefa, emita um prompt autocontido com estas seções em ordem. Sem paráfrase — texto do usuário entra verbatim.

```
[Papel + Contexto]
Você é um de N agents paralelos trabalhando no projeto `<nome do repo>` (cwd `<path absoluto>`, branch `<branch>`). Os outros agents rodam em sessões separadas — você não pode se comunicar com eles.

[Pedido exato do usuário para esta tarefa]
<cópia verbatim da declaração original do usuário — não parafraseie nem resuma>

[Critérios de aceitação]
<verbatim do usuário se fornecido; omita a seção se não>

[Paths que você pode tocar — estrito]
- <path exato 1>
- <path exato 2>
- ...

[Branch]
Verifique que está no branch `<branch>` antes de qualquer operação (`git rev-parse --abbrev-ref HEAD`). Se não: faça checkout primeiro. Todos os commits vão para este branch.

[Protocolo de commit]
Todos os commits desta sessão usam prefix: `[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>] <tipo>: <descrição>`
Stage arquivos APENAS por path explícito (ex: `git add docs/onboard-mac.md`). NUNCA `git add .` ou `git add -A` — sua sessão compartilha a working tree com agents irmãos, e stage amplo vai incluir as mudanças não-comitadas deles.

[Restrições — NÃO]
- NÃO tocar paths fora da lista acima. Se precisar de path fora do escopo, PARE e reporte.
- NÃO rodar git destrutivo (push --force, reset --hard, branch -D, reescrita de histórico).
- NÃO usar `git add .` ou `git add -A` — sempre paths explícitos (veja acima).
- NÃO fazer broadcast externo (nada de gh pr create, nada de mensageria, nada de notificações).
- NÃO pushar — o usuário pusha quando todos os agents completarem.
- NÃO exceder escopo mesmo que um fix adjacente pareça "óbvio".

[Tratamento de ambiguidade]
Se ambiguidade arquitetural OU path fora do escopo é necessário OU seu diff cresce além do que a tarefa exige: PARE e reporte ao usuário no chat. Não comite estado parcial ou contaminado.
```

Regras para cada prompt:
- Autocontido — agents irmãos nunca referenciados por nome (rodam em sessões diferentes; referência seria sem sentido)
- Pedido exato do usuário preservado — paráfrase perde intenção
- Escopo explícito de arquivos listado por path
- Lista de NÃO repetida verbatim em todo prompt — cada prompt é colado em sessão isolada sem lugar compartilhado pra consultar; duplicação é obrigatória, não preguiça
- Branch registrado pra agents verificarem antes de agir

### Fase 4 — Escrever o arquivo de plano

Escreva em `.atomic-skills/dispatches/<slug>.md` usando {{WRITE_TOOL}}. O diretório `.atomic-skills/` já está no gitignore pelo installer, então o plano persiste entre reboots sem poluir o repo.

Estrutura:

`````markdown
# Parallel Dispatch — <slug>

**Batch id (commit prefix):** `[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`
**Audit prefix:** `[audit-dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`
**Branch:** `<branch>`
**Confidence:** HIGH / MEDIUM / LOW
**Agents:** N tarefa + 1 pass de auditoria

## Decomposição verificada

| # | Tarefa | Escopo (paths) | Deliverables |
|---|--------|----------------|--------------|
| 1 | [título] | `<paths>` | [lista] |
| 2 | [título] | `<paths>` | [lista] |
| ... |

## Evidência de isolamento

- Saídas de grep pareado: `<citações da saída real>`
- `git status --porcelain` no momento do dispatch: `<saída>`

## Avisos de shared state

Agents com escopos de source disjuntos ainda podem colidir indiretamente via estado compartilhado:
- Lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `Cargo.lock`, `uv.lock`)
- Build artifacts (`dist/`, `.next/`, `target/`)
- Config de raiz (`.gitignore`, `.env.example`, `tsconfig.json`)
- Caches (`__pycache__`, `.pytest_cache`)

Se alguma tarefa instala dependências, regenera um build ou edita config de raiz: serialize essas tarefas ou aceite o risco de colisão.

---

## Agent 1 — [título]

**Abra uma sessão nova e cole o prompt abaixo.** O bloco de código tem botão de copiar.

```
[prompt completo — autocontido, pedido do usuário verbatim]
```

## Agent 2 — [título]
```
[prompt completo]
```

...

---

## Rodar a auditoria

Depois que todos os N agents de tarefa completarem, abra uma sessão nova e rode:

```
atomic-skills:parallel-dispatch-audit <slug>
```

A auditoria lê este arquivo de plano automaticamente de `.atomic-skills/dispatches/<slug>.md`.

---

## Rollback

Reverte todos os commits de tarefa deste batch:

```bash
git revert $(git log --format=%H --grep='\[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>\]' --reverse)
```

Commits de audit carregam `[audit-dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`; reverte separadamente se necessário.

---

*Planos antigos em `.atomic-skills/dispatches/` podem ser removidos uma vez que a auditoria esteja completa — o prefix no git log é o registro autoritativo.*
`````

### Fase 5 — Entregar (com confirmação de browser)

Apresente o path do plano no chat e PEÇA CONFIRMAÇÃO antes de abrir o browser:

> Plano pronto em `.atomic-skills/dispatches/<slug>.md`.
>
> Batch id: `[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`
> Branch: `<branch>`
> Confidence: HIGH / MEDIUM / LOW
>
> Abrir no browser via mdprobe para copy-paste fácil? (y/n)
>
> **Rollback se necessário:** `git revert $(git log --format=%H --grep='\[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>\]' --reverse)`

Abrir um browser é um side effect invasivo — nunca dispare automaticamente. Só rode o mdprobe depois que o usuário responder "y".

Se confirmado, rode com {{BASH_TOOL}}:

```bash
mdprobe .atomic-skills/dispatches/<slug>.md 2>/dev/null || npx -y @henryavila/mdprobe .atomic-skills/dispatches/<slug>.md
```

O fallback `npx -y @henryavila/mdprobe` lida com ambientes onde o mdprobe não está pré-instalado. O singleton server do mdprobe reusa uma instância existente se já houver uma rodando.

Se recusado: "Abra o arquivo manualmente em `.atomic-skills/dispatches/<slug>.md` quando quiser."

## Red Flags

- "Usuário disse 'limpar X', eu descubro as tarefas sozinho" — isso não é dispatch, é brainstorming
- "As tarefas não estão bem definidas mas o usuário quer paralelo, eu vou"
- "Vou parafrasear o pedido do usuário; ele quis dizer [minha interpretação]"
- "Paths de source disjuntos, logo os agents estão isolados" — lockfiles, builds, configs compartilham estado indiretamente
- "Deixo os agents usarem `git add -A` já que cada escopo é pequeno"
- "As tarefas são obviamente independentes, pulo a verificação de grep"
- "Convergência não foi atingida mas envio assim mesmo"
- "Confidence LOW mas provavelmente dá certo"
- "Um arquivo é compartilhado mas é pequeno, eu junto depois"
- "O agent de auditoria pode refatorar o que os implementadores escreveram"
- "Disparo 10 agents porque estou com pressa"

Se pensou em qualquer uma das acima: PARE. Trabalho paralelo é disciplina; atalhos derrotam.

## Tabela de Racionalização

| Tentação | Realidade |
|----------|-----------|
| "Usuário deu input vago, eu decomponho sozinho" | Decomposição é entrada, não saída. Redirecione para brainstorming |
| "Essas tarefas são claramente independentes" | Claramente para quem? Mostre a saída do grep |
| "Usuário pediu 7 agents, então são 7" | Cap em 5; além disso, custo de coordenação > ganho de paralelismo |
| "`git add .` é ok, agents têm escopos pequenos" | Sessões irmãs compartilham working tree; stage amplo contamina |
| "Paths disjuntos = agents isolados" | Lockfiles, build artifacts, config de raiz colidem indiretamente |
| "Vou parafrasear a tarefa do usuário no prompt" | Paráfrase perde intenção. Copie verbatim |
| "Limitei a 5 ops então acabei" | Convergência é o critério, não contagem. Você parou por convergir ou por bater teto? |
| "Confidence LOW mas envio assim mesmo" | LOW é sinal de recusa. Sequencial é mais seguro |
| "Auditoria é opcional se os agents forem cuidadosos" | Cuidadoso ≠ correto. Todo PR é revisado por algum motivo |
| "10 agents porque estou com pressa" | 1 − 0.9¹⁰ ≈ 65% de chance de ≥1 bug. Retornos decrescentes além de 3-4 |
| "Batch id é overkill" | `git log --grep` ganha seu custo na primeira vez que precisa de rollback |

## Relatório de Fechamento

Reporte:
- Corpo de trabalho: [resumo 1 linha]
- Check de precondição: 4/4 passaram (Q1-Q4)
- Tarefas produzidas: N
- Confidence: HIGH / MEDIUM / LOW
- Evidência de isolamento: `<citações de grep pareado>`
- Branch: `<branch>`
- Batch id: `[dispatch-<YYYYMMDD>-<HHMMSS>-<slug>]`
- Arquivo de plano: `.atomic-skills/dispatches/<slug>.md`
- Próxima ação: usuário abre N sessões novas e cola os prompts de tarefa
- Pós-hoc: invoque `atomic-skills:parallel-dispatch-audit <slug>` depois que todos os agents completarem
