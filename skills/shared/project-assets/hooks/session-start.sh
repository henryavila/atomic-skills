#!/usr/bin/env bash
# atomic-skills:project — SessionStart hook (v2, 3-level + aiDeck-aware)
# Emits a hierarchical PROJECT-STATUS view via Claude Code's additionalContext.
#
# Hierarchy (when present):
#   PROJECT-STATUS.md index  →  Active Plan  →  Current phase's Initiative
# Falls back to a standalone initiative matched by branch when no plan is active.
#
# Hints surfaced:
#   - branch mismatch (Plan-level and Initiative-level)
#   - phase-transition (initiative has 0 pending/active tasks)
#   - aiDeck dashboard URL when ~/.aideck/env present (writeEnvFile on serve,
#     removeEnvFile on shutdown — see aideck/src/server/env-file.ts)
set -euo pipefail

PROJ_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
ASKILLS_DIR="$PROJ_DIR/.atomic-skills"
PROJECTS_DIR="$ASKILLS_DIR/projects"          # nested layout root: projects/<id>/<slug>/
PLANS_DIR="$ASKILLS_DIR/plans"                # legacy flat layout
INITIATIVES_DIR="$ASKILLS_DIR/initiatives"    # legacy flat layout

# Project index: prefer the top-level PROJECT-STATUS.md (coexistence fallback);
# else the first per-project index in the nested tree.
STATUS_FILE="$ASKILLS_DIR/PROJECT-STATUS.md"
if [[ ! -f "$STATUS_FILE" && -d "$PROJECTS_DIR" ]]; then
  STATUS_FILE=$(find "$PROJECTS_DIR" -mindepth 2 -maxdepth 2 -type f -name 'PROJECT-STATUS.md' 2>/dev/null | sort | head -1)
fi

# --- helpers ----------------------------------------------------------------

