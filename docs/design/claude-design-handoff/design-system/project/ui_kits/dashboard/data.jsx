/* global window */
// Sample fixture data — modeled on the sda-v2 v3-redesign reference plan
// from docs/why.md (9 phases × 8 tracks × ~60 sub-phases).

const plan = {
  slug: 'v3-redesign',
  title: 'SDA v2 — Plano v3 (Redesign)',
  version: 'v1.0',
  status: 'active',
  started: '2026-05-19',
  branch: 'v2-rebuild',
  currentPhase: 'F0',
  tracks: [
    { id: '_', title: 'Foundation Legacy' },
    { id: 'A', title: 'Dados' },
    { id: 'B', title: 'UI Base' },
    { id: 'C', title: 'Planejamento' },
    { id: 'D', title: 'Oversight & Curadoria' },
    { id: 'F', title: 'Migração' },
    { id: 'G', title: 'Auditorias' },
  ],
  principles: [
    { id: 'P1', title: 'Files are canonical.', body: 'The .atomic-skills/ tree is the source of truth.' },
    { id: 'P2', title: 'Localhost-only.', body: 'No telemetry, no cloud, no phone-home.' },
    { id: 'P3', title: 'Bidirectional human↔AI.', body: 'Annotations and highlights are first-class.' },
    { id: 'P4', title: 'No estimates.', body: 'Execution-focused, not management-focused.' },
    { id: 'P5', title: 'MCP-first for AI.', body: 'REST for browser; MCP is canonical for agents.' },
    { id: 'P6', title: 'Phases over flat lists.', body: 'Real plans have phases. Honor them.' },
  ],
  glossary: [
    { term: 'consumer', definition: 'Skill emitting canonical data to .atomic-skills/<consumer>/.' },
    { term: 'gate', definition: 'Verifiable exit criterion — shell, query, test, or manual.' },
    { term: 'inbox', definition: 'MCP-write target. Intents the consumer skill picks up.' },
    { term: 'parked', definition: 'Surfaced but not actionable now — kept for later.' },
    { term: 'emerged', definition: 'Surfaced as a candidate from inside the work.' },
  ],
  phases: [
    // ── Done phases (legacy, completed in prior weeks) ──
    {
      id: 'F-2', track: '_', status: 'done',
      title: 'Inception & Audit', audience: 'developer',
      goal: 'Diagnóstico do sistema legado, identificação de débitos.',
      gates: { met: 4, total: 4 }, tasks: { done: 6, total: 6 },
      exit: 'audit report + decision log signed',
      completedAt: '2026-04-28',
      durationDays: 11,
      resolvedHighlights: 3,
    },
    {
      id: 'F-1', track: '_', status: 'done',
      title: 'Repository Bootstrap', audience: 'developer',
      goal: 'Branch v2-rebuild, baseline tests, CI verde.',
      gates: { met: 3, total: 3 }, tasks: { done: 5, total: 5 },
      exit: 'main → v2-rebuild + CI green + .env documented',
      completedAt: '2026-05-12',
      durationDays: 7,
    },
    {
      id: 'F0', track: 'A', status: 'active',
      title: 'Foundation Repair', audience: 'developer',
      goal: 'Resolver dados antes de qualquer trabalho de UI.',
      gates: { met: 0, total: 3 }, tasks: { done: 3, total: 8 },
      exit: 'tag core-v2 + pipeline + 0 dup',
      next: 'T-002 Pipeline dumps → PostgreSQL',
      highlights: [{ count: 2, severity: 'warn' }],
      scope: 'backend/app/Console/Commands/*',
    },
    {
      id: 'F1', track: 'B', status: 'pending',
      title: 'Filament Redesign', audience: 'admin',
      goal: 'Reescrever todo o painel administrativo.',
      gates: { met: 0, total: 5 }, tasks: { done: 0, total: 10 },
      exit: 'UI Gate composite (3 viewports + dark + smoke + i18n)',
      next: null,
      imports: '/Volumes/External/code/arch',
      gateType: 'ui-gate',
    },
    {
      id: 'F2', track: 'B', status: 'pending',
      title: 'Nuxt Redesign', audience: 'end-user',
      goal: 'Reescrever experiência pública.',
      gates: { met: 0, total: 4 }, tasks: { done: 0, total: 12 },
      exit: 'Lighthouse ≥ 90 + i18n complete',
      next: null,
      highlights: [{ count: 1, severity: 'info' }],
    },
    {
      id: 'F3', track: 'C', status: 'pending',
      title: 'Planning Mode', audience: 'líder de equipe',
      goal: 'Habilitar fluxo de planejamento.',
      gates: { met: 0, total: 3 }, tasks: { done: 0, total: 5 },
      exit: 'Plano de exemplo renderizado em < 500ms',
      next: null,
      highlights: [{ count: 2, severity: 'warn' }],
    },
    {
      id: 'F4', track: 'D', status: 'pending', parallelWith: ['F5'],
      title: 'Ministry Oversight', audience: 'ministry lead',
      goal: 'Painéis de visão geral por ministério.',
      gates: { met: 0, total: 2 }, tasks: { done: 0, total: 7 },
      exit: 'Cross-cutting view válida para 12 ministérios',
      next: null,
    },
    {
      id: 'F5', track: 'D', status: 'pending', parallelWith: ['F4'],
      title: 'Set Curation', audience: 'curator',
      goal: 'Curadoria assistida por IA.',
      gates: { met: 0, total: 3 }, tasks: { done: 0, total: 6 },
      exit: '20 sets curados com diff aprovado',
      next: null,
    },
    {
      id: 'F6', track: 'F', status: 'pending',
      title: 'Data Migration A', audience: 'developer',
      goal: 'Migrar 8M registros legados.',
      gates: { met: 0, total: 4 }, tasks: { done: 0, total: 9 },
      exit: '0 erros + count = origem',
      next: null,
      highlights: [{ count: 1, severity: 'critical' }],
      hasCriticalDrift: true,
    },
    {
      id: 'F7', track: 'F', status: 'pending',
      title: 'Data Migration B', audience: 'developer',
      goal: 'Migração de mídia binária.',
      gates: { met: 0, total: 3 }, tasks: { done: 0, total: 6 },
      exit: 'S3 sync clean + checksums match',
      next: null,
    },
    {
      id: 'F8', track: 'F', status: 'pending',
      title: 'Decommission', audience: 'developer',
      goal: 'Desligar sistema antigo, snapshot final.',
      gates: { met: 0, total: 2 }, tasks: { done: 0, total: 4 },
      exit: 'old.* tagged + DNS cutover',
      next: null,
    },
    // ── Track G: 5 paralelos (auditorias cross-tenant) ──
    ...(() => {
      const peers = ['F-A1', 'F-A2', 'F-A3', 'F-A4', 'F-A5'];
      const audits = [
        ['Schemas',  'Drift de schema entre tenants',          { done: 0, total: 3 }, [{ count: 1, severity: 'warn' }]],
        ['Indexes',  'Auditar índices ausentes',               { done: 0, total: 4 }, null],
        ['Permissions','Permissões legadas vs políticas v3',   { done: 0, total: 5 }, null],
        ['Storage',  'Órfãos de mídia + checksum',             { done: 0, total: 2 }, null],
        ['Telemetry','Confirmar zero telemetria em produção',  { done: 0, total: 2 }, [{ count: 1, severity: 'critical' }]],
      ];
      return audits.map(([title, goal, tasks, highlights], i) => ({
        id: peers[i], track: 'G', status: 'pending',
        parallelWith: peers.filter(p => p !== peers[i]),
        title: `Audit · ${title}`, audience: 'developer',
        goal, gates: { met: 0, total: 1 }, tasks,
        exit: `${title.toLowerCase()} report exit 0`,
        next: null,
        ...(highlights ? { highlights } : {}),
      }));
    })(),
  ],
};

