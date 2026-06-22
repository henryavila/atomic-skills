# Reference — Mode-2/Codex lane: realidade operacional (dogfood)

Aprendido rodando a lane Mode-2 (Codex executor) ao vivo em 4 tasks
(`worktree-lifecycle-finalization` F4–F7 T-001) + os review-gates `--mode=both` das 7
fases. Complementa `reference-codex-macos-timeout.md` (que é só o wrapper de timeout) e
`feedback-framing-llm-judge.md` (anti-framing do reviewer).

## 1. O auto-report `-o` do Codex NÃO é confiável para CONTAGEM — re-verifique sempre

O resumo que o Codex escreve no `-o <out>` reportou **"tests 1, pass 1"** em TODAS as 4
dispatches, quando a contagem real era 10, 16, 22, 6, 20. **Descarte o self-count.** O
adjudicador é o orquestrador (Opus) **re-rodando o verifier determinístico na primária
MERGED** — nunca o self-report do executor (Iron Law; um executor foreign se auto-CHECA
mas NUNCA se auto-CERTIFICA). Idem para "self-check passed": o EPERM de `git init` no
sandbox workspace-write do Codex faz o round-trip "falhar" no ambiente dele — artefato do
sandbox, não defeito; só a re-verificação na primária decide.

## 2. `review-code --mode=both` é load-bearing para diff de contrato/lógica/fail-safe

Em **7/7** phase-done reviews desta sessão, o pass Codex **cross-model** (blind) pegou
bug de LÓGICA/contrato que o pass local **mesmo-modelo** racionalizou — inclusive casos
em que o local declarou explicitamente "Logic correctness: clean". Classes que só o
cross-model pegou: fail-closed em indeterminação, never-throws em input null/hostil,
asserção de atributo não-ancorada (`/merge:union/` aceita `unionized`), assimetria entre
dois caminhos que classificam o mesmo conceito, record parcial contado como prova,
byte-preservação quebrada por `trimEnd`. **Não é opcional** para mudança de
contrato/lógica/fail-safe. O informed pass-2 emergiu finding novo 2×. Padrão = wlf L-001.

## 3. State-fence: Codex toca SÓ source; Opus dona o state-tree

Codex escreve só código no worktree isolado; o orquestrador (Opus) dona TODA mutação do
tree `.atomic-skills/` — incluindo **migrações de formato de dado** (ex: `dispatch-log.json`
array→NDJSON). Quando uma task toca os dois (source + state), **divida**: Codex faz o
source (.gitattributes/skill/teste/módulo), Opus faz a conversão do arquivo de estado.

## 4. Codex ADAPTA convenções do repo — não super-pine

O Codex corrigiu `require`→`import` porque o repo é ESM (`"type":"module"`), apesar do
work-order ter pedido `require`. Um bom executor conserta a suposição errada da spec.
Pine o CONTRATO (assinatura, comportamento, casos de teste), não o estilo que o repo já
fixa.

## 5. Aterre a SPEC pré-escrita no repo VIVO antes de despachar (L-002)

Numa SPEC escrita adiantada (plano multi-fase), re-aterre cada critério no repo real
ANTES do dispatch: pode estar **pré-satisfeito** (ex: `focus.json` já no `.gitignore`) ou
o mecanismo pode ser **inseguro nos artefatos reais**. Caso concreto: `git merge=union` é
lossless SÓ em arquivo line-oriented — aplicá-lo a um array JSON pretty-printed corromperia
(`}`+`{` sem vírgula). → um log append-only que mergeia entre worktrees tem que ser
**NDJSON** (1 registro/linha), nunca array. Surface o mismatch ao operador como ratify-gate;
emende SPEC+verifier antes de despachar (o executor Mode 2 constrói a SPEC ao pé da letra).
