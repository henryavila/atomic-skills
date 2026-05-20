/* global window */
// ── Initiative-view fixtures ──────────────────────────────────────────────
// Calibrated to brief: up to 12 tasks, up to 3 tags/task, 200+-line markdown
// body, parked/emerged side findings, cross-initiative references, and
// edge-case variants (standalone, empty, no-body).

// 200+ line body — written like a real working dev log.
const F0_BODY = `## Why this initiative exists

v2 acumulou três classes de débito que se reforçam mutuamente. Dados em
três modelos paralelos (\`song\`, \`legacy_song\`, \`mirror_song\`), um
matcher determinístico escrito em PHP que só funciona com dados limpos,
e migrations que esperam o resultado do matcher para terminar. **F0 é o
nó que destrava tudo** — F1, F2, F6 dependem da tag \`core-v2\` ser
plantada no final desta fase.

A escolha de tratar F0 como sua própria fase (em vez de um pre-step de
F6) foi deliberada: o trabalho de reconciliação tem seu próprio loop de
verificação (pipeline rodando, conferindo, ajustando) que merece um
status \`active\` separado e seus próprios exit gates.

## How we got here

Antes de F0 ter sido escrito existiu uma versão chamada \`F-1: Schema
Reset\` que tentou resolver o problema reescrevendo o schema do zero.
Foi abandonada na semana 2 porque o conjunto de tenants em produção
tinha overrides que ninguém documentou — descartar o schema legacy
ia descartar nove meses de overrides invisíveis.

A versão atual (F0) toma a abordagem oposta: **preserva tudo, reconcilia
no caminho de saída**. O matcher determinístico é o único componente
que pode dizer "esta linha é a mesma que aquela linha" — uma vez que
ele rode limpo, podemos confiar no result set como verdade.

## The shape of the work

Oito tarefas (T-001 → T-008) divididas em três grupos:

1. **Setup** (T-001): restaurar infra local, fixtures, dumps.
2. **Pipeline core** (T-002, T-003, T-004): mover dados para o novo
   schema, unificar Álbum, limpar tenant songs órfãs.
3. **Matcher + verify** (T-005, T-006, T-007): reescrever o matcher,
   validação humana, re-run completo.
4. **Closure** (T-008): tag \`core-v2\`, archive backups, snapshot.

A tarefa T-005 é o **gargalo conhecido** — é a única que tem
\`blockedBy\` populado neste momento. Os blockers são T-003 e T-004 —
ambos precisam terminar antes do matcher poder rodar contra os dados
unificados. Há também uma dependência externa: \`v3-f1-filament-redesign / T-002\`
não pode começar antes de T-005 ser concluído, porque o painel admin
v3 consome o output do matcher para popular a tela de reconciliação.

## Non-negotiables for closure

- **Tag must exist.** \`git tag | grep core-v2\` precisa retornar exit
  code 0. Esse é o sinal externo para F1/F2/F6 que a base está pronta.
- **Zero duplicatas.** A query de verificação em \`F0-G2\` precisa
  retornar 0 linhas. Se retornar > 0, ninguém prossegue até entender
  por quê.
- **Pipeline reproduzível.** O \`scripts/full-pipeline.sh\` precisa
  rodar limpo em uma máquina nova com apenas os dumps em \`.local/dumps/\`.
  Esse é o gate manual — vamos pedir para o segundo dev fazer.

## Decisions made during execution

### D1 · 2026-05-19 · Manter pipeline em bash

Considerei escrever em Python para ter melhor controle de erro e
estruturas de dados. Bash venceu por dois motivos: (a) cada passo é
auditável linha-a-linha sem ler código de outra pessoa; (b) o exit
code já é o contrato — se um \`pg_restore\` falha, o pipeline para.

Vai ter momentos onde bash é doloroso (sobretudo no matcher, mas o
matcher é PHP, não bash). Aceito o trade-off.

### D2 · 2026-05-19 · Tag \`core-v2\` é ponto de não retorno

Após \`core-v2\` ser plantada, qualquer mudança no schema legacy
exige re-base + re-run do pipeline inteiro. Isso é caro (~40min em
hardware atual) mas mantém o sinal limpo: se a tag existe, todo
mundo abaixo pode assumir o estado.

### D3 · 2026-05-20 · UTF-8 collation: \`und-x-icu\` em vez de \`pt_BR\`

Inicialmente coloquei \`COLLATE pt_BR\` no schema novo. Quebrou em
12 ministérios que tinham nomes em espanhol, inglês e híbrido.
Mudei para \`und-x-icu\` (Unicode default, ICU). Trade-off: perdemos
ordenação "natural" para acentos portugueses em listas, mas
ganhamos correção para todos os tenants. Lista admin pode ordenar
em runtime se for crítico.

## Open questions

- **Emoji em titles de songs.** Encontramos U+1F3F4 + ZWJ tag-sequences
  em ~40 títulos (bandeiras regionais em conteúdo de ministério).
  A anotação da IA em T-005 sugeriu adicionar fixture específico.
  Decisão pendente: incluir como caso de teste do matcher, ou
  documentar como limitação conhecida?

- **Dumps gitignored: backup strategy.** Os \`.local/dumps/*.sql\`
  estão fora do git por design (PII). Mas se perdermos o disco
  local, perdemos o input do pipeline. Por enquanto: backup
  semanal manual para \`s3://sda-private-backup/\`. Não-escalável,
  mas funciona até F8.

## What to do if F0 fails

Se a verificação humana (T-006) achar algo errado, **não plantar
\`core-v2\`**. Reabrir T-002 ou T-005 dependendo do tipo de erro.
F1/F2/F6 ainda não podem começar — eles dependem do sinal.

Se descobrirmos durante F6 que o matcher deixou casos passar (algo
que só aparece no volume real de 8M registros), o protocolo é:

1. Pausar F6 imediatamente (anotação crítica + drift highlight).
2. Reabrir F0 como um novo issue (não nova fase — F0 reaberto).
3. Voltar a F0 ativo, rodar o matcher corrigido, regerar a tag.
4. F6 retoma usando a nova tag.

Isso já aconteceu uma vez durante a versão F-1 — descobrimos um
gap-legacy só com volume de produção. O retrabalho custou três
dias mas o pipeline ficou mais robusto.

## References

- \`docs/prd/v3-redesign.md § 4 Constraints\` — define os limites
  (sem ETL pesado, sem reescrever schema do zero).
- \`docs/runbooks/pipeline.md § 2 dados\` — o procedimento operacional
  que esta fase executa.
- \`docs/adr/0007-postgres-over-mysql.md\` — por que migramos para
  PostgreSQL (e não fizemos só upgrade do MySQL).
- \`docs/specs/exit-gates.md § verifier kinds\` — define os quatro
  tipos de verifier (shell, query, test, manual) usados aqui.

## Future readers

Se você está lendo isso depois que F0 fechou e ainda há débito
visível em dados, a primeira pergunta a fazer é: **a tag \`core-v2\`
realmente existe no histórico?** Se sim, o débito é novo (introduzido
em F1 ou depois). Se não, F0 não fechou corretamente — investigar o
exit gate \`F0-G3\` antes de qualquer outra coisa.
`;

