#!/bin/bash
# Fix script to overwrite files with fixed leaderboard version

BASE_DIR=$(dirname "$(readlink -f "$0")")
PROJECT_ROOT=$(readlink -f "$BASE_DIR/..")

echo "Leveling up to Level 2 to $PROJECT_ROOT..."

cp "$BASE_DIR/backend/main.py" "$PROJECT_ROOT/backend/main.py"
cp "$BASE_DIR/frontend/src/App.tsx" "$PROJECT_ROOT/frontend/src/App.tsx"

echo "Done! Fix complete."
