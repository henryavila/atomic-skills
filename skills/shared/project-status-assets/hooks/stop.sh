#!/usr/bin/env bash
# atomic-skills:project-status — Stop hook (v2, scope-drift detection)
#
# Compares files written during the current turn vs the active initiative's
# `scope.paths`. >50% out-of-scope writes surface a drift warning; the warning
# is logged in dry-run mode (default) and blocks via exit 2 only when
# `strict_mode: true` in config.json. Scope-less initiatives (no `scope.paths`)
# skip drift checks entirely. Loop prevention + SKIP-flag bypass are preserved
# from the v1 hook.
set -euo pipefail

PROJ_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
ASKILLS_DIR="$PROJ_DIR/.atomic-skills"
PLANS_DIR="$ASKILLS_DIR/plans"
INITIATIVES_DIR="$ASKILLS_DIR/initiatives"
CONFIG="$ASKILLS_DIR/status/config.json"
DRIFT_LOG="$ASKILLS_DIR/status/drift.log"
SKIP_FLAG="$ASKILLS_DIR/status/SKIP"

# --- helpers ----------------------------------------------------------------

# Mirrors session-start.sh's parser. Reads a top-level frontmatter scalar.
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
        sub(/^['"'"'"]/, "", $0)
        sub(/['"'"'"][[:space:]]*$/, "", $0)
        sub(/[[:space:]]+#.*$/, "", $0)
        print $0
        exit
      }
    }
  ' "$file"
}

