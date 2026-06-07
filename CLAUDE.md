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

| Install action | Reversal |
|---|---|
| Skill/command `.md`, namespace root, `_assets/`, `version-check.sh` (manifest) | manifest loop + `pruneEmptyParents` |
| Runtime `~/.atomic-skills/{bin,dashboard,aideck-consumer,src}` | `removeRuntimeArtifacts` (user scope only) |

The aiDeck **bin** (`bin/aideck.mjs`, an argv[1]-rewrite launcher shim) and
**dashboard** (the aiDeck client) are restaged by `installRuntimeArtifacts` from
the published `@henryavila/aideck` npm dependency (T-004) — the vendored
single-file bundle (`dist/aideck.mjs` + `vendor/aideck-runtime/`) was removed.
When the dependency is not resolvable (pre-publish / stripped checkout) those two
are skipped; the consumer template + provisioner always stage. The reversal is
unchanged because the install *footprint paths* are identical — only the content
source moved.
| `SessionStart` entry in `settings.json` (merge) | `removeAutoUpdateHook` (surgical; deletes the file only if the installer created it and it emptied) |
| `manifest.json` | unlink + prune |

The installer no longer mutates `.gitignore` (the `.atomic-skills/` tree is
tracked, not ignored), so there is no `.gitignore` row to reverse.
