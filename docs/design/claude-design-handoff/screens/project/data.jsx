/* global window */
// Rich skills directory — modeled on the atomic-skills ecosystem.
// Each skill carries:
//   id, title, summary, when (situations), whenNot (anti-cases),
//   examples (literal commands / markdown blocks), related (cross-ref ids),
//   active (has a directory under .atomic-skills/ in this repo),
//   incomplete (metadata not fully populated).

const skills = [
  {
    id: 'project-status',
    title: 'project-status',
    summary: 'Track work via plans, initiatives, and tasks. Canonical surface for multi-phase projects.',
    when: [
      'starting a new multi-phase project',
      'resuming after time away — need to find current HERE',
      'a plan has more than ~5 phases or branching tracks',
      'human and AI need to share the same status surface',
    ],
    whenNot: [
      'a single-shot task with no follow-up — overhead exceeds value',
      'work that lives entirely inside one PR / one afternoon',
      'tracking calendar events, meetings, or anything time-bound (use a calendar)',
    ],
    examples: [
      '/atomic-skills:project-status',
      '/atomic-skills:project-status --plan v3-redesign',
      '/atomic-skills:project-status --resume',
    ],
    related: ['gate', 'feedback-loop', 'snapshot', 'pulse'],
    active: true,
  },
  {
    id: 'parallel-dispatch',
    title: 'parallel-dispatch',
    summary: 'Dispatch N independent tasks to parallel sub-agents. Re-merges results in order.',
    when: [
      'long todo list with no inter-task dependencies',
      'off-keyboard time — going to lunch, leaving for the night',
      'each task is tightly scoped (verifier in the prompt)',
    ],
    whenNot: [
      'tasks share files or mutable state — merge conflicts are guaranteed',
      'you need to watch the work happen (debug, learn, supervise)',
      'task count < 3 — orchestration cost dominates',
    ],
    examples: [
      '/atomic-skills:parallel-dispatch tasks.yaml',
      '/atomic-skills:parallel-dispatch --max-concurrent 4',
    ],
    related: ['project-status', 'hunt', 'review'],
    active: false,
  },
  {
    id: 'hunt',
    title: 'hunt',
    summary: 'Generate adversarial tests to find the bugs the happy path missed.',
    when: [
      'after a refactor that touched many call sites',
      'inheriting untested code before adding to it',
      'pre-release on a critical surface — payments, auth, data migration',
    ],
    whenNot: [
      'code under active development — tests will churn',
      'pure UI components without business logic',
      'as a substitute for understanding the code (read it first)',
    ],
    examples: [
      '/atomic-skills:hunt src/billing/',
      '/atomic-skills:hunt --target SongMatcher --focus unicode',
    ],
    related: ['review', 'audit', 'snapshot'],
    active: false,
  },
  {
    id: 'review',
    title: 'review',
    summary: 'Structured code review with findings, severity tags, and suggested fixes.',
    when: [
      'before merging a PR that touches > 200 lines',
      'before tagging a release',
      'after a long parallel-dispatch run, to triage outputs',
    ],
    whenNot: [
      'as a substitute for your own reading on critical code paths',
      'on commits already merged — use audit instead',
      'cosmetic-only changes (whitespace, comments, renames)',
    ],
    examples: [
      '/atomic-skills:review HEAD~3..HEAD',
      '/atomic-skills:review --severity warn+',
      '/atomic-skills:review pr/1247',
    ],
    related: ['hunt', 'audit', 'gate'],
    active: true,
  },
  {
    id: 'audit',
    title: 'audit',
    summary: 'Walk an existing surface and surface invariants the code does not hold.',
    when: [
      'inheriting a codebase or service from another team',
      'before a large refactor — map the load-bearing assumptions',
      'after a production incident — find the silent twins',
    ],
    whenNot: [
      'on code you wrote this week — your memory is the better audit',
      'as a one-shot — the output is a starting point, not a verdict',
    ],
    examples: [
      '/atomic-skills:audit backend/app/Models/',
      '/atomic-skills:audit --invariants invariants.md',
    ],
    related: ['hunt', 'review', 'snapshot'],
    active: false,
  },
  {
    id: 'feedback-loop',
    title: 'feedback-loop',
    summary: 'Iterate with the human via the inbox + annotation channel. Short clarifying messages over long rework.',
    when: [
      'spec is ambiguous and a guess could cost a day',
      'about to start something risky or expensive',
      'two reasonable interpretations of the requirement exist',
    ],
    whenNot: [
      'the answer is in the docs — read first, ask second',
      'as a delay tactic — if the work is mechanical, just do it',
      'for trivial choices the human delegated explicitly',
    ],
    examples: [
      '/atomic-skills:feedback-loop --topic "F0 exit gate G2"',
      '/atomic-skills:feedback-loop --resume',
    ],
    related: ['project-status', 'gate'],
    active: false,
  },
  {
    id: 'gate',
    title: 'gate',
    summary: 'Block code edits until the change is anchored to a known initiative + task.',
    when: [
      'always — install once, runs as a pre-edit hook',
      'project has multiple in-flight initiatives competing for attention',
      'guarding against scope drift on a sensitive branch',
    ],
    whenNot: [
      'exploration phase — gate will only frustrate you',
      'project-status skill is not installed (gate depends on it)',
    ],
    examples: [
      '/atomic-skills:gate install',
      '/atomic-skills:gate --bypass "hotfix CVE-2026-1234"',
      '/atomic-skills:gate status',
    ],
    related: ['project-status', 'feedback-loop'],
    active: true,
  },
  {
    id: 'snapshot',
    title: 'snapshot',
    summary: 'Capture full state of a system (filesystem, db, config) for later diff.',
    when: [
      'before a risky migration or schema change',
      'after a milestone — durable record of "this worked"',
      'reproducing a bug — snapshot the broken state for replay',
    ],
    whenNot: [
      'as a substitute for version control',
      'on systems with > 10 GB of mutable state — use the storage-native tool',
    ],
    examples: [
      '/atomic-skills:snapshot --label pre-f6-migration',
      '/atomic-skills:snapshot diff pre-f6-migration HEAD',
    ],
    related: ['audit', 'hunt'],
    active: false,
  },
  {
    id: 'pulse',
    title: 'pulse',
    summary: 'Quick health check across all open initiatives. One line per initiative + flagged blockers.',
    when: [
      'morning standup — what changed overnight?',
      'context switch — coming back to a project after working elsewhere',
      'weekly review — is anything quietly stuck?',
    ],
    whenNot: [
      'as the only signal — pulse summarizes, it does not investigate',
      'on a single-initiative project (just open project-status)',
    ],
    examples: [
      '/atomic-skills:pulse',
      '/atomic-skills:pulse --since 24h',
      '/atomic-skills:pulse --owner human',
    ],
    related: ['project-status', 'feedback-loop'],
    active: false,
  },
  {
    id: 'highlight',
    title: 'highlight',
    summary: 'Flag a fact, file, or row with a severity — info, warn, or critical. Surfaces in the highlights drawer.',
    when: [
      'noticing drift the human should look at',
      'capturing "this will bite us later" without blocking now',
      'annotating critical regressions during a review',
    ],
    whenNot: [
      'as a substitute for fixing the thing — highlight is the message, not the fix',
      'for decorative emphasis (critical red is reserved)',
    ],
    examples: [
      '/atomic-skills:highlight --severity warn "gate G2 likely expensive at scale"',
      '/atomic-skills:highlight resolve h1',
    ],
    related: ['feedback-loop', 'review'],
    active: true,
  },
  {
    id: 'annotate',
    title: 'annotate',
    summary: 'Attach a note to any path in the project tree. Bidirectional — human and AI write to the same channel.',
    when: [
      'documenting "why we did this" next to "what we did"',
      'leaving a breadcrumb for the next session',
      'recording a decision that has no natural home in code',
    ],
    whenNot: [
      'for documentation that belongs in a README (then put it there)',
      'as a chat log — annotations are durable, not conversational',
    ],
    examples: [
      '/atomic-skills:annotate phases.F0.tasks.T-005 "blocked on T-003 schema"',
      '/atomic-skills:annotate --list path:phases.F0',
    ],
    related: ['highlight', 'feedback-loop'],
    active: true,
  },
  // metadata-incomplete skill — only id, name, summary populated.
  // Renders gracefully; copy-command still works.
  {
    id: 'echo',
    title: 'echo',
    summary: 'Replay the last N agent actions as a markdown narrative.',
    incomplete: true,
    active: false,
  },
];

Object.assign(window, { skills });
