// GENERATED — do not edit. Source: meta/catalog.yaml.
// Run `npm run generate-docs` to regenerate. See
// docs/plan-skills-catalog-v0.2.md for the generator contract.

export interface Subcommand {
  name: string
  signature: string
  description: string
  example: string
}

export interface SkillArg {
  name: string
  kind: 'positional' | 'flag' | 'option'
  required: boolean
  description: string
  default?: string
}

export interface Skill {
  id: string
  title: string
  emoji: string
  oneLiner: string
  versionAdded: string
  summary?: string
  active?: boolean
  incomplete?: boolean
  when?: string[]
  whenNot?: string[]
  examples?: string[]
  subcommands?: Subcommand[]
  args?: SkillArg[]
  outputArtifacts?: string[]
  dependencies?: string[]
  related?: string[]
  tags?: string[]
}

export const SKILLS: Skill[] = [
  {
    id: "fix",
    title: "Fix — Root Cause + TDD",
    emoji: "🔧",
    oneLiner: "Diagnose root cause → write test → fix → verify",
    versionAdded: "1.0.0",
    summary: "Root cause diagnosis + TDD fix. Use when you find a bug or unexpected behavior.",
    active: true,
    when: ["You observed a bug or unexpected behavior", "A test is failing for unclear reasons", "A regression appeared after a recent change"],
    whenNot: ["You want to add a new feature (use prompt)", "The issue is in design, not implementation", "You have no symptom to reproduce"],
    examples: ["/atomic-skills:fix \"duplicates in /musicas listing\"", "/atomic-skills:fix"],
    args: [
      { name: "symptom", kind: "positional", required: false, description: "Observed bug or unexpected behavior. If omitted, skill prompts interactively." },
    ],
    dependencies: ["git"],
    related: ["hunt", "review-code"],
    tags: ["quality", "debugging", "tdd", "core"],
  },
  {
    id: "save-and-push",
    title: "Save & Push — Commit + Memory + Push",
    emoji: "💾",
    oneLiner: "Scan for secrets, group commits, save learnings, push safely",
    versionAdded: "1.0.0",
    summary: "Review conversation, save learnings to memory, commit and push work.",
    active: true,
    when: ["You finished a coherent piece of work", "About to switch context or end the session", "You want learnings persisted before forgetting"],
    whenNot: ["Work in progress, not yet a coherent commit", "Tests still failing", "You only want to commit (use git directly)"],
    examples: ["/atomic-skills:save-and-push"],
    dependencies: ["git"],
    related: ["project-status", "init-memory"],
    tags: ["workflow", "git", "memory", "core"],
  },
  {
    id: "review-plan",
    title: "Review Plan — Adversarial (Local + Codex)",
    emoji: "🔍",
    oneLiner: "Adversarial plan review with local/codex/both mode picker",
    versionAdded: "2.0.0",
    summary: "Adversarial review of an implementation plan. Step 0 picks mode: local self-loop, codex cross-model envelope, or both (local first → codex on cleaned plan). Optional cross-reference against external artifacts.",
    active: true,
    when: ["You finished writing a plan and want a structural review", "Significant plan about to enter execution (both mode recommended)", "Cross-model bug hunt against self-preference bias (codex or both)", "Plan was derived from a PRD/spec and you want coverage verification"],
    whenNot: ["Plan is still brainstorming (not structured yet)", "Trivial plan (skip review entirely)", "Codex CLI not installed and you need codex mode (use --mode=local)"],
    examples: ["/atomic-skills:review-plan docs/plans/migration.md", "/atomic-skills:review-plan docs/plans/migration.md --mode=local", "/atomic-skills:review-plan docs/plans/migration.md --mode=both"],
    args: [
      { name: "plan-path", kind: "positional", required: true, description: "Path to the plan markdown file under review." },
      { name: "--mode", kind: "option", required: false, description: "Force a review mode (local, codex, both, or the v2.x alias internal). Skips the Step 0a picker." },
      { name: "--no-cross-ref", kind: "flag", required: false, description: "Skip the Step 0b cross-ref picker; force internal-only." },
      { name: "--cross-ref", kind: "option", required: false, description: "Comma-separated list of artifact paths to cross-reference against. Skips the picker." },
      { name: "--artifacts", kind: "option", required: false, description: "Alias of --cross-ref (compat with v2.x)." },
      { name: "--allow-dirty", kind: "flag", required: false, description: "Pass through to the codex pre-flight; suppresses the dirty-tree abort." },
    ],
    outputArtifacts: [".atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md (codex/both modes)", ".atomic-skills/reviews/INDEX.md"],
    dependencies: ["codex", "git"],
    related: ["review-code"],
    tags: ["review", "planning", "adversarial", "cross-model"],
  },
  {
    id: "review-code",
    title: "Review Code — Adversarial (Local + Codex)",
    emoji: "🔬",
    oneLiner: "Adversarial code review with local/codex/both mode picker",
    versionAdded: "2.0.0",
    summary: "Adversarial review of code changes given a git ref (branch, commit, or range). Step 0 picks mode: local self-loop, codex cross-model envelope, or both (local first → codex on the same captured diff).",
    active: true,
    when: ["You finished a coherent code change", "Significant change about to merge (both mode recommended)", "Critical path (auth, payments, data integrity) — both mode", "Cheap pre-merge sanity check (local mode)"],
    whenNot: ["No git ref to review (and you don't want to commit/stash first)", "Trivial change already heavily reviewed", "Codex CLI not installed and you need codex mode (use --mode=local)"],
    examples: ["/atomic-skills:review-code main..HEAD", "/atomic-skills:review-code feat/new-feature --mode=local", "/atomic-skills:review-code main..HEAD --mode=both"],
    args: [
      { name: "git-ref", kind: "positional", required: true, description: "Branch, single commit, or commit range (a..b / a...b)." },
      { name: "--mode", kind: "option", required: false, description: "Force a review mode (local, codex, both). Skips the Step 0 picker." },
      { name: "--allow-dirty", kind: "flag", required: false, description: "Include working-tree changes in the captured diff; suppresses the dirty-tree abort." },
    ],
    outputArtifacts: [".atomic-skills/reviews/YYYY-MM-DD-HHMM-<slug>.md (codex/both modes)", ".atomic-skills/reviews/INDEX.md"],
    dependencies: ["codex", "git"],
    related: ["review-plan", "fix", "hunt"],
    tags: ["review", "code", "adversarial", "cross-model"],
  },
  {
    id: "project-status",
    title: "Project Status — Initiative Tracking",
    emoji: "📊",
    oneLiner: "View + daily mutations on the .atomic-skills/ tree",
    versionAdded: "1.5.0",
    summary: "View and daily-mutate Plan/Initiative/Task state in .atomic-skills/. Compact terminal view + browser via mdprobe. Stack frames, parked/emerged items, task transitions, phase-done/reopen, archive, scope-creep, codex review tracking. Creation, migration, and structural commands live in atomic-skills:project-plan.",
    active: true,
    when: ["Resuming after a break — view current state", "Pushing or popping a stack frame (lateral expansion)", "Parking lateral findings or surfacing emerged work", "Marking tasks done, advancing phases", "Archiving completed plans/initiatives", "Viewing drift / scope-creep / un-reviewed code"],
    whenNot: ["Starting a new plan — use atomic-skills:project-plan", "Creating a new initiative / task / phase — use atomic-skills:project-plan", "Migrating legacy files — use atomic-skills:project-plan migrate", "One-shot questions or work that fits in the current session"],
    examples: ["/atomic-skills:project-status", "/atomic-skills:project-status push \"investigating slow query\"", "/atomic-skills:project-status done T-005", "/atomic-skills:project-status phase-done"],
    subcommands: [
      { name: "push", signature: "<description>", description: "Open a lateral stack frame on top of the current work; type is inferred from the verb", example: "/atomic-skills:project-status push \"investigating slow query\"" },
      { name: "pop", signature: "[--resolve|--park|--emerge]", description: "Close the top frame with a destination: --resolve (drop), --park (note), or --emerge (follow-up)", example: "/atomic-skills:project-status pop --park" },
      { name: "park", signature: "<description>", description: "File a low-commitment note for later into parked[]; ratify gate forces a readable solves/trigger", example: "/atomic-skills:project-status park \"consider caching layer\"" },
      { name: "emerge", signature: "<description>", description: "File a real follow-up into emerged[] (same ratify gate); --target <phaseId> lands it in another phase", example: "/atomic-skills:project-status emerge \"auth refactor needed\"" },
      { name: "promote", signature: "<title-or-idx>", description: "Turn a parked item into a real task (assigns next T-NNN, carries its context forward)", example: "/atomic-skills:project-status promote 2" },
      { name: "done", signature: "<task-id>", description: "Mark a task done and stamp closedAt; if it was the last open task, surfaces phase-done or archive", example: "/atomic-skills:project-status done T-005" },
      { name: "phase-done", signature: "", description: "Verify every exit-gate criterion via its verifier, run a mandatory code review, then advance currentPhase", example: "/atomic-skills:project-status phase-done" },
      { name: "phase-reopen", signature: "[<phase-id>]", description: "Reverse a phase-done: restore the initiative to active, clear metAt on criteria, reset tasks to pending", example: "/atomic-skills:project-status phase-reopen F2" },
      { name: "archive", signature: "[<slug>]", description: "Move a finished plan or initiative to archive/ (archiving a plan cascades to its child initiatives)", example: "/atomic-skills:project-status archive v3-redesign" },
      { name: "switch", signature: "<slug>", description: "Pause the current plan/initiative and activate the target; offers to switch the plan too if it differs", example: "/atomic-skills:project-status switch my-feature" },
      { name: "why", signature: "<id>", description: "Read-only deep view of one item: status, ratified solves/trigger/assumptions, provenance, staleness", example: "/atomic-skills:project-status why T-005" },
      { name: "re-ratify", signature: "<id>", description: "Refresh a stale item: re-confirm the premises (bump review date) or rewrite solves/trigger/assumptions", example: "/atomic-skills:project-status re-ratify P-3" },
      { name: "scope-creep", signature: "", description: "Read-only drift report: phase growth %, scope expansion %, parked zombies, and stale-context items", example: "/atomic-skills:project-status scope-creep" },
      { name: "detect-scope", signature: "", description: "Suggest a scope.paths value from recent git activity on the branch, as a checklist you accept", example: "/atomic-skills:project-status detect-scope" },
      { name: "review-due", signature: "", description: "Run a cross-model codex review on the diff since the last review and record the result for the default view", example: "/atomic-skills:project-status review-due" },
    ],
    args: [
      { name: "--list", kind: "flag", required: false, description: "List all initiatives across all plans" },
      { name: "--plan", kind: "option", required: false, description: "Filter view to a specific plan slug" },
      { name: "--phase", kind: "option", required: false, description: "Filter view to a specific phase id" },
      { name: "--stack", kind: "flag", required: false, description: "Show only the active stack (compact view)" },
      { name: "--archived", kind: "flag", required: false, description: "Show archived items" },
    ],
    outputArtifacts: [".atomic-skills/PROJECT-STATUS.md", ".atomic-skills/plans/<slug>.md", ".atomic-skills/initiatives/<slug>.md", ".atomic-skills/status/config.json", ".atomic-skills/dispatches/<slug>.md (when promote-to-dispatch)"],
    dependencies: ["git"],
    related: ["fix", "save-and-push", "project-plan"],
    tags: ["tracking", "anchoring", "planning", "core"],
  },
  {
    id: "project-plan",
    title: "Project Plan — Create, Discover, Migrate",
    emoji: "🗺️",
    oneLiner: "Create + restructure + discover Plans and Initiatives",
    versionAdded: "2.0.0",
    summary: "Single entry-point for CREATE and STRUCTURAL operations on .atomic-skills/. Bootstrap multi-phase Plans, discover in-flight work across the repo (multi-source scan), adopt existing markdown plans, migrate legacy state, add initiatives/tasks/phases, split overgrown phases, batch re-articulate placeholder context. Sibling skill project-status handles VIEW + daily mutations.",
    active: true,
    when: ["Want to organize what the repo already has → `discover`", "Multi-phase project described in conversation → default bootstrap", "Existing markdown plan to capture → `adopt`", "Standalone initiative for single-phase work → `new`", "Add task/phase to active plan → `new-task` / `new-phase` / `split-phase`", "Legacy initiative needs schema 0.1 → `migrate`", "Post-migration batch context re-articulation → `re-bootstrap`"],
    whenNot: [".atomic-skills/ does not exist yet (run atomic-skills:project-status setup first)", "Daily tracking (view, push/pop, done, phase-done, etc.) — use project-status", "Just viewing existing plans (use project-status --plan <slug>)"],
    examples: ["/atomic-skills:project-plan discover", "/atomic-skills:project-plan v3-redesign", "/atomic-skills:project-plan adopt docs/plans/v3-redesign/00-master.md", "/atomic-skills:project-plan migrate mesh-restructure"],
    subcommands: [
      { name: "discover", signature: "[--dry-run|--commit] [--scope=<list>] [--scan=<path>]", description: "Scan the whole repo (git, PRs, docs, roadmaps, memory), cluster signals, and propose Plans + Initiatives for approve/reject", example: "/atomic-skills:project-plan discover" },
      { name: "adopt", signature: "<file.md>", description: "Capture an existing free-form markdown plan into structured Plan + Initiatives + Tasks; previews before materializing", example: "/atomic-skills:project-plan adopt docs/plans/v3-redesign/00-master.md" },
      { name: "new", signature: "<slug>", description: "Create one Initiative from the template, standalone or anchored to an active plan's phase; offers scope auto-detect", example: "/atomic-skills:project-plan new my-feature" },
      { name: "new-task", signature: "\"<title>\" [--target <phaseId>] [--blocked-by <id>] [--tags ...]", description: "Add a task to the active (or --target) initiative; records provenance and requires a ratified context block", example: "/atomic-skills:project-plan new-task --target F2 \"Add canary smoke test\"" },
      { name: "new-phase", signature: "<id> \"<title>\" --after <other-id>", description: "Insert a new phase into the active plan and materialize its initiative; sets dependsOn via --after, requires ratified context", example: "/atomic-skills:project-plan new-phase F0.5 \"Validation\" --after F0" },
      { name: "split-phase", signature: "<id>", description: "Split an over-sized phase into sub-phases, moving tasks (preserving provenance); archives the original as archived, not done", example: "/atomic-skills:project-plan split-phase F2" },
      { name: "migrate", signature: "<slug>", description: "Convert a legacy (pre-0.1) initiative file to schemaVersion 0.1; reports the field-mapping diff and flags placeholder context", example: "/atomic-skills:project-plan migrate sample-legacy" },
      { name: "re-bootstrap", signature: "<slug>", description: "After migrate: batch re-articulate every parked/emerged item still holding a placeholder into real ratified context", example: "/atomic-skills:project-plan re-bootstrap sample-legacy" },
    ],
    args: [
      { name: "slug", kind: "positional", required: false, description: "Plan slug for the default (bootstrap) flow. Omit and the skill prompts interactively." },
      { name: "--scan", kind: "option", required: false, description: "Extra source paths for discover (comma-separated). E.g. --scan=NOTES/,~/team-plans/" },
      { name: "--scope", kind: "option", required: false, description: "Discover: comma-separated source kinds (git,github,docs,roadmap,memory-local,memory-claude,claude-mem)" },
    ],
    outputArtifacts: [".atomic-skills/plans/<slug>.md", ".atomic-skills/initiatives/<slug>.md", ".atomic-skills/bootstrap-drafts/ (discover output)"],
    dependencies: ["git"],
    related: ["project-status", "review-plan"],
    tags: ["planning", "bootstrap", "create", "migrate", "core"],
  },
  {
    id: "prompt",
    title: "Prompt — Generate Optimized Prompt",
    emoji: "📝",
    oneLiner: "Generate a self-contained prompt with exact paths and guardrails",
    versionAdded: "1.0.0",
    summary: "Generate an optimized, self-contained prompt from a task description. Use when you need a precise prompt with exact file paths and guardrails.",
    active: true,
    when: ["You have a vague task and want to make it actionable", "You need to brief a parallel agent precisely", "You will hand off the work to a different session"],
    whenNot: ["You will execute the task in this same session", "You need a multi-phase plan (use project-plan)", "You want to dispatch many tasks (use parallel-dispatch)"],
    examples: ["/atomic-skills:prompt \"refactor auth middleware to use new session API\"", "/atomic-skills:prompt"],
    args: [
      { name: "task", kind: "positional", required: false, description: "Task description in natural language. If omitted, skill asks interactively." },
    ],
    related: ["parallel-dispatch", "fix", "project-plan"],
    tags: ["meta", "generation", "planning"],
  },
  {
    id: "hunt",
    title: "Hunt — Adversarial Tests",
    emoji: "🎯",
    oneLiner: "Adversarial tests from the spec, not the code — depth over breadth",
    versionAdded: "1.0.0",
    summary: "Write adversarial tests for existing code to find hidden bugs. Use when code lacks tests or you suspect untested edge cases. Requires a bounded scope — one class or function per run.",
    active: true,
    when: ["Code lacks tests", "You suspect untested edge cases", "Pre-merge quality check"],
    whenNot: ["Scope larger than 1 class or function", "Existing test suite is already comprehensive", "You want to add features (use prompt instead)"],
    examples: ["/atomic-skills:hunt src/matcher.php", "/atomic-skills:hunt src/auth/"],
    args: [
      { name: "target", kind: "positional", required: true, description: "File, directory, or function/class to hunt. Directory mode caps at 30 files." },
    ],
    dependencies: ["git"],
    related: ["fix", "review-code"],
    tags: ["testing", "quality", "pre-implementation"],
  },
  {
    id: "parallel-dispatch",
    title: "Parallel Dispatch — Independent Tasks",
    emoji: "🚀",
    oneLiner: "Dispatch a task list to N parallel sessions with verified isolation",
    versionAdded: "1.6.0",
    summary: "Dispatch a user-provided list of independent tasks to N parallel sessions with verified scope isolation and a batch id for tracking. Validates parallelism benefit (Q1-Q4 HARD-GATE) before exploring; proves scope disjointness via pairwise grep before generating prompts. Use when the user brings a consolidated task list — this skill does NOT invent tasks.",
    active: true,
    when: ["You have a finalized list of independent tasks", "Tasks have concrete file-path scopes", "You will be away while agents run"],
    whenNot: ["Work fits in the current session", "The list is still exploratory", "Tasks have hard sequential dependencies"],
    examples: ["/atomic-skills:parallel-dispatch task-list.md"],
    args: [
      { name: "task-list", kind: "positional", required: true, description: "Path to the markdown file containing the finalized task list." },
    ],
    outputArtifacts: [".atomic-skills/dispatches/<batch-id>.md"],
    dependencies: ["git"],
    related: ["parallel-dispatch-audit", "prompt"],
    tags: ["parallelism", "dispatch", "workflow"],
  },
  {
    id: "parallel-dispatch-audit",
    title: "Parallel Dispatch — Audit",
    emoji: "👁️",
    oneLiner: "Verify each batch deliverable on disk; fix or escalate with evidence",
    versionAdded: "1.6.0",
    summary: "Audit the output of a parallel-dispatch batch. Reads the plan file, verifies each agent's deliverables on disk against the user's original request, applies cosmetic fixes, and produces a report with pending decisions. HARD-GATEs on active batch (<2min commits) and read-only mode (≥5 issues). Use after parallel-dispatch agents complete.",
    active: true,
    when: ["A parallel-dispatch batch has completed", "You need objective verification of agent outputs"],
    whenNot: ["Agents are still running (commits less than 2 min old)", "You want to refactor what agents wrote (out of scope)"],
    examples: ["/atomic-skills:parallel-dispatch-audit onboard-ci"],
    args: [
      { name: "slug", kind: "positional", required: false, description: "Batch slug to audit. Defaults to the most recent dispatch." },
    ],
    outputArtifacts: [".atomic-skills/dispatches/<slug>.md (annotated with audit results)"],
    dependencies: ["git"],
    related: ["parallel-dispatch"],
    tags: ["parallelism", "audit", "review", "quality"],
  },
  {
    id: "debate",
    title: "Debate — Multi-Agent Roundtable",
    emoji: "🎭",
    oneLiner: "Roundtable of independent subagent personas for divergent thinking",
    versionAdded: "2.1.0",
    summary: "Facilitate a multi-voice debate where 2-4 personas argue as real, independent subagents — each spawned separately so it thinks for itself, presented unblended. Use for design debates, brainstorming, adversarial panels, or any time you want genuinely divergent perspectives instead of one model's averaged take.",
    active: true,
    when: ["You want genuinely divergent perspectives on an open question", "Debating a design, architecture, or product trade-off", "Brainstorming or widening the option space before deciding", "Running an adversarial review panel (dev + architect + QA cross-talk)"],
    whenNot: ["You have a finalized, disjoint task list (use parallel-dispatch)", "You need a single converged answer or committed artifacts", "A one-shot factual question with no perspectives to weigh"],
    examples: ["/atomic-skills:debate \"should we split the monolith now or after launch?\"", "/atomic-skills:debate --solo \"review this API design\"", "/atomic-skills:debate --roster personas/security-panel.yaml"],
    args: [
      { name: "topic", kind: "positional", required: false, description: "Opening topic for the roundtable. If omitted, the skill asks after showing the roster." },
      { name: "--solo", kind: "flag", required: false, description: "Role-play all personas in one response instead of spawning subagents (fallback when the spawn tool is unavailable)." },
      { name: "--model", kind: "option", required: false, description: "Force all subagents onto a specific model.", default: "model matched to each round's depth" },
      { name: "--roster", kind: "option", required: false, description: "Explicit roster file (YAML list or directory of persona files) instead of auto-detection." },
    ],
    related: ["parallel-dispatch", "review-plan", "review-code"],
    tags: ["brainstorming", "multi-agent", "roundtable", "divergent", "core"],
  },
  {
    id: "init-memory",
    title: "Init Memory — Persistent Context",
    emoji: "🧠",
    oneLiner: "Consolidate scattered memory into .ai/memory/ and wire it to the IDE",
    versionAdded: "1.0.0",
    summary: "Initialize persistent memory structure for cross-session context.",
    active: true,
    when: ["First time using atomic-skills in a project", "Memory directory missing or corrupted", "You want to standardize the memory layout"],
    whenNot: ["Memory already initialized and healthy"],
    examples: ["/atomic-skills:init-memory"],
    outputArtifacts: [".ai/memory/MEMORY.md"],
    related: ["save-and-push"],
    tags: ["memory", "setup"],
  },
]
