#!/bin/bash
# Restoration script to overwrite files with Level 2 versions

BASE_DIR=$(dirname "$(readlink -f "$0")")
PROJECT_ROOT=$(readlink -f "$BASE_DIR/..")

echo "Restoring Level 2 files to $PROJECT_ROOT..."

cp "$BASE_DIR/backend/main.py" "$PROJECT_ROOT/backend/main.py"
cp "$BASE_DIR/frontend/index.html" "$PROJECT_ROOT/frontend/index.html"
cp "$BASE_DIR/frontend/src/App.tsx" "$PROJECT_ROOT/frontend/src/App.tsx"
cp "$BASE_DIR/frontend/src/components/Level2Game.tsx" "$PROJECT_ROOT/frontend/src/components/Level2Game.tsx"

echo "Done! Level 2 files have been restored."