# get_field <file> <key>  → prints the value of a top-level frontmatter scalar.
# Handles `key: value`, `key: 'value'`, and `key: "value"`. Only scans within
# the leading `---` ... `---` block; ignores body matches.
get_field() {
  local file=$1 key=$2
  [[ -f "$file" ]] || return 0
  awk -v key="$key" '
    BEGIN { fm = 0 }
    /^---[[:space:]]*$/ { fm++; if (fm == 2) exit; next }
    fm == 1 {
      pat = "^" key ":[[:space:]]*"
      if ($0 ~ pat) {
        sub(pat, "", $0)
        # strip surrounding single or double quotes
        sub(/^['"'"'"]/, "", $0)
        sub(/['"'"'"][[:space:]]*$/, "", $0)
        # strip trailing inline comment
        sub(/[[:space:]]+#.*$/, "", $0)
        print $0
        exit
      }
    }
  ' "$file"
}

# plan_slug_of <plan-file>  → the plan's slug. Nested plan files are named
# `plan.md`, so the slug is the parent directory name; legacy flat plans are
# `<slug>.md`, so the slug is the basename minus `.md`.
plan_slug_of() {
  local f=$1
  if [[ "$(basename "$f")" == "plan.md" ]]; then
    basename "$(dirname "$f")"
  else
    basename "$f" .md
  fi
}

# list_plan_files  → every plan file across BOTH layouts, one per line:
# nested `projects/<id>/<slug>/plan.md` first, then legacy flat `plans/*.md`.
list_plan_files() {
  [[ -d "$PROJECTS_DIR" ]] && \
    find "$PROJECTS_DIR" -mindepth 3 -maxdepth 3 -type f -name 'plan.md' 2>/dev/null
  [[ -d "$PLANS_DIR" ]] && \
    find "$PLANS_DIR" -maxdepth 1 -type f -name '*.md' ! -name '*.rendered.md' 2>/dev/null
}

# phases_dir_of <plan-file>  → the directory holding that plan's phase
# initiatives: the sibling `phases/` dir (nested) or the legacy flat
# `initiatives/` dir.
phases_dir_of() {
  local f=$1
  if [[ "$(basename "$f")" == "plan.md" ]]; then
    echo "$(dirname "$f")/phases"
  else
    echo "$INITIATIVES_DIR"
  fi
}

# list_phase_files  → every phase-initiative file across BOTH layouts:
# nested `projects/*/*/phases/*.md` (excluding archive/), then legacy
# flat `initiatives/*.md`. Used by the standalone branch-match fallback.
list_phase_files() {
  [[ -d "$PROJECTS_DIR" ]] && \
    find "$PROJECTS_DIR" -type f -name '*.md' ! -name '*.rendered.md' -path '*/phases/*' ! -path '*/phases/archive/*' 2>/dev/null
  [[ -d "$INITIATIVES_DIR" ]] && \
    find "$INITIATIVES_DIR" -maxdepth 1 -type f -name '*.md' ! -name '*.rendered.md' 2>/dev/null
}

# count_pending_tasks <file>  → number of tasks whose status is NOT done.
# The task status enum is {pending, active, done, blocked} (see
# meta/schemas/initiative.schema.json). `blocked` is unfinished work — counting
# only pending/active would let a phase report "0 remaining" while blocked
# tasks still need a human decision. Scans the YAML region between `tasks:`
# and the next top-level key, inside frontmatter only. Robust against
# parked/emerged blocks (which have no `status`) and quoted scalars
# (`status: "pending"` or `status: 'pending'`).
count_pending_tasks() {
  local file=$1
  [[ -f "$file" ]] || { echo 0; return 0; }
  awk '
    BEGIN { fm = 0; in_tasks = 0; count = 0 }
    /^---[[:space:]]*$/ {
      fm++
      if (fm == 2) { print count; exit }
      next
    }
    fm == 1 && /^tasks:[[:space:]]*$/ { in_tasks = 1; next }
    fm == 1 && in_tasks && /^[A-Za-z][A-Za-z0-9_]*:/ { in_tasks = 0 }
    fm == 1 && in_tasks && /^[[:space:]]+status:[[:space:]]*['"'"'"]?(pending|active|blocked)['"'"'"]?([[:space:]]|$)/ { count++ }
    END { if (fm < 2) print count }
  ' "$file"
}

# resolve_detector  → absolute path to scripts/detect-completion.js, resolved
# PWD repo → global npm → installed runtime → recorded package-root. The
# package-root candidate (written by install to ~/.atomic-skills/package-root)
# points at the package dir that has scripts/ AND its node_modules, so the
# detector resolves WITH its deps for an npx/local install where the first three
# paths miss (F-002). Prints nothing + returns 1 when unresolvable (fail-open:
# the session must never be blocked by a missing detector).
resolve_detector() {
  local c pkg_root=""
  [[ -f "$HOME/.atomic-skills/package-root" ]] && pkg_root="$(<"$HOME/.atomic-skills/package-root")"
  for c in "$PROJ_DIR/scripts/detect-completion.js" \
           "$(npm root -g 2>/dev/null)/@henryavila/atomic-skills/scripts/detect-completion.js" \
           "$HOME/.atomic-skills/scripts/detect-completion.js" \
           ${pkg_root:+"$pkg_root/scripts/detect-completion.js"}; do
    [[ -f "$c" ]] && { printf '%s' "$c"; return 0; }
  done
  return 1
}

# emit_json <markdown-context>  → prints the additionalContext JSON envelope.
emit_json() {
  local ctx=$1
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg ctx "$ctx" \
      '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
  elif command -v python3 >/dev/null 2>&1; then
    local escaped
    escaped=$(printf '%s' "$ctx" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
    printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":%s}}\n' "$escaped"
  else
    # Last-resort manual escape. Loses fidelity on newlines/backslashes but
    # never blocks the session.
    local escaped
    escaped='"'$(printf '%s' "$ctx" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')'"'
    printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":%s}}\n' "$escaped"
  fi
}

# --- context assembly -------------------------------------------------------

context=""
# Prefer `symbolic-ref` — works on freshly-initialized repos with no commits
# (where `rev-parse --abbrev-ref HEAD` errors); fails cleanly on detached HEAD,
# which we want treated as "no branch" anyway.
branch=$(git -C "$PROJ_DIR" symbolic-ref --short HEAD 2>/dev/null \
  || git -C "$PROJ_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null \
  || echo "")
[[ "$branch" == "HEAD" ]] && branch=""

# 1. Project-level index — first chunk of PROJECT-STATUS.md.
if [[ -f "$STATUS_FILE" ]]; then
  context+="## Active Project Status"$'\n'
  context+="$(head -30 "$STATUS_FILE")"$'\n\n'
fi

# 2. Active Plan — prefer one whose `branch:` matches current branch; else
#    pick the most recently modified active plan. Surface ambiguity warning
#    when multiple active plans exist with no branch tiebreaker.
active_plan=""
active_plan_count=0
if [[ -d "$PROJECTS_DIR" || -d "$PLANS_DIR" ]]; then
  branch_matched=""
  newest=""
  newest_mtime=0
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    status=$(get_field "$f" status)
    [[ "$status" != "active" ]] && continue
    active_plan_count=$((active_plan_count + 1))
    pbranch=$(get_field "$f" branch)
    if [[ -n "$branch" && -n "$pbranch" && "$pbranch" == "$branch" && -z "$branch_matched" ]]; then
      branch_matched="$f"
    fi
    mtime=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || echo 0)
    if (( mtime > newest_mtime )); then
      newest_mtime=$mtime
      newest="$f"
    fi
  done < <(list_plan_files)
  active_plan="${branch_matched:-$newest}"
fi

active_initiative=""
current_phase_id=""

if [[ -n "$active_plan" ]]; then
  plan_slug=$(plan_slug_of "$active_plan")
  current_phase_id=$(get_field "$active_plan" currentPhase)
  plan_branch=$(get_field "$active_plan" branch)
  plan_title=$(get_field "$active_plan" title)

  context+="## Active Plan: ${plan_slug}"
  [[ -n "$plan_title" ]] && context+=" — ${plan_title}"
  context+=$'\n\n'
  context+="- Current phase: \`${current_phase_id:-<none>}\`"$'\n'
  if [[ -n "$plan_branch" ]]; then
    context+="- Plan branch: \`${plan_branch}\`"$'\n'
    if [[ -n "$branch" && "$plan_branch" != "$branch" ]]; then
      context+=$'\n'"⚠️ Plan branch \`${plan_branch}\` ≠ current branch \`${branch}\`. Switch branches or update the plan's \`branch:\` field."$'\n'
    fi
  fi
  if (( active_plan_count > 1 )); then
    context+=$'\n'"⚠️ ${active_plan_count} active plans found — using \`${plan_slug}\` (branch-match or most-recent). Disambiguate by setting \`branch:\` on each plan."$'\n'
  fi
  context+=$'\n'

  # 3. Match the phase's initiative — same parentPlan + phaseId, status active.
  #    Resolve the phase-initiative dir from the plan's layout (nested sibling
  #    `phases/`, or legacy flat `initiatives/`).
  phases_dir=$(phases_dir_of "$active_plan")
  if [[ -d "$phases_dir" && -n "$current_phase_id" ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      [[ "$(get_field "$f" parentPlan)" == "$plan_slug" ]] || continue
      [[ "$(get_field "$f" phaseId)" == "$current_phase_id" ]] || continue
      [[ "$(get_field "$f" status)" == "active" ]] || continue
      active_initiative="$f"
      break
    done < <(find "$phases_dir" -maxdepth 1 -type f -name '*.md' ! -name '*.rendered.md' 2>/dev/null)
  fi
fi

# 4. Standalone fallback — no plan or no phase initiative: branch-match active
#    initiative (preserves prior hook behavior).
if [[ -z "$active_initiative" && -n "$branch" ]] && [[ -d "$PROJECTS_DIR" || -d "$INITIATIVES_DIR" ]]; then
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    [[ "$(get_field "$f" status)" == "active" ]] || continue
    fbranch=$(get_field "$f" branch)
    if [[ "$fbranch" == "$branch" || "$fbranch" == "${branch%%/*}" ]]; then
      active_initiative="$f"
      break
    fi
  done < <(list_phase_files)
fi

# 5. Inject initiative detail + branch + phase-transition signals.
if [[ -n "$active_initiative" ]]; then
  slug=$(basename "$active_initiative" .md)
  init_branch=$(get_field "$active_initiative" branch)
  parent_plan=$(get_field "$active_initiative" parentPlan)
  phase_id=$(get_field "$active_initiative" phaseId)

  context+="## Current Initiative: ${slug}"
  if [[ -n "$parent_plan" && -n "$phase_id" ]]; then
    context+=" (${parent_plan}/${phase_id})"
  elif [[ -z "$parent_plan" ]]; then
    context+=" (standalone)"
  fi
  context+=$'\n\n'

  if [[ -n "$init_branch" && "$init_branch" != "null" && -n "$branch" && "$init_branch" != "$branch" ]]; then
    context+="⚠️ Initiative branch \`${init_branch}\` ≠ current branch \`${branch}\`. Switch branches or update the initiative."$'\n\n'
  fi

  pending=$(count_pending_tasks "$active_initiative")
  if [[ "$pending" == "0" ]]; then
    context+="🔔 Initiative has 0 pending/active tasks but \`status\` is still \`active\`. Run \`atomic-skills:project phase-done\` to close the phase."$'\n\n'
  fi

  context+="$(head -40 "$active_initiative")"$'\n'
fi

# 6. Completion drift: delegate candidate-finding to the shared deterministic
#    detector (scripts/detect-completion.js) instead of the brittle `[T-NNN]`
#    commit scan. The detector classifies open tasks / pending gates by a
#    changed-deliverable signal (output-exists / commit-ref) — a verifier's
#    presence alone is NEVER a signal, and acceptance[] prose is never parsed.
#    Fail-open by construction: a missing detector, missing node, or any error
#    emits nothing and never blocks the session. The hook never mutates and
#    never runs a verifier (closing is the `reconcile` verb's job).
LAST_SESSION_FILE="$ASKILLS_DIR/status/last-session.json"
if [[ -n "$active_initiative" ]] && git -C "$PROJ_DIR" rev-parse --verify -q HEAD >/dev/null 2>&1; then
  detector=$(resolve_detector || true)
  if [[ -n "$detector" ]] && command -v node >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
    drift_json=$(node "$detector" "$PROJ_DIR" --json 2>/dev/null || true)
    if [[ -n "$drift_json" ]]; then
      drift_n=$(printf '%s' "$drift_json" | jq -r '(.candidates // []) | length' 2>/dev/null || echo 0)
      if [[ "$drift_n" =~ ^[0-9]+$ && "$drift_n" -gt 0 ]]; then
        context+=$'\n'"## 📋 ${drift_n} task(s)/gate(s) look done in the repo but are still open"$'\n\n'
        context+="$(printf '%s' "$drift_json" | jq -r '(.candidates // [])[] | "  \(.kind) \(.id) — \(.evidence)"' 2>/dev/null || true)"$'\n'
        context+="Run \`atomic-skills:project reconcile\` to dispose each (verifier-aware; never auto-closed)."$'\n'
      fi
    fi
  fi

  # Update last-session marker with current HEAD (preserved from the prior hook).
  current_head=$(git -C "$PROJ_DIR" rev-parse HEAD 2>/dev/null || echo "")
  if [[ -n "$current_head" ]]; then
    mkdir -p "$(dirname "$LAST_SESSION_FILE")"
    jq -n --arg commit "$current_head" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --arg branch "$branch" \
      '{lastKnownCommit: $commit, lastSessionAt: $ts, branch: $branch}' \
      > "$LAST_SESSION_FILE" 2>/dev/null || true
  fi
fi

# 7. Dashboard URL hint — surfaces the aiDeck URL when running.
DASHBOARD_ENV="${HOME:-}/.atomic-skills/env"
LEGACY_AIDECK_ENV="${HOME:-}/.aideck/env"
dashboard_url=""
if [[ -f "$DASHBOARD_ENV" ]]; then
  dashboard_url=$(grep -E "^export AS_DASHBOARD_URL=" "$DASHBOARD_ENV" 2>/dev/null | head -1 \
    | sed -E "s/^export AS_DASHBOARD_URL=//; s/^'//; s/'\$//; s/^\"//; s/\"\$//")
fi
if [[ -z "$dashboard_url" && -f "$LEGACY_AIDECK_ENV" ]]; then
  dashboard_url=$(grep -E "^export AIDECK_URL=" "$LEGACY_AIDECK_ENV" 2>/dev/null | head -1 \
    | sed -E "s/^export AIDECK_URL=//; s/^'//; s/'\$//; s/^\"//; s/\"\$//")
fi
if [[ -n "$dashboard_url" ]]; then
  context+=$'\n'"## Dashboard running"$'\n\n'
  context+="${dashboard_url}"$'\n'
fi

emit_json "$context"
exit 0