const initiative = {
  slug: 'v3-f0-foundation-repair',
  phaseId: 'F0',
  parentPlan: 'v3-redesign',
  title: 'F0 — Foundation Repair',
  status: 'active',
  started: '2026-05-19',
  branch: 'v2-rebuild',
  goal: 'Resolver dados antes de qualquer trabalho de UI.',
  scope: ['backend/app/Console/Commands/*', 'scripts/*', 'database/migrations/*'],
  nextAction: 'T-002 Pipeline dumps → PostgreSQL',
  exitGates: [
    { id: 'F0-G1', status: 'pending', description: 'Tag git core-v2 criada', verifier: { kind: 'shell', command: 'git tag | grep core-v2' } },
    { id: 'F0-G2', status: 'pending', description: 'Query retorna 0 duplicatas',  verifier: { kind: 'query', command: 'SELECT COUNT(*) FROM (SELECT external_id FROM songs GROUP BY external_id HAVING COUNT(*) > 1)' } },
    { id: 'F0-G3', status: 'pending', description: 'scripts/full-pipeline.sh exit 0', verifier: { kind: 'shell', command: 'bash scripts/full-pipeline.sh' } },
  ],
  stack: [{ id: 1, title: 'F0 kickoff', type: 'task', openedAt: '2026-05-19' }],
  tasks: [
    { id: 'T-001', status: 'done', title: 'Restore local infra', updated: '2 hrs ago' },
    { id: 'T-002', status: 'active', title: 'Pipeline dumps → PostgreSQL', updated: '30 min ago', here: true,
      description: 'Migrate the legacy MySQL dumps into the new PostgreSQL schema. Verify song count matches origin.',
      outputs: [
        { kind: 'command', command: 'pg_restore --no-owner …' },
        { kind: 'migration', path: 'database/migrations/2026_05_19_songs.php' },
      ],
    },
    { id: 'T-003', status: 'pending', title: 'Unificação do modelo Álbum' },
    { id: 'T-004', status: 'pending', title: 'Cleanup tenant songs' },
    { id: 'T-005', status: 'blocked', title: 'Reescrever matcher',
      tags: ['critical', 'gap-legacy'], blockedBy: ['T-003', 'T-004'],
      highlights: 1,
    },
    { id: 'T-006', status: 'pending', title: 'Validação humana via HTML report' },
    { id: 'T-007', status: 'pending', title: 'Re-run pipeline + verify' },
    { id: 'T-008', status: 'pending', title: 'Tag core-v2 + archive + snapshot' },
  ],
  parked: [],
  emerged: [
    { title: 'Investigate Patrimony Clone', surfacedAt: '5 hrs ago', promoted: false },
  ],
  references: [
    { kind: 'section', path: '../plans/v3-redesign.md', section: 'F0 — Foundation Repair' },
    { kind: 'section', path: '../../RUNBOOK.md', section: '§2 pipeline de dados' },
    { kind: 'repo-path', path: '/Volumes/External/code/arch', gitignored: true },
  ],
  crossTaskRefs: [
    { fromTaskId: 'T-005', toInitiativeSlug: 'v3-f1-filament-redesign', toTaskId: 'T-002', relation: 'unblocks' },
  ],
  body: `## Why\n\nO retrabalho começa por dados. Se a base estiver suja, qualquer telinha bonita vai mostrar lixo bonito.\n\n## Decisions\n\n- Manter o pipeline em bash (sem ETL pesado) — auditável.\n- Tag \`core-v2\` é o ponto de não retorno.`,
};

