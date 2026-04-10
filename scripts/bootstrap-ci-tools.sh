#!/usr/bin/env bash
set -euo pipefail

# Bootstrap script for fresh cloud environments (Codex, Claude Code cloud, etc.)
#
# This script sets up the repository for CI-like tasks when tools are not preinstalled.
# It is safe to run multiple times and will not fail if optional tools (CodeQL) are missing.
#
# Usage:
#   bash scripts/bootstrap-ci-tools.sh
#   source scripts/bootstrap-ci-tools.sh  # to update PATH in current shell

set +u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
set -u

# Color output for readability
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}▶ Bootstrap CI tools${NC}"
echo

# Step 1: Check Node version from .node-version
if [[ -f "$REPO_ROOT/.node-version" ]]; then
  EXPECTED_NODE_VERSION="$(cat "$REPO_ROOT/.node-version")"
  CURRENT_NODE_VERSION="$(node --version | sed 's/^v//')"
  echo -e "${BLUE}[1/7]${NC} Node.js version check"
  echo "  Expected: $EXPECTED_NODE_VERSION"
  echo "  Current:  $CURRENT_NODE_VERSION"
  if [[ "$CURRENT_NODE_VERSION" != "$EXPECTED_NODE_VERSION" ]]; then
    echo -e "  ${YELLOW}⚠ Version mismatch (may cause issues)${NC}"
  else
    echo -e "  ${GREEN}✓ Version matches${NC}"
  fi
else
  echo -e "${BLUE}[1/7]${NC} Node.js version check"
  echo "  ${YELLOW}⚠ .node-version file not found${NC}"
fi
echo

# Step 2: Enable Corepack (if available)
echo -e "${BLUE}[2/7]${NC} Corepack setup"
if command -v corepack &> /dev/null; then
  if corepack enable &> /dev/null; then
    echo -e "  ${GREEN}✓ Corepack enabled${NC}"
  else
    echo -e "  ${YELLOW}⚠ Corepack available but could not enable${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠ Corepack not available in this Node build${NC}"
  echo "     (This is normal for some Node installations; pnpm can be installed via npm instead)"
fi
echo

# Step 3: Check and ensure pnpm is available
echo -e "${BLUE}[3/7]${NC} pnpm installation"
if command -v pnpm &> /dev/null; then
  PNPM_VERSION="$(pnpm --version)"
  echo -e "  ${GREEN}✓ pnpm already installed (version $PNPM_VERSION)${NC}"
else
  echo "  pnpm not found, installing via npm..."
  if npm install -g pnpm@10 2>&1 | grep -v "^npm notice" | grep -v "^npm info"; then
    PNPM_VERSION="$(pnpm --version)"
    echo -e "  ${GREEN}✓ pnpm installed (version $PNPM_VERSION)${NC}"
  else
    echo -e "  ${RED}✗ Failed to install pnpm${NC}"
    return 1
  fi
fi
echo

# Step 4: Install dependencies with pnpm
echo -e "${BLUE}[4/7]${NC} Running pnpm install --frozen-lockfile"
if pnpm install --frozen-lockfile; then
  echo -e "  ${GREEN}✓ Dependencies installed${NC}"
else
  echo -e "  ${RED}✗ pnpm install failed${NC}"
  return 1
fi
echo

# Step 5: Ensure trunk is available and run trunk install
echo -e "${BLUE}[5/7]${NC} Trunk CLI setup"
if command -v trunk &> /dev/null; then
  echo -e "  ${GREEN}✓ trunk already installed${NC}"
else
  echo "  trunk not found, installing via npm..."
  if npm install -g @trunkio/launcher 2>&1 | grep -v "^npm notice" | grep -v "^npm info"; then
    echo -e "  ${GREEN}✓ trunk installed${NC}"
  else
    echo -e "  ${RED}✗ Failed to install trunk${NC}"
    return 1
  fi
fi
echo

# Step 6: Run trunk install if available
echo -e "${BLUE}[6/7]${NC} Trunk tool installation"
if command -v trunk &> /dev/null; then
  if trunk install 2>&1 | tail -5; then
    echo -e "  ${GREEN}✓ Trunk runtimes/tools installed${NC}"
  else
    echo -e "  ${YELLOW}⚠ trunk install completed with warnings (non-critical)${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠ trunk not available; skipping trunk install${NC}"
  echo "     (Fallback: use pnpm lint:without-trunk and pnpm format:without-trunk)"
fi
echo

# Step 7: Detect CodeQL (informational only)
echo -e "${BLUE}[7/7]${NC} CodeQL availability check"
if command -v codeql &> /dev/null; then
  CODEQL_VERSION="$(codeql version --format text 2>/dev/null | head -1 || echo 'unknown')"
  echo -e "  ${GREEN}✓ CodeQL installed (version $CODEQL_VERSION)${NC}"
else
  echo -e "  ${YELLOW}⚠ CodeQL not found${NC}"
  echo "     (This is OK for non-security tasks. CodeQL is only required for:"
  echo "      - Explicit security scanning tasks"
  echo "      - SARIF generation"
  echo "      - Local parity with GitHub Actions CodeQL workflows"
  echo "      For other tasks, proceed normally.)"
fi
echo

# Final status
echo -e "${GREEN}▶ Bootstrap complete${NC}"
echo
echo "Next steps:"
echo "  • Run 'pnpm format' to format code (or 'pnpm format:without-trunk' if trunk unavailable)"
echo "  • Run 'pnpm lint' to check code quality (or 'pnpm lint:without-trunk' if trunk unavailable)"
echo "  • Run 'pnpm test' to run unit tests"
echo "  • Run 'pnpm coverage:report' to verify coverage meets thresholds"
echo

# Export PATH if trunk was freshly installed and may be in a custom location
# This ensures newly installed tools are available in the current shell
if [[ -d "$HOME/.local/share/trunkd/tools" ]]; then
  export PATH="$HOME/.local/share/trunkd/tools:$PATH"
fi

exit 0