# Reads the `scope.paths` list from an initiative frontmatter, one entry per
# stdout line. Outputs nothing when the field is absent or empty.
get_scope_paths() {
  local file=$1
  [[ -f "$file" ]] || return 0
  awk '
    BEGIN { fm = 0; in_scope = 0; in_paths = 0 }
    /^---[[:space:]]*$/ { fm++; if (fm == 2) exit; next }
    fm != 1 { next }
    /^scope:[[:space:]]*$/ { in_scope = 1; in_paths = 0; next }
    in_scope && /^[A-Za-z][A-Za-z0-9_]*:/ && !/^[[:space:]]/ { in_scope = 0; in_paths = 0 }
    in_scope && /^[[:space:]]+paths:[[:space:]]*$/ { in_paths = 1; next }
    in_scope && in_paths && /^[[:space:]]+-[[:space:]]+/ {
      sub(/^[[:space:]]+-[[:space:]]+/, "", $0)
      sub(/^['"'"'"]/, "", $0)
      sub(/['"'"'"][[:space:]]*$/, "", $0)
      sub(/[[:space:]]+#.*$/, "", $0)
      if (length($0) > 0) print $0
    }
    in_scope && in_paths && /^[[:space:]]+[A-Za-z][A-Za-z0-9_]*:/ { in_paths = 0 }
  ' "$file"
}

# Picks the active initiative, mirroring session-start.sh:
#   plan-anchored → standalone branch-match → empty.
detect_active_initiative() {
  local branch=$1
  local plan_slug="" current_phase_id="" active_plan="" newest=""
  local newest_mtime=0 branch_matched=""

  if [[ -d "$PLANS_DIR" ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      [[ "$(get_field "$f" status)" == "active" ]] || continue
      local pbranch
      pbranch=$(get_field "$f" branch)
      if [[ -n "$branch" && -n "$pbranch" && "$pbranch" == "$branch" && -z "$branch_matched" ]]; then
        branch_matched="$f"
      fi
      local mtime
      mtime=$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f" 2>/dev/null || echo 0)
      if (( mtime > newest_mtime )); then
        newest_mtime=$mtime
        newest="$f"
      fi
    done < <(find "$PLANS_DIR" -maxdepth 1 -type f -name '*.md' ! -name '*.rendered.md' 2>/dev/null)
    active_plan="${branch_matched:-$newest}"
  fi

  if [[ -n "$active_plan" ]]; then
    plan_slug=$(basename "$active_plan" .md)
    current_phase_id=$(get_field "$active_plan" currentPhase)
    if [[ -d "$INITIATIVES_DIR" && -n "$current_phase_id" ]]; then
      while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        [[ "$(get_field "$f" parentPlan)" == "$plan_slug" ]] || continue
        [[ "$(get_field "$f" phaseId)" == "$current_phase_id" ]] || continue
        [[ "$(get_field "$f" status)" == "active" ]] || continue
        echo "$f"
        return 0
      done < <(find "$INITIATIVES_DIR" -maxdepth 1 -type f -name '*.md' ! -name '*.rendered.md' 2>/dev/null)
    fi
  fi

  if [[ -d "$INITIATIVES_DIR" && -n "$branch" ]]; then
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      [[ "$(get_field "$f" status)" == "active" ]] || continue
      local fbranch
      fbranch=$(get_field "$f" branch)
      if [[ "$fbranch" == "$branch" || "$fbranch" == "${branch%%/*}" ]]; then
        echo "$f"
        return 0
      fi
    done < <(find "$INITIATIVES_DIR" -maxdepth 1 -type f -name '*.md' ! -name '*.rendered.md' 2>/dev/null)
  fi
  echo ""
}

# Lists file paths written during the current turn. Reads the JSONL transcript
# from `last_user_ts` forward and pulls `file_path` for any Write / Edit /
# MultiEdit / NotebookEdit tool use.
#
# Claude Code's real transcript schema (verified by sampling
# ~/.claude/projects/<repo>/*.jsonl): assistant turns are `{"type":"assistant",
# "message":{"content":[{"type":"tool_use","name":"Edit","input":{"file_path":
# "..."}}, ...], ...}, "timestamp": "..."}`. There is no top-level `.tool_use`
# field; the legacy filter that read `.tool_use.input.file_path` never matched
# a real session. v2 also handles NotebookEdit's `notebook_path` input field.
list_files_written() {
  local transcript=$1 last_user_ts=$2
  [[ -f "$transcript" ]] || return 0
  [[ -z "$last_user_ts" ]] && return 0
  jq -r --arg ts "$last_user_ts" '
    select(.timestamp > $ts and .type == "assistant"
      and (.message.content // []) != [])
    | .message.content[]?
    | select(.type == "tool_use"
        and (.name == "Write"
          or .name == "Edit"
          or .name == "MultiEdit"
          or .name == "NotebookEdit"))
    | (.input.file_path // .input.notebook_path // empty)
  ' "$transcript" 2>/dev/null | sort -u
}

# Returns 0 (in-scope) when $file_path resolves under one of the scope
# prefixes in $@. Both the file path and each scope prefix are canonicalized
# (`.`, `..`, double slashes stripped) before prefix-matching, so a path like
# `$PROJ_DIR/src/../lib/secret.js` is correctly classified as out of scope
# for `scope.paths: [src/]`.
#
# Note: this is a *lexical* canonicalizer — it does NOT resolve symlinks.
# Hooks fire many times per session; calling `realpath` on every file path
# would block on slow filesystems and require a tool that's not universally
# available. For drift detection, lexical normalization is sufficient: a
# malicious user who wants to evade scope checks via symlinks can also just
# disable the hook entirely. The threat model here is honest mistakes, not
# active evasion.
canonicalize_path() {
  local p=$1
  # Collapse multiple slashes, drop trailing slash (except for root).
  p=$(printf '%s' "$p" | sed -E 's://+:/:g; s:/$::')
  [[ -z "$p" ]] && { echo "."; return 0; }
  # Walk components, resolving `.` and `..` lexically.
  local IFS='/' parts=() out=() leading_slash=""
  [[ "$p" == /* ]] && leading_slash="/"
  read -ra parts <<< "${p#/}"
  for c in "${parts[@]}"; do
    case "$c" in
      "" | .) continue ;;
      ..)
        # Bash 3.2 has no `${array[-1]}`; emulate with computed index. Pop the
        # last component unless it is itself `..` (in which case `..` stacks).
        if (( ${#out[@]} > 0 )); then
          local last_idx=$(( ${#out[@]} - 1 ))
          if [[ "${out[$last_idx]}" != ".." ]]; then
            unset "out[$last_idx]"
            out=("${out[@]}") # re-index after unset
          elif [[ -z "$leading_slash" ]]; then
            out+=('..')
          fi
        elif [[ -z "$leading_slash" ]]; then
          out+=('..')
        fi
        # Absolute path: `..` above root is dropped (POSIX behavior).
        ;;
      *) out+=("$c") ;;
    esac
  done
  if (( ${#out[@]} == 0 )); then
    [[ -n "$leading_slash" ]] && echo "/" || echo "."
  else
    local joined
    joined=$(IFS='/'; echo "${out[*]}")
    echo "${leading_slash}${joined}"
  fi
}

path_in_scope() {
  local file=$1; shift
  local canonical
  canonical=$(canonicalize_path "$file")

  # Reduce to repo-relative form. `..` that escaped the canonicalizer means
  # the original path resolved outside PROJ_DIR — out of scope.
  local relative=$canonical
  if [[ "$canonical" == "$PROJ_DIR"/* ]]; then
    relative="${canonical#$PROJ_DIR/}"
  elif [[ "$canonical" == "$PROJ_DIR" ]]; then
    relative="."
  elif [[ "$canonical" == /* ]]; then
    # Absolute path that doesn't live under the project root — never in scope.
    return 1
  elif [[ "$canonical" == .. || "$canonical" == ../* ]]; then
    # Relative path that escapes the repo — out of scope.
    return 1
  fi

  for raw_prefix in "$@"; do
    local prefix
    prefix=$(canonicalize_path "$raw_prefix")
    case "$prefix" in
      .) return 0 ;;
      /*) prefix="${prefix#/}" ;;
    esac
    if [[ "$relative" == "$prefix" || "$relative" == "$prefix"/* ]]; then
      return 0
    fi
  done
  return 1
}

# Best-effort timestamp → epoch seconds. GNU `date -d`, BSD `date -j -f`,
# python3 fallback.
ts_to_epoch() {
  local ts=$1
  local out
  out=$(date -d "$ts" +%s 2>/dev/null) && { echo "$out"; return; }
  out=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${ts%.*}" +%s 2>/dev/null) && { echo "$out"; return; }
  out=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "${ts%.*}Z" +%s 2>/dev/null) && { echo "$out"; return; }
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "
from datetime import datetime
import sys
s = sys.argv[1].rstrip('Z')
for fmt in ('%Y-%m-%dT%H:%M:%S.%f','%Y-%m-%dT%H:%M:%S'):
    try:
        print(int(datetime.strptime(s, fmt).timestamp())); break
    except Exception: pass
" "$ts" 2>/dev/null
    return
  fi
  echo 0
}

# --- pre-flight bypasses ----------------------------------------------------

# Emergency bypass (24h grace).
if [[ -f "$SKIP_FLAG" ]]; then
  skip_mtime=$(stat -c %Y "$SKIP_FLAG" 2>/dev/null || stat -f %m "$SKIP_FLAG" 2>/dev/null || echo 0)
  now=$(date +%s)
  [[ $((now - skip_mtime)) -lt 86400 ]] && exit 0
fi

# Parse stdin payload.
payload=$(cat)
transcript_path=$(printf '%s' "$payload" | jq -r '.transcript_path // empty' 2>/dev/null || echo "")
stop_hook_active=$(printf '%s' "$payload" | jq -r '.stop_hook_active // false' 2>/dev/null || echo "false")

# Anthropic-recommended loop prevention.
[[ "$stop_hook_active" == "true" ]] && exit 0

# Config + initiative resolution must both succeed; otherwise no-op.
[[ ! -f "$CONFIG" ]] && exit 0
strict_mode=$(jq -r '.strict_mode // false' "$CONFIG" 2>/dev/null || echo false)
drift_threshold=$(jq -r '.drift_threshold // 0.5' "$CONFIG" 2>/dev/null || echo 0.5)

branch=$(git -C "$PROJ_DIR" symbolic-ref --short HEAD 2>/dev/null \
  || git -C "$PROJ_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null \
  || echo "")
[[ "$branch" == "HEAD" ]] && branch=""

active=$(detect_active_initiative "$branch")
[[ -z "$active" ]] && exit 0

# --- drift check ------------------------------------------------------------

[[ -z "$transcript_path" || ! -f "$transcript_path" ]] && exit 0

# Find the last user-turn timestamp. Real Claude Code transcripts identify
# user turns with `.type == "user"` (NOT `.role == "user"`). `tac` is GNU-only
# and `tail -r` is BSD-only, so we filter via jq and pick the last match.
last_user_ts=$(jq -r 'select(.type == "user") | .timestamp // empty' \
  "$transcript_path" 2>/dev/null | tail -1)
[[ -z "$last_user_ts" ]] && exit 0

# Bash 3.2 (macOS default) lacks `mapfile`; use `while read` instead.
scope_paths=()
while IFS= read -r line; do
  [[ -n "$line" ]] && scope_paths+=("$line")
done < <(get_scope_paths "$active")

# Scope-less initiative → no drift check.
if (( ${#scope_paths[@]} == 0 )); then
  exit 0
fi

written=()
while IFS= read -r line; do
  [[ -n "$line" ]] && written+=("$line")
done < <(list_files_written "$transcript_path" "$last_user_ts")
total=${#written[@]}
(( total == 0 )) && exit 0

out_of_scope=0
declare -a out_files=()
for f in "${written[@]}"; do
  [[ -z "$f" ]] && continue
  if path_in_scope "$f" "${scope_paths[@]}"; then
    continue
  fi
  out_of_scope=$((out_of_scope + 1))
  out_files+=("$f")
done

# Threshold check via awk (pure-bash floats don't exist).
should_warn=$(awk -v out="$out_of_scope" -v tot="$total" -v th="$drift_threshold" \
  'BEGIN { print (tot > 0 && (out / tot) > th) ? "yes" : "no" }')
[[ "$should_warn" != "yes" ]] && exit 0

slug=$(basename "$active" .md)
phase_id=$(get_field "$active" phaseId)
parent_plan=$(get_field "$active" parentPlan)
breadcrumb="$slug"
[[ -n "$parent_plan" && -n "$phase_id" ]] && breadcrumb="${parent_plan}/${phase_id} ▸ ${slug}"

msg="Session wrote ${out_of_scope}/${total} files outside the scope of active initiative ${breadcrumb}. Switch initiatives, expand scope.paths, or park the lateral work."

if [[ "$strict_mode" == "true" ]]; then
  echo "$msg" >&2
  printf 'Out-of-scope files:\n' >&2
  printf '  - %s\n' "${out_files[@]}" >&2
  exit 2
fi

# Dry-run: append structured JSON line for later analysis.
mkdir -p "$(dirname "$DRIFT_LOG")"
ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
out_files_json=$(printf '%s\n' "${out_files[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]')
jq -n --arg ts "$ts" --arg slug "$slug" --arg crumb "$breadcrumb" \
  --argjson total "$total" --argjson out "$out_of_scope" \
  --argjson th "$drift_threshold" --argjson files "$out_files_json" \
  '{ts: $ts, mode: "dry-run", initiative: $slug, breadcrumb: $crumb,
    total_files: $total, out_of_scope: $out, threshold: $th,
    would_block: true, out_files: $files}' >> "$DRIFT_LOG"

exit 0