const skills = [
  { id: 'project-status', title: 'project-status', summary: 'Track work via plans, initiatives, and tasks.', when: 'starting · resuming · planning multi-phase work', active: true },
  { id: 'parallel-dispatch', title: 'parallel-dispatch', summary: 'Dispatch N independent tasks in parallel agents.', when: 'long todo list · off-keyboard time', active: false },
  { id: 'hunt', title: 'hunt', summary: 'Adversarial tests to find bugs the happy path missed.', when: 'untested code · after refactor', active: false },
  { id: 'review', title: 'review', summary: 'Structured code review with findings + severity.', when: 'before merging · before release', active: true },
  { id: 'audit', title: 'audit', summary: 'Walk an existing surface, surface unmet invariants.', when: 'inheriting a codebase · before scaling', active: false },
  { id: 'feedback-loop', title: 'feedback-loop', summary: 'Iterate with the human via inbox + annotations.', when: 'spec is ambiguous · risky direction', active: false },
  { id: 'gate', title: 'gate', summary: 'Block code edits until anchored to an initiative.', when: 'always (gatekeeper)', active: true },
  { id: 'snapshot', title: 'snapshot', summary: 'Capture state of a system for later diff.', when: 'before risky change · after milestone', active: false },
  { id: 'pulse', title: 'pulse', summary: 'Quick health check across all open initiatives.', when: 'morning standup · context switch', active: false },
];

const annotations = [
  {
    id: 'a1',
    target: { slug: 'v3-redesign', path: 'phases.F2/tasks.T-005' },
    author: 'ai', severity: null, createdAt: '2 hrs ago',
    body: 'Need to verify unicode normalization for emoji edge cases. Suggest adding a fixture with U+1F3F4 and ZWJ sequences before claiming exit gate G2 is met.',
  },
  {
    id: 'a2',
    target: { slug: 'v3-f0-foundation-repair', path: 'exitGates.F0-G2' },
    author: 'human', severity: null, createdAt: '1 hr ago',
    body: 'This query might be expensive on 50M rows. Consider an indexed materialized view, or filter to last 30 days for the gate check.',
  },
  {
    id: 'a3',
    target: { slug: 'v3-redesign', path: 'phases.F6' },
    author: 'ai', severity: 'critical', createdAt: '12 min ago',
    body: 'Detected drift: writes to backend/app/Models/Song.php during F0. F6 scope rule violated. Either widen scope explicitly or rebase the changes.',
  },
];

