#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILLS_DIR="$REPO_ROOT/.cursor/skills"
DOCS_DIR="$REPO_ROOT/docs"
OUT_ZIP="$REPO_ROOT/create-custom-component.zip"
STAGE_DIR=$(mktemp -d)

trap 'rm -rf "$STAGE_DIR"' EXIT

DEST="$STAGE_DIR/create-custom-component"
mkdir -p "$DEST/tools" "$DEST/knowledge"

# Copy skill files
cp "$SKILLS_DIR/create-custom-component/skill.md" "$DEST/SKILL.md"
cp "$SKILLS_DIR/create-custom-component/tools/"* "$DEST/tools/"
# Bundle knowledge from local docs/
cp "$DOCS_DIR/subscribe-api.md" "$DEST/knowledge/subscribe-api.md"
cp "$DOCS_DIR/custom-form-components.md" "$DEST/knowledge/custom-form-components.md"
cp "$DOCS_DIR/form-field-types.md" "$DEST/knowledge/form-field-types.md"

# Copy README from skill folder
cp "$SKILLS_DIR/create-custom-component/README.md" "$DEST/README.md"

rm -f "$OUT_ZIP"
(cd "$STAGE_DIR" && zip -r "$OUT_ZIP" create-custom-component/)

FILE_COUNT=$(unzip -l "$OUT_ZIP" | grep -c '\.') || true
SIZE=$(du -h "$OUT_ZIP" | cut -f1)

echo ""
echo "Shipped: $OUT_ZIP ($SIZE, $FILE_COUNT files)"