// ── F0 — active initiative (default fixture) ──────────────────────────────
const F0_INITIATIVE = {
  slug: 'v3-f0-foundation-repair',
  phaseId: 'F0',
  phaseIndex: 0,
  phaseTotal: 9,
  parentPlan: {
    slug: 'v3-redesign',
    title: 'SDA v2 — Plano v3 (Redesign)',
    version: 'v1.0',
  },
  trackId: 'A',
  trackTitle: 'Dados',
  title: 'Foundation Repair',
  status: 'active',
  audience: 'developer',
  goal: 'Reconciliar dados duplicados no schema legado antes que qualquer trabalho de UI ou migração possa começar. F0 é o nó de bloqueio: F1, F2 e F6 dependem da tag core-v2 ser plantada no fechamento desta fase.',
  started: '2026-05-19',
  updated: '32 min ago',
  branch: 'v2-rebuild',
  scope: [
    'backend/app/Console/Commands/*',
    'scripts/*',
    'database/migrations/*',
    'database/seeds/legacy/*',
  ],
  nextAction: { taskId: 'T-002', title: 'Pipeline dumps → PostgreSQL' },
  exitGates: [
    {
      id: 'F0-G1', status: 'pending',
      description: 'Tag git core-v2 criada e empurrada para origin',
      verifier: { kind: 'shell', command: 'git tag --list core-v2 | grep -q core-v2 && git ls-remote --tags origin core-v2 | grep -q core-v2' },
      lastRun: { status: 'fail', exit: 1, when: '2 hrs ago', output: 'core-v2 not present locally' },
      annotations: 0,
    },
    {
      id: 'F0-G2', status: 'pending',
      description: 'Query retorna 0 duplicatas após pipeline rodar',
      verifier: { kind: 'query', command: 'SELECT COUNT(*) FROM (SELECT external_id, ministry_id FROM songs GROUP BY external_id, ministry_id HAVING COUNT(*) > 1) dupes;' },
      lastRun: { status: 'fail', exit: 0, when: '32 min ago', output: '847 rows' },
      annotations: 1,
    },
    {
      id: 'F0-G3', status: 'pending',
      description: 'scripts/full-pipeline.sh roda limpo em máquina nova',
      verifier: { kind: 'shell', command: 'bash scripts/full-pipeline.sh' },
      lastRun: null,
      annotations: 0,
    },
    {
      id: 'F0-G4', status: 'pending',
      description: 'Matcher cobre fixture unicode (U+1F3F4 + ZWJ + acentos)',
      verifier: { kind: 'test', command: 'vendor/bin/phpunit --filter MatcherUnicodeTest' },
      lastRun: { status: 'pass', exit: 0, when: '5 hrs ago', output: '12 passed, 0 failed' },
      annotations: 0,
    },
    {
      id: 'F0-G5', status: 'deferred',
      description: 'Manual sign-off — segundo dev rodou o pipeline em hardware limpo',
      verifier: { kind: 'manual', command: 'Visual confirmation — peer review' },
      deferredReason: 'Esperando F0-G3 passar primeiro. Sem rodar limpo automaticamente, peer review do pipeline manual desperdiça tempo do segundo dev.',
      annotations: 0,
    },
  ],
  stack: [
    { depth: 0, id: 'T-002', kind: 'task',          title: 'Pipeline dumps → PostgreSQL',                          openedAt: '5 hrs ago' },
    { depth: 1, id: null,    kind: 'validation',    title: 'Validar paridade de count(*) com origem',              openedAt: '2 hrs ago' },
    { depth: 2, id: null,    kind: 'investigation', title: 'Drift de collation em tenant_12 (UTF-8 boundary)',    openedAt: '52 min ago' },
    { depth: 3, id: null,    kind: 'discussion',    title: 'Discutir estratégia para overrides por tenant',       openedAt: '14 min ago', here: true },
  ],
  tasks: [
    {
      id: 'T-001', status: 'done', title: 'Restore local infra (docker compose + dumps locais)',
      tags: ['setup'], updated: '2 days ago', annotations: 0,
      description: 'Subir docker-compose com postgres-15 + redis-7. Restaurar os 3 dumps SQL mais recentes (songs, albums, tenants) em databases isolados nomeados legacy_*. Verificar que cada dump carrega com 0 erros e que o count(*) bate com o registrado em .local/dumps/manifest.yaml.',
      outputs: [
        { kind: 'command', value: 'docker compose up -d postgres redis' },
        { kind: 'script',  value: 'scripts/restore-legacy.sh' },
      ],
      verifier: { kind: 'shell', command: 'psql -U dev legacy_songs -c "SELECT COUNT(*) FROM songs" -At | xargs -I{} test {} -gt 0' },
    },
    {
      id: 'T-002', status: 'active', title: 'Pipeline dumps → PostgreSQL (transform + load)',
      tags: ['pipeline', 'data'], updated: '30 min ago', here: true, annotations: 1,
      description: 'Implementar o pipeline determinístico que lê os 3 dumps legacy, aplica transformações de schema (renomear colunas, normalizar foreign keys, converter encoding de latin-1 → UTF-8), e carrega no schema v3 final. Cada passo precisa ser reentrante — se o pipeline parar no meio, deve retomar exatamente de onde parou.',
      outputs: [
        { kind: 'migration', value: 'database/migrations/2026_05_19_174000_create_v3_songs_table.php' },
        { kind: 'migration', value: 'database/migrations/2026_05_19_174100_create_v3_albums_table.php' },
        { kind: 'script',    value: 'scripts/pipeline/01-transform.sh' },
        { kind: 'script',    value: 'scripts/pipeline/02-load.sh' },
        { kind: 'command',   value: 'pg_restore --no-owner --clean --if-exists -d sda_v3' },
      ],
      verifier: { kind: 'shell', command: 'bash scripts/pipeline/verify-counts.sh && echo OK' },
      crossTaskRefs: [
        { relation: 'unblocks',  toInitiative: 'v3-f1-filament-redesign', toTaskId: 'T-002', toTaskTitle: 'Tela de reconciliação' },
      ],
    },
    {
      id: 'T-003', status: 'pending', title: 'Unificação do modelo Álbum (legacy + mirror)',
      tags: ['data', 'schema'], updated: '5 hrs ago', annotations: 0,
      description: 'Os modelos legacy_album e mirror_album divergiram em 2024. O matcher precisa de uma chave unificada para fazer o join. Esta tarefa escolhe a regra de unificação (preferência por mirror_album quando existe, fallback para legacy_album) e implementa como uma view materializada chamada unified_albums.',
      outputs: [
        { kind: 'migration', value: 'database/migrations/2026_05_20_create_unified_albums_view.php' },
      ],
      verifier: { kind: 'query', command: 'SELECT COUNT(*) FROM unified_albums HAVING COUNT(*) >= (SELECT COUNT(*) FROM legacy_albums);' },
    },
    {
      id: 'T-004', status: 'pending', title: 'Cleanup tenant_songs órfãs (FK quebradas)',
      tags: ['data', 'cleanup'], updated: '5 hrs ago', annotations: 0,
      description: 'Há ~2400 linhas em tenant_songs onde a song_id referenciada não existe mais em legacy_songs (provavelmente delete-cascades que falharam em 2024). Esta tarefa identifica essas linhas, exporta para .local/dumps/orphans-2026-05.csv como artifact de auditoria, e remove com soft-delete.',
      outputs: [
        { kind: 'file',   value: '.local/dumps/orphans-2026-05.csv' },
        { kind: 'script', value: 'scripts/cleanup-orphan-tenant-songs.sh' },
      ],
      verifier: { kind: 'query', command: 'SELECT COUNT(*) FROM tenant_songs ts LEFT JOIN legacy_songs ls ON ts.song_id = ls.id WHERE ls.id IS NULL;' },
    },
    {
      id: 'T-005', status: 'blocked', title: 'Reescrever matcher determinístico (PHP → bash + jq)',
      tags: ['critical', 'gap-legacy', 'matcher'], updated: '1 hr ago', annotations: 2,
      description: 'O matcher v2 (PHP, ~800 linhas) tem três caminhos diferentes por tipo de fonte (legacy / mirror / tenant) e cresceu por copy-paste. Reescrever como pipeline shell + jq que aplica um único conjunto de regras canônicas. O output é um CSV de pares (source_id, target_id, confidence).',
      outputs: [
        { kind: 'script', value: 'scripts/matcher/main.sh' },
        { kind: 'file',   value: 'docs/specs/matcher-rules.md' },
      ],
      verifier: { kind: 'test', command: 'vendor/bin/phpunit --filter MatcherFixtureTest' },
      blockedBy: [
        { taskId: 'T-003', initiative: null, status: 'pending', title: 'Unificação do modelo Álbum' },
        { taskId: 'T-004', initiative: null, status: 'pending', title: 'Cleanup tenant_songs órfãs' },
        { taskId: 'T-007', initiative: 'v3-fneg2-inception-audit', status: 'done', title: 'Audit de matcher v1', crossInitiative: true },
      ],
    },
    {
      id: 'T-006', status: 'pending', title: 'Validação humana via HTML report',
      tags: ['validation'], updated: '5 hrs ago', annotations: 0,
      description: 'Gerar um HTML estático com amostra de 200 pares matcheados — 100 high-confidence, 50 medium, 50 low — para inspeção visual. Cada par mostra os dois títulos lado-a-lado com o diff destacado.',
      outputs: [
        { kind: 'file', value: '.local/reports/matcher-validation-2026-05-NN.html' },
      ],
      verifier: { kind: 'manual', command: 'Open report and approve sample manually' },
    },
    {
      id: 'T-007', status: 'pending', title: 'Re-run pipeline + verify (sequência completa)',
      tags: ['pipeline'], updated: '5 hrs ago', annotations: 0,
      description: 'Rodar scripts/full-pipeline.sh do zero em máquina limpa. Capturar log completo, conferir que todos os passos têm exit 0, conferir count(*) final.',
      outputs: [
        { kind: 'log', value: '.local/logs/full-pipeline-final.log' },
      ],
      verifier: { kind: 'shell', command: 'bash scripts/full-pipeline.sh' },
    },
    {
      id: 'T-008', status: 'pending', title: 'Tag core-v2 + archive backups + snapshot final',
      tags: ['closure'], updated: '5 hrs ago', annotations: 0,
      description: 'Plantar a tag git core-v2 no commit que completou T-007. Archivar os dumps legacy em .local/snapshots/before-f0.tar.zst. Empurrar a tag para origin. Esse é o sinal externo para F1/F2/F6 começarem.',
      outputs: [
        { kind: 'tag',      value: 'core-v2' },
        { kind: 'snapshot', value: '.local/snapshots/before-f0.tar.zst' },
      ],
      verifier: { kind: 'shell', command: 'git rev-parse core-v2 && test -f .local/snapshots/before-f0.tar.zst' },
    },
  ],
  parked: [
    { id: 'PK-1', title: 'Migrar legacy_song.metadata (JSONB blob) para colunas tipadas', parkedAt: '3 days ago', reason: 'Escopo de F0 é reconciliação, não tipagem. Retomar em F6.' },
    { id: 'PK-2', title: 'Investigar 12 linhas com encoding suspeito em tenant_07',      parkedAt: '1 day ago',  reason: 'Tenant_07 está sendo descontinuado em F8; não vale o esforço.' },
  ],
  emerged: [
    { id: 'EM-1', title: 'Patrimony Clone — entidade não documentada em mirror_db', surfacedAt: '5 hrs ago', promoted: false, candidateFor: 'F6' },
    { id: 'EM-2', title: 'Coluna songs.deleted_at não está sendo escrita por código novo', surfacedAt: '2 hrs ago', promoted: false, candidateFor: 'F1' },
    { id: 'EM-3', title: 'tenant_overrides.yaml não tem schema — proposta de spec',  surfacedAt: '20 min ago', promoted: true, candidateFor: 'F1' },
  ],
  references: [
    { kind: 'prd',     path: 'docs/prd/v3-redesign.md',                section: '§4 Constraints', state: 'in-project' },
    { kind: 'runbook', path: 'docs/runbooks/pipeline.md',              section: '§2 dados',       state: 'in-project' },
    { kind: 'adr',     path: 'docs/adr/0007-postgres-over-mysql.md',   section: null,             state: 'in-project' },
    { kind: 'spec',    path: 'docs/specs/exit-gates.md',               section: 'verifier kinds', state: 'in-project' },
    { kind: 'spec',    path: 'docs/specs/matcher-rules.md',            section: null,             state: 'in-project' },
    { kind: 'repo',    path: '/Volumes/External/code/arch',            section: 'matcher legacy', state: 'external' },
    { kind: 'dump',    path: '.local/dumps/songs-2026-04.sql',         section: null,             state: 'gitignored' },
    { kind: 'fixture', path: '.local/fixtures/tenant-12-overrides.yaml', section: null,           state: 'gitignored' },
  ],
  body: F0_BODY,
  annotations: 1, // on the initiative itself
};

