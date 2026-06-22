# Atomic Skills

Repositório de skills otimizados para AI IDEs.
Skills usam namespace `atomic-skills` (subdiretório) e ficam em `skills/`.

## Memória

Consulte `.ai/memory/MEMORY.md` antes de implementar.
Atualize a memória ao aprender algo relevante para sessões futuras.

## Compatibilidade entre Agentes

Para manter compatibilidade entre Claude Code, Gemini CLI e outros:

1. **Abstração de Ferramentas**: NUNCA use nomes de ferramentas fixos como `Bash` ou `Read tool` nos arquivos `.md` de skills. Use as variáveis globais:
   - `{{BASH_TOOL}}`, `{{READ_TOOL}}`, `{{WRITE_TOOL}}`, `{{REPLACE_TOOL}}`, `{{GREP_TOOL}}`, `{{GLOB_TOOL}}`, `{{INVESTIGATOR_TOOL}}`, `{{ASK_USER_QUESTION_TOOL}}`.
2. **Argumentos**: Use `{{ARG_VAR}}` em vez de `$ARGUMENTS`.
3. **Renderização Condicional**: Use `{{#if ide.gemini}}` ou `{{#if ide.claude-code}}` para instruções específicas.
4. **Guia Completo**: Veja `docs/kb/gemini-cli-compatibility.md`.

## Rastreamento de iniciativas

Este repo tem a skill `atomic-skills:project` (router fino + detalhe lazy em `skills/shared/project-assets/`). Estado operacional canônico em `.atomic-skills/` é mantido via esta skill + hooks opcionais. Execute `atomic-skills:project` para setup na primeira vez, depois para operação durante desenvolvimento.

## Install / Uninstall parity (HARD RULE)

Every persistent mutation the installer (`src/install.js`) makes MUST have a
matching reversal in the uninstaller (`src/uninstall.js`), OR be listed in the
allowlist below. This is enforced by a test, not by discipline alone.

**Enforcer:** `tests/install-uninstall-roundtrip.test.js` installs everything
into a tmp `$HOME`/repo, uninstalls, and asserts the filesystem returns to its
pre-install state. The snapshot is content-aware (sha256 per file) and the diff
is bidirectional — it catches added residue, deleted pre-existing files, AND
modified contents. When you add an install action, this test fails until you add
its reversal — that is the gate.

**Allowlist (deliberate residue, allowed by content):**
- _(none)_ — the installer makes no mutation outside the manifest-tracked files,
  so the round-trip requires the repo to return to baseline byte-for-byte.
  It used to append a `.atomic-skills/` line to `.gitignore`; that was removed
  (2026-06-05) because the `.atomic-skills/` project-tracking tree is now meant
  to be versioned in git, not ignored. The installer leaves `.gitignore`
  untouched. Do NOT re-introduce a `.gitignore` mutation.

**Out of install-parity scope (NOT an allowlist entry):**
- `~/.aideck/` — the user's provisioned plans/initiatives. The installer never
  creates it (it is provisioned lazily at runtime by the project skill), so it
  is outside the parity contract entirely. The round-trip never sees it.

## Testing & verification

- `npm test` — full unit suite (Node test runner).
- `npm run test:hooks` — shell hook tests.
- `npm run validate-skills` — skill schema validation.
- TDD: write the failing test, watch it fail, implement minimally, watch it
  pass, commit. Never claim green without running the command.

## install.js ↔ uninstall.js map

**The flip (T-F3-4) made install/uninstall thin over the
`@henryavila/minimalist-installer` engine (consumed via `file:` link).** The
install-base file domain is now a JOURNAL of reversible effects — `installSkills`
delegates to `buildInstaller().install()` (`src/installer.js`), and `uninstall`
calls `buildInstaller({}).uninstall()` which **replays the journal in reverse**
(`Driver.uninstall` → `replayReverse` + `removeManifest`). No consumer writes
revert logic; reversibility is a property of each effect. The manifest is
**hybrid**: the journal (`effects[]`) is authoritative for uninstall, and a
derived legacy `files{}` map + metadata (`version/language/ides/modules`) are
patched on for the status/compat readers.

| Install action | Effect (journal) → reversal |
|---|---|
| Skill/command `.md`, namespace root, `_assets/` | `reconcileFileSet` → `revert` (deletes only files whose disk hash matches the installed hash — P3) |
| `version-check.sh` (auto-update hook, executable) | `stageRuntimeArtifacts` → `revert` (removes only paths it created) |
| `SessionStart` entry in `settings.json` (merge) | `jsonMerge` → `revert` (surgical: subtracts only the delta; deletes the file only if it created it and it emptied) |
| `manifest.json` (the journal) | `removeManifest` (unlink + prune) |

**Orchestrated OUTSIDE the journal** (the journal's blind `replayReverse` cannot
express a conditional, refcounted, or cross-version-format reclaim):

| Install action | Reversal |
|---|---|
| Runtime `~/.atomic-skills/{bin,dashboard,aideck-consumer,src,package-root}` | `removeRuntimeArtifacts` — reclaimed only when the LAST install leaves |
| Cross-install refcount `~/.atomic-skills/installs.json` | `registerInstall` ↔ `unregisterInstall` (returns remaining count; 0 → reclaim runtime) |
| Legacy-namespace orphans at obsolete paths | `findLegacyOrphans`/`removeLegacyOrphans` (frontmatter safelist = the only ownership proof, P3) |

The aiDeck **bin** (`bin/aideck.mjs`, an argv[1]-rewrite launcher shim) and
**dashboard** (the aiDeck client) are restaged by `installRuntimeArtifacts` from
the published `@henryavila/aideck` npm dependency (T-004). When the dependency is
not resolvable (pre-publish / stripped checkout) those two are skipped; the
consumer template + provisioner always stage.

A **pre-kernel (legacy) install** (manifest with `files{}` but no `effects`) is
adopted into journal ownership records by `migrateLegacyInstall` (T-F3-6) at the
start of `install()` — so the Driver's update/uninstall reverse it without
clobbering files the user modified since the legacy install.

The installer no longer mutates `.gitignore` (the `.atomic-skills/` tree is
tracked, not ignored), so there is no `.gitignore` row to reverse.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->