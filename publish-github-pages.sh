#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: ./publish-github-pages.sh <github-username>"
  exit 1
fi

GITHUB_USER="$1"
REPO_NAME="study-archive"
REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

cd "$(dirname "$0")"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init
fi

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

git add .

git diff --cached --quiet || git commit -m "Publish study archive to GitHub Pages"

git branch -M main
git push -u origin main

echo
echo "Done. Then go to:"
echo "https://github.com/${GITHUB_USER}/${REPO_NAME}/settings/pages"
echo "Set Pages source to: Deploy from a branch -> main -> /(root)"
echo
echo "Your site will be available at:"
echo "https://${GITHUB_USER}.github.io/${REPO_NAME}/"