// ── F-1 — done initiative variant ─────────────────────────────────────────
const FNEG1_INITIATIVE = {
  slug: 'v3-fneg1-repo-bootstrap',
  phaseId: 'F-1',
  phaseIndex: null,
  phaseTotal: 9,
  parentPlan: {
    slug: 'v3-redesign',
    title: 'SDA v2 — Plano v3 (Redesign)',
    version: 'v1.0',
  },
  trackId: null,
  trackTitle: 'Foundation Legacy',
  title: 'Repository Bootstrap',
  status: 'done',
  audience: 'developer',
  goal: 'Branch v2-rebuild, strict TypeScript, CI green. Base limpa para todo o trabalho subsequente.',
  started: '2026-05-05',
  updated: '8 days ago',
  completedAt: '2026-05-12',
  durationDays: 7,
  branch: 'v2-rebuild',
  tag: 'v0.0-bootstrap',
  scope: ['.github/workflows/*', 'package.json', 'tsconfig.json', '.env.example'],
  nextAction: null,
  exitGates: [
    { id: 'F-1-G1', status: 'met', description: 'Branch v2-rebuild criada e protegida',
      verifier: { kind: 'shell', command: 'git branch --list v2-rebuild' },
      lastRun: { status: 'pass', exit: 0, when: '2026-05-06', output: '  v2-rebuild' },
      evidence: 'Branch protection rules applied; require pull request + 1 review.',
      metAt: '2026-05-06', annotations: 0,
    },
    { id: 'F-1-G2', status: 'met', description: 'CI passa em main + v2-rebuild',
      verifier: { kind: 'test',  command: 'npm test && npm run typecheck' },
      lastRun: { status: 'pass', exit: 0, when: '2026-05-11', output: '124 passed' },
      evidence: 'Green for 6 consecutive runs; no flaky tests.',
      metAt: '2026-05-11', annotations: 0,
    },
    { id: 'F-1-G3', status: 'met', description: '.env documentado (12 chaves)',
      verifier: { kind: 'manual', command: 'Visual review of .env.example' },
      lastRun: null, evidence: 'Reviewed by @henry — all 12 keys have type + default + comment.',
      metAt: '2026-05-12', annotations: 0,
    },
  ],
  stack: [],
  tasks: [
    { id: 'T-001', status: 'done', title: 'Criar branch v2-rebuild + branch protection', tags: ['setup'], updated: '8 days ago', annotations: 0 },
    { id: 'T-002', status: 'done', title: 'Configurar GitHub Actions (ci.yml + lint.yml)', tags: ['ci'], updated: '8 days ago', annotations: 0 },
    { id: 'T-003', status: 'done', title: 'Atualizar tsconfig para strict + noUncheckedIndexedAccess', tags: ['types'], updated: '7 days ago', annotations: 0 },
    { id: 'T-004', status: 'done', title: 'Baseline test suite + vitest setup', tags: ['ci', 'tests'], updated: '7 days ago', annotations: 0 },
    { id: 'T-005', status: 'done', title: 'Document .env.example (12 keys)', tags: ['docs'], updated: '7 days ago', annotations: 0 },
  ],
  parked: [],
  emerged: [],
  references: [
    { kind: 'doc',  path: 'docs/development.md', section: 'CI setup', state: 'in-project' },
    { kind: 'adr',  path: 'docs/adr/0001-strict-typescript.md', section: null, state: 'in-project' },
  ],
  body: `## Why\n\nBefore any new code, the rails. Strict TypeScript, green CI, environment documented. The point of this initiative is to make every future initiative cheaper — no scrambling for a CI fix mid-feature.\n\n## Decisions\n\n- **Strict TypeScript from day one.** Decided against gradual migration. Strict catches more bugs and avoids retrofit cost.\n- **Vitest, not jest.** Faster startup, native ESM. Migration from jest is trivial at this scale.\n- **CI gates: typecheck AND test.** Both must pass. Tests can pass with type errors otherwise.\n\n## Closure note\n\nClosed on 2026-05-12. Tag v0.0-bootstrap planted at commit a3f2b1c. All exit gates met; CI has stayed green for 6 days.`,
  outputs: [
    { kind: 'tag',      value: 'v0.0-bootstrap', meta: 'commit a3f2b1c · 2026-05-12' },
    { kind: 'workflow', value: '.github/workflows/ci.yml',   meta: 'CI green 6d' },
    { kind: 'workflow', value: '.github/workflows/lint.yml', meta: 'eslint + prettier' },
    { kind: 'file',     value: 'tsconfig.json', meta: 'strict: true' },
  ],
  annotations: 0,
};

