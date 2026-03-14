#!/bin/bash
set -euo pipefail

# Podlite monorepo release script
# Usage: yarn release [--dry-run]

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN="--dry-run"
  echo "=== DRY RUN MODE ==="
fi

# Step 1: Check prerequisites
echo "→ Checking prerequisites..."

if ! git diff --quiet; then
  echo "ERROR: Working tree has uncommitted changes. Commit or stash first."
  exit 1
fi

if ! command -v gh &> /dev/null; then
  echo "ERROR: gh CLI not found. Install: brew install gh"
  exit 1
fi

# Step 2: Check changelogs have content
echo "→ Checking changelogs..."
node scripts/extract-changelog.mjs --update --dry-run

HAS_UPDATES=$(node scripts/extract-changelog.mjs --update --dry-run 2>&1 | grep -c "Would update" || true)
if [[ "$HAS_UPDATES" == "0" ]]; then
  echo "ERROR: No packages have Upcoming changelog entries. Write changelog first."
  exit 1
fi

if [[ -n "$DRY_RUN" ]]; then
  echo ""
  echo "=== DRY RUN: would do the following ==="
  echo "1. yarn update:version-patch (bump versions)"
  echo "2. node scripts/extract-changelog.mjs --update (rename Upcoming → version)"
  echo "3. yarn build && yarn test"
  echo "4. git commit + push"
  echo "5. gh release create"
  echo ""
  echo "Run without --dry-run to execute."
  exit 0
fi

# Step 3: Bump versions
echo "→ Bumping package versions..."
yarn update:version-patch

echo "→ Bumping root version..."
npm version patch --no-git-tag-version

# Step 4: Aggregate per-package changelogs → root
echo "→ Aggregating changelogs..."
node scripts/extract-changelog.mjs --aggregate

# Step 5: Rename Upcoming → version in changelogs
echo "→ Updating changelogs..."
node scripts/extract-changelog.mjs --update

# Step 5: Build and test
echo "→ Building..."
yarn build

echo "→ Running tests..."
yarn test

# Step 6: Commit and push
echo "→ Committing..."
TAG="v$(node -e "console.log(require('./package.json').version)")"
git add -A
git commit -m "release: ${TAG}"
git push origin main

# Step 7: Generate release notes from changelogs
echo "→ Generating release notes..."
PREV_TAG=$(gh release list --repo podlite/podlite --limit 1 --json tagName --jq '.[0].tagName' 2>/dev/null || echo "")
CHANGELOG=$(node scripts/extract-changelog.mjs --summary)
COMPARE=""
if [[ -n "$PREV_TAG" ]]; then
  COMPARE="**Full Changelog**: https://github.com/podlite/podlite/compare/${PREV_TAG}...${TAG}"
fi

NOTES_FILE=$(mktemp)
cat scripts/release-header.md > "$NOTES_FILE"
echo "" >> "$NOTES_FILE"
echo "$CHANGELOG" >> "$NOTES_FILE"
echo "" >> "$NOTES_FILE"
echo "$COMPARE" >> "$NOTES_FILE"

# Step 8: Create GitHub Release (triggers publish.yml → npm publish)
echo "→ Creating GitHub Release..."
gh release create "${TAG}" \
  --title "${TAG}" \
  --notes-file "$NOTES_FILE" \
  --target main

rm -f "$NOTES_FILE"

echo ""
echo "Release ${TAG} created!"
echo "GitHub Actions will publish to npm automatically."
echo "Monitor: gh run list --repo podlite/podlite"
