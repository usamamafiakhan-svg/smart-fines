#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Static HTML/CSS project — no dependencies to install.
# Validate that the main file is present.
if [ ! -f "$CLAUDE_PROJECT_DIR/index.html" ]; then
  echo "WARNING: index.html not found in $CLAUDE_PROJECT_DIR" >&2
fi

echo "Session ready: static HTML project, no install step needed."