// ── Standalone initiative (no parent plan) ────────────────────────────────
const STANDALONE_INITIATIVE = {
  ...F0_INITIATIVE,
  slug: 'one-off-cron-cleanup',
  phaseId: null,
  phaseIndex: null,
  phaseTotal: null,
  parentPlan: null,
  trackId: null,
  trackTitle: null,
  title: 'Drop stale cron jobs on staging',
  goal: 'Three cron entries on staging haven\'t been read in 90+ days. Audit and remove the dead ones; document the rest in ops/runbooks.',
  scope: ['ops/cron/*'],
  body: `## Why\n\nStaging crontab accumulated entries faster than anyone read them. Five entries; three haven't logged anything in 90 days. Audit, remove the dead ones, document the rest.`,
  exitGates: F0_INITIATIVE.exitGates.slice(0, 2),
  tasks: F0_INITIATIVE.tasks.slice(0, 4),
};

// ── No body / quiet variant ───────────────────────────────────────────────
const QUIET_INITIATIVE = {
  ...F0_INITIATIVE,
  slug: 'v3-f0-foundation-repair-quiet',
  body: null,
  parked: [],
  emerged: [],
  annotations: 0,
};

const INITIATIVES = {
  'f0-active':   F0_INITIATIVE,
  'fneg1-done':  FNEG1_INITIATIVE,
  'standalone':  STANDALONE_INITIATIVE,
  'quiet':       QUIET_INITIATIVE,
};