const highlights = [
  { id: 'h1', target: 'F0', severity: 'warn', reason: 'Gate G2 likely expensive at scale', count: 2 },
  { id: 'h2', target: 'F2', severity: 'info', reason: 'Lighthouse target may need adjustment' },
  { id: 'h3', target: 'F3', severity: 'warn', reason: '2 unresolved decisions' },
  { id: 'h4', target: 'F6', severity: 'critical', reason: 'Drift detected' },
];

const initiativeDone = {
  slug: 'v3-fneg1-repo-bootstrap',
  phaseId: 'F-1',
  parentPlan: 'v3-redesign',
  title: 'F-1 — Repository Bootstrap',
  status: 'done',
  started: '2026-05-05',
  completedAt: '2026-05-12',
  durationDays: 7,
  branch: 'v2-rebuild',
  goal: 'Branch v2-rebuild, baseline tests, CI verde — base limpa para todo o trabalho subsequente.',
  scope: ['.github/workflows/*', 'package.json', 'tsconfig.json', '.env.example'],
  nextAction: null,
  tag: 'v0.0-bootstrap',
  exitGates: [
    { id: 'F-1-G1', status: 'met',  description: 'Branch v2-rebuild criada e protegida', verifier: { kind: 'shell',  command: 'git branch | grep v2-rebuild' }, metAt: '2026-05-06' },
    { id: 'F-1-G2', status: 'met',  description: 'CI passa em main + v2-rebuild',         verifier: { kind: 'test',   command: 'npm test && npm run typecheck' }, metAt: '2026-05-11' },
    { id: 'F-1-G3', status: 'met',  description: '.env documentado',                       verifier: { kind: 'manual', command: 'Visual review of .env.example' }, metAt: '2026-05-12' },
  ],
  stack: [],
  tasks: [
    { id: 'T-001', status: 'done', title: 'Criar branch v2-rebuild', updated: '8 days ago' },
    { id: 'T-002', status: 'done', title: 'Configurar GitHub Actions', updated: '8 days ago' },
    { id: 'T-003', status: 'done', title: 'Atualizar tsconfig para strict', updated: '7 days ago' },
    { id: 'T-004', status: 'done', title: 'Baseline test suite', updated: '7 days ago' },
    { id: 'T-005', status: 'done', title: 'Document .env.example', updated: '7 days ago' },
  ],
  parked: [],
  emerged: [],
  outputs: [
    { kind: 'tag',       value: 'v0.0-bootstrap', meta: 'commit a3f2b1c · 2026-05-12' },
    { kind: 'workflow',  value: '.github/workflows/ci.yml',  meta: 'CI green for 6 days' },
    { kind: 'workflow',  value: '.github/workflows/lint.yml', meta: 'eslint + prettier' },
    { kind: 'file',      value: 'tsconfig.json',  meta: 'strict: true' },
    { kind: 'file',      value: '.env.example',   meta: '12 keys documented' },
  ],
  decisions: [
    { id: 'D1', title: 'Adopt strict TypeScript from day one', body: 'Decided against gradual migration — strict from F-1 catches more bugs and avoids retrofit cost.', resolvedAt: '2026-05-09' },
    { id: 'D2', title: 'Use vitest, not jest', body: 'Faster startup, native ESM. Migration from jest is trivial at this scale.', resolvedAt: '2026-05-10' },
    { id: 'D3', title: 'CI gates: typecheck AND test (not OR)', body: 'Both must pass. Tests can pass with type errors otherwise.', resolvedAt: '2026-05-11' },
  ],
  references: [
    { kind: 'file', path: 'docs/development.md', section: 'CI setup' },
    { kind: 'section', path: '../plans/v3-redesign.md', section: 'F-1 — Repository Bootstrap' },
  ],
  crossTaskRefs: [],
  body: '## Why\n\nBefore any new code, the rails. Strict TypeScript, green CI, environment documented.',
};

Object.assign(window, { plan, initiative, initiativeDone, skills, annotations, highlights });
