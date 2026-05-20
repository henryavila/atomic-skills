#!/usr/bin/env bash
# atomic-skills:project-status — SessionStart hook (v2, 3-level + aiDeck-aware)
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
STATUS_FILE="$ASKILLS_DIR/PROJECT-STATUS.md"
PLANS_DIR="$ASKILLS_DIR/plans"
INITIATIVES_DIR="$ASKILLS_DIR/initiatives"

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
if [[ -d "$PLANS_DIR" ]]; then
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
    mtime=$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null || echo 0)
    if (( mtime > newest_mtime )); then
      newest_mtime=$mtime
      newest="$f"
    fi
  done < <(find "$PLANS_DIR" -maxdepth 1 -type f -name '*.md' ! -name '*.rendered.md' 2>/dev/null)
  active_plan="${branch_matched:-$newest}"
fi

active_initiative=""
current_phase_id=""

if [[ -n "$active_plan" ]]; then
  plan_slug=$(basename "$active_plan" .md)
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
  if [[ -d "$INITIATIVES_DIR" && -n "$current_phase_id" ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      [[ "$(get_field "$f" parentPlan)" == "$plan_slug" ]] || continue
      [[ "$(get_field "$f" phaseId)" == "$current_phase_id" ]] || continue
      [[ "$(get_field "$f" status)" == "active" ]] || continue
      active_initiative="$f"
      break
    done < <(find "$INITIATIVES_DIR" -maxdepth 1 -type f -name '*.md' ! -name '*.rendered.md' 2>/dev/null)
  fi
fi

# 4. Standalone fallback — no plan or no phase initiative: branch-match active
#    initiative (preserves prior hook behavior).
if [[ -z "$active_initiative" && -d "$INITIATIVES_DIR" && -n "$branch" ]]; then
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    [[ "$(get_field "$f" status)" == "active" ]] || continue
    fbranch=$(get_field "$f" branch)
    if [[ "$fbranch" == "$branch" || "$fbranch" == "${branch%%/*}" ]]; then
      active_initiative="$f"
      break
    fi
  done < <(find "$INITIATIVES_DIR" -maxdepth 1 -type f -name '*.md' ! -name '*.rendered.md' 2>/dev/null)
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
    context+="🔔 Initiative has 0 pending/active tasks but \`status\` is still \`active\`. Run \`atomic-skills:project-status phase-done\` to close the phase."$'\n\n'
  fi

  context+="$(head -40 "$active_initiative")"$'\n'
fi

# 6. Dashboard URL hint — `atomic-skills serve` writes ~/.atomic-skills/env on
# startup and removes it on shutdown; the SessionStart hook surfaces the URL
# so the AI sees where the user's dashboard is running. Falls back to the
# legacy ~/.aideck/env path for installations that started a bare `aideck
# serve` outside the atomic-skills wrapper.
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