// ── Annotations bound to entities in F0 ───────────────────────────────────
const INITIATIVE_ANNOTATIONS = [
  {
    id: 'a1',
    target: { slug: 'v3-f0-foundation-repair', path: 'tasks.T-002' },
    targetLabel: 'T-002',
    author: 'ai', severity: null, createdAt: '2 hrs ago',
    body: 'Need to verify unicode normalization for emoji edge cases. Suggest adding a fixture with U+1F3F4 and ZWJ tag-sequences before claiming exit gate G2 is met. The current matcher fixture only covers Latin-1 + common Unicode.',
    replies: [
      { id: 'a1-r1', author: 'human', createdAt: '1 hr ago',
        body: 'Good call. Adding U+1F3F4 + ZWJ tag-sequence fixtures to tests/fixtures/unicode-edge.yaml.' },
      { id: 'a1-r2', author: 'ai', createdAt: '52 min ago',
        body: 'Confirmed — fixture covers the four flag variants. Reopening if I find more.' },
    ],
  },
  {
    id: 'a2',
    target: { slug: 'v3-f0-foundation-repair', path: 'exitGates.F0-G2' },
    targetLabel: 'F0-G2',
    author: 'human', severity: null, createdAt: '1 hr ago',
    body: 'This query might be expensive on 50M rows in production. Consider an indexed materialized view, or filter to last 30 days for the gate check.',
    replies: [],
  },
  {
    id: 'a3',
    target: { slug: 'v3-f0-foundation-repair', path: 'tasks.T-005' },
    targetLabel: 'T-005',
    author: 'ai', severity: 'warn', createdAt: '40 min ago',
    body: 'Two upstream blockers + one cross-initiative blocker. Recommend resolving T-003/T-004 first; the cross-init dependency on inception-audit/T-007 is informational (audit already done).',
    replies: [],
  },
  {
    id: 'a4',
    target: { slug: 'v3-f0-foundation-repair', path: 'self' },
    targetLabel: 'F0',
    author: 'human', severity: null, createdAt: '6 hrs ago',
    body: 'Reminder to self: do not advance F0 until G3 (full-pipeline.sh exit 0) actually passes on the second dev\'s machine, not just mine.',
    replies: [],
  },
];

Object.assign(window, { INITIATIVES, INITIATIVE_ANNOTATIONS });
