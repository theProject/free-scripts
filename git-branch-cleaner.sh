#!/usr/bin/env bash
set -euo pipefail

BASE=""
DRY_RUN=0
DELETE_REMOTE=0
ASSUME_YES=0

usage() {
  cat <<'HELP'
Git Branch Cleaner
------------------
Lists (and optionally deletes) local branches that are fully merged into the base branch.

Usage:
  git-branch-cleaner.sh [-b base] [--dry-run] [--remote] [-y]

Options:
  -b, --base   Base branch to compare against (default: auto-detect main or master)
  --dry-run    Show actions without deleting
  --remote     Also delete remote branches (origin/<branch>)
  -y           Do not prompt for confirmation
  -h, --help   Show help

Examples:
  ./git-branch-cleaner.sh -b main
  ./git-branch-cleaner.sh --remote -y
HELP
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -b|--base) BASE="$2"; shift 2;;
    --dry-run) DRY_RUN=1; shift;;
    --remote) DELETE_REMOTE=1; shift;;
    -y) ASSUME_YES=1; shift;;
    -h|--help) usage; exit 0;;
    *) echo "Unknown arg: $1"; usage; exit 1;;
  esac
done

git rev-parse --git-dir >/dev/null 2>&1 || { echo "Not a git repository"; exit 1; }
git fetch -p

if [[ -z "$BASE" ]]; then
  if git show-ref --verify --quiet refs/heads/main; then BASE="main";
  elif git show-ref --verify --quiet refs/heads/master; then BASE="master";
  else echo "Could not determine base branch; use --base"; exit 1; fi
fi

CURRENT=$(git rev-parse --abbrev-ref HEAD)
PROTECT=("main" "master" "develop" "$BASE")

echo "Base branch: $BASE"
echo "Current branch: $CURRENT"
echo

MERGED=$(git branch --format='%(refname:short)' --merged "$BASE" | grep -vE "^\*?$BASE$" || true)

if [[ -z "$MERGED" ]]; then
  echo "No merged branches to clean up."
  exit 0
fi

echo "Merged branches:"
echo "$MERGED" | sed 's/^/  - /'
echo

if [[ $ASSUME_YES -eq 0 ]]; then
  read -rp "Delete these locally? [y/N] " ok
  [[ "$ok" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

while IFS= read -r br; do
  [[ -z "$br" ]] && continue
  for p in "${PROTECT[@]}"; do
    if [[ "$br" == "$p" || "$br" == "$CURRENT" ]]; then
      echo "Skipping protected/current branch: $br"
      continue 2
    fi
  done
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "Would delete local branch: $br"
  else
    git branch -d "$br" || true
  fi

  if [[ $DELETE_REMOTE -eq 1 ]]; then
    if git ls-remote --exit-code --heads origin "$br" >/dev/null 2>&1; then
      if [[ $DRY_RUN -eq 1 ]]; then
        echo "Would delete remote branch: origin/$br"
      else
        git push origin --delete "$br" || true
      fi
    fi
  fi
done <<< "$MERGED"

echo "✅ Done."
