// GENERATED — do not edit. Source: meta/skills.yaml.
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
    oneLiner: "Save learnings to memory, group commits, push safely",
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
    oneLiner: "Canonical per-initiative status tree with stack + parked + emerged",
    versionAdded: "1.5.0",
    summary: "Canonical per-initiative status tracking. Maintains .atomic-skills/ tree with stack + tasks + parked + emerged per initiative. Terminal compact view + browser via mdprobe. Auto-installs CLAUDE.md HARD-GATE + AGENTS.md redirect + Claude Code hooks (SessionStart injection, Stop predicate in dry-run). Use whenever starting, resuming, pushing/popping stack frames, parking lateral findings, or viewing status across sessions and worktrees.",
    active: true,
    when: ["Starting a new piece of work", "Resuming after a break", "Pushing or popping a stack frame", "Parking lateral findings or emerging new initiatives", "Viewing status across sessions or worktrees"],
    whenNot: ["One-shot questions", "Work that fits entirely in the current session", "Creating a multi-phase plan (use project-plan instead)"],
    examples: ["/atomic-skills:project-status", "/atomic-skills:project-status new my-feature", "/atomic-skills:project-status push \"investigating slow query\"", "/atomic-skills:project-status done T-005"],
    subcommands: [
      { name: "new-plan", signature: "<slug>", description: "Bootstrap a new Plan via the project-plan skill", example: "/atomic-skills:project-status new-plan v3-redesign" },
      { name: "new", signature: "<slug>", description: "Create a new Initiative (standalone or under active plan)", example: "/atomic-skills:project-status new my-feature" },
      { name: "push", signature: "<description>", description: "Push a new stack frame (lateral expansion)", example: "/atomic-skills:project-status push \"investigating slow query\"" },
      { name: "pop", signature: "[--resolve|--park|--emerge]", description: "Pop top frame with destination", example: "/atomic-skills:project-status pop --park" },
      { name: "park", signature: "<description>", description: "Add a parked item (note for later, no decision yet)", example: "/atomic-skills:project-status park \"consider caching layer\"" },
      { name: "emerge", signature: "<description>", description: "Add an emerged finding (real follow-up worth promoting)", example: "/atomic-skills:project-status emerge \"auth refactor needed\"" },
      { name: "promote", signature: "<title-or-idx>", description: "Promote a parked item to a real task", example: "/atomic-skills:project-status promote 2" },
      { name: "done", signature: "<task-id>", description: "Mark task done; triggers phase-completion check if last", example: "/atomic-skills:project-status done T-005" },
      { name: "phase-done", signature: "", description: "Verify exit gates, advance to next phase (prompts codex review)", example: "/atomic-skills:project-status phase-done" },
      { name: "phase-reopen", signature: "[<phase-id>]", description: "Reverse of phase-done — clears metAt on exit criteria", example: "/atomic-skills:project-status phase-reopen F2" },
      { name: "archive", signature: "[<slug>]", description: "Move plan/initiative to archive/ (cascades from plan to children)", example: "/atomic-skills:project-status archive v3-redesign" },
      { name: "switch", signature: "<slug>", description: "Pause current active plan/initiative, set target as active", example: "/atomic-skills:project-status switch my-feature" },
      { name: "migrate", signature: "<slug>", description: "Migrate a legacy file to schema 0.1", example: "/atomic-skills:project-status migrate sample-legacy" },
      { name: "re-ratify", signature: "<id>", description: "Re-articulate context of an existing item (stale lastReviewedAt)", example: "/atomic-skills:project-status re-ratify P-3" },
      { name: "re-bootstrap", signature: "<slug>", description: "Batch re-articulate placeholder context after migrate", example: "/atomic-skills:project-status re-bootstrap sample-legacy" },
      { name: "scope-creep", signature: "", description: "On-demand drift report (read-only, surfaces stale items)", example: "/atomic-skills:project-status scope-creep" },
      { name: "detect-scope", signature: "", description: "Suggest scope.paths value based on recent git activity", example: "/atomic-skills:project-status detect-scope" },
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
    title: "Project Plan — Multi-Phase Plan Bootstrap",
    emoji: "🗺️",
    oneLiner: "Bootstrap a multi-phase Plan with child Initiatives + Tasks",
    versionAdded: "3.0.0",
    summary: "Bootstrap a multi-phase Plan in .atomic-skills/plans/<slug>.md with N child Initiatives + Tasks. Entry point for starting planning work — the creator counterpart to project-status (the manager). Decomposes a markdown plan into structured Plan + Initiatives + Tasks; optionally delegates discovery and plan-writing to superpowers. Use the `adopt` mode to retroactively capture an existing markdown plan.",
    active: true,
    when: ["User describes a multi-phase project (\"redo our admin UI\", \"rebuild matching\")", "A free-form plan markdown exists somewhere and should be captured (use `adopt`)", "A `project-status:new` invocation was pushed back as \"bigger than one initiative\""],
    whenNot: ["Single-phase work that fits in one initiative (use `project-status:new`)", ".atomic-skills/ does not exist yet (run `atomic-skills:project-status` setup first)", "You only need to view existing plans (use `project-status --plan <slug>`)"],
    examples: ["/atomic-skills:project-plan v3-redesign", "/atomic-skills:project-plan adopt docs/superpowers/plans/v3-redesign/00-master.md"],
    subcommands: [
      { name: "adopt", signature: "<file.md>", description: "Capture an existing markdown plan into structured Plan + Initiatives + Tasks", example: "/atomic-skills:project-plan adopt docs/plans/v3-redesign/00-master.md" },
    ],
    args: [
      { name: "slug", kind: "positional", required: false, description: "Plan slug for the default (bootstrap) flow. Omit and the skill prompts interactively." },
    ],
    outputArtifacts: [".atomic-skills/plans/<slug>.md", ".atomic-skills/initiatives/<slug>.md"],
    dependencies: ["git"],
    related: ["project-status", "review-plan"],
    tags: ["planning", "bootstrap", "core"],
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
    oneLiner: "Write adversarial tests to break code, not confirm it",
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
    oneLiner: "Audit output of a parallel-dispatch batch, apply fixes, report",
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
    id: "init-memory",
    title: "Init Memory — Persistent Context",
    emoji: "🧠",
    oneLiner: "Centralize project memory to .ai/memory/",
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
