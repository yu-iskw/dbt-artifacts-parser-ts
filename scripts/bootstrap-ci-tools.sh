#!/usr/bin/env bash
set -euo pipefail

# Bootstrap script for fresh cloud environments (Codex, Claude Code cloud, etc.)
#
# This script installs all required commands for cloud coding agents.
# It is idempotent and safe to run multiple times.
#
# Usage:
#   bash scripts/bootstrap-ci-tools.sh
#   source scripts/bootstrap-ci-tools.sh  # to update PATH in current shell
#
# Installed commands (if missing):
#   - pnpm: Package manager (required)
#   - trunk: Linting and formatting (required)
#   - codeql: Security scanning (recommended)
#   - jq: JSON CLI processor (useful for agents)
#   - make: Build automation (optional but useful)

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

# ============================================================================
# Helper Functions (defined before use)
# ============================================================================

# Install CodeQL from GitHub releases
_install_codeql() {
  local TMPDIR
  TMPDIR=$(mktemp -d)
  trap "rm -rf $TMPDIR" RETURN

  # Determine system architecture
  local SYSTEM
  SYSTEM=$(uname -s | tr '[:upper:]' '[:lower:]')
  local ARCH
  ARCH=$(uname -m)

  local PATTERN
  if [[ "$SYSTEM" == "linux" && "$ARCH" == "x86_64" ]]; then
    PATTERN="linux64"
  elif [[ "$SYSTEM" == "darwin" ]]; then
    PATTERN="macos"
  else
    return 1
  fi

  # Fetch and download
  local RELEASE_JSON
  RELEASE_JSON=$(curl -s https://api.github.com/repos/github/codeql-cli-binaries/releases/latest 2>/dev/null || echo '{}')

  if echo "$RELEASE_JSON" | grep -q "message.*API rate limit" 2>/dev/null; then
    return 1
  fi

  local DOWNLOAD_URL
  DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep "browser_download_url" | grep "$PATTERN" | cut -d'"' -f4 | head -1)

  if [[ -z "$DOWNLOAD_URL" ]]; then
    return 1
  fi

  # Download and extract
  if curl -L -o "$TMPDIR/codeql.zip" "$DOWNLOAD_URL" 2>/dev/null && \
     mkdir -p "$HOME/.local/bin" && \
     unzip -q "$TMPDIR/codeql.zip" -d "$HOME/.local/bin" 2>/dev/null; then

    # Add to PATH
    if ! grep -q "$HOME/.local/bin" <<< "$PATH" 2>/dev/null; then
      export PATH="$HOME/.local/bin:$PATH"
    fi
    return 0
  fi

  return 1
}

# Install jq (JSON CLI tool)
_install_jq() {
  local SYSTEM
  SYSTEM=$(uname -s | tr '[:upper:]' '[:lower:]')

  if [[ "$SYSTEM" == "linux" ]]; then
    # Try apt first
    if command -v apt-get &> /dev/null; then
      if apt-get update &>/dev/null && apt-get install -y jq &>/dev/null; then
        return 0
      fi
    fi
    # Try yum
    if command -v yum &> /dev/null; then
      if yum install -y jq &>/dev/null; then
        return 0
      fi
    fi
  elif [[ "$SYSTEM" == "darwin" ]]; then
    # Try homebrew
    if command -v brew &> /dev/null; then
      if brew install jq &>/dev/null; then
        return 0
      fi
    fi
  fi

  return 1
}

# Check and report tool status
_check_critical_tools() {
  local critical_ok=true

  echo "  Required tools:"
  if command -v pnpm &> /dev/null; then
    echo -e "    ${GREEN}✓${NC} pnpm"
  else
    echo -e "    ${RED}✗${NC} pnpm (CRITICAL)"
    critical_ok=false
  fi

  if command -v trunk &> /dev/null; then
    echo -e "    ${GREEN}✓${NC} trunk"
  else
    echo -e "    ${RED}✗${NC} trunk (CRITICAL)"
    critical_ok=false
  fi

  echo "  Recommended tools:"
  if command -v codeql &> /dev/null; then
    echo -e "    ${GREEN}✓${NC} codeql"
  else
    echo -e "    ${YELLOW}⚠${NC} codeql"
  fi

  if command -v jq &> /dev/null; then
    echo -e "    ${GREEN}✓${NC} jq"
  else
    echo -e "    ${YELLOW}⚠${NC} jq"
  fi

  echo "  Optional tools:"
  if command -v make &> /dev/null; then
    echo -e "    ${GREEN}✓${NC} make"
  else
    echo -e "    ${YELLOW}⚠${NC} make"
  fi

  if [[ "$critical_ok" == "true" ]]; then
    return 0
  else
    return 1
  fi
}

# ============================================================================
# Bootstrap Steps
# ============================================================================

echo -e "${BLUE}▶ Bootstrap CI tools and dependencies${NC}"
echo

# Step 1: Check Node version from .node-version
if [[ -f "$REPO_ROOT/.node-version" ]]; then
  EXPECTED_NODE_VERSION="$(cat "$REPO_ROOT/.node-version")"
  CURRENT_NODE_VERSION="$(node --version | sed 's/^v//')"
  echo -e "${BLUE}[1/10]${NC} Node.js version check"
  echo "  Expected: $EXPECTED_NODE_VERSION"
  echo "  Current:  $CURRENT_NODE_VERSION"
  if [[ "$CURRENT_NODE_VERSION" != "$EXPECTED_NODE_VERSION" ]]; then
    echo -e "  ${YELLOW}⚠ Version mismatch (may cause issues)${NC}"
  else
    echo -e "  ${GREEN}✓ Version matches${NC}"
  fi
else
  echo -e "${BLUE}[1/10]${NC} Node.js version check"
  echo "  ${YELLOW}⚠ .node-version file not found${NC}"
fi
echo

# Step 2: Enable Corepack (if available)
echo -e "${BLUE}[2/10]${NC} Corepack setup"
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
echo -e "${BLUE}[3/10]${NC} pnpm installation"
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
    exit 1
  fi
fi
echo

# Step 4: Install dependencies with pnpm
echo -e "${BLUE}[4/10]${NC} Running pnpm install --frozen-lockfile"
if pnpm install --frozen-lockfile; then
  echo -e "  ${GREEN}✓ Dependencies installed${NC}"
else
  echo -e "  ${RED}✗ pnpm install failed${NC}"
  exit 1
fi
echo

# Step 5: Install trunk CLI (required)
echo -e "${BLUE}[5/10]${NC} Trunk CLI installation"
TRUNK_NEEDS_INSTALL=false

# Check if trunk command is available and executable
if command -v trunk &> /dev/null; then
  echo -e "  ${GREEN}✓ trunk already installed$(trunk --version 2>/dev/null | head -1 | sed 's/^/ - /' || echo)${NC}"
else
  echo "  trunk not found, installing via npm..."
  TRUNK_NEEDS_INSTALL=true
fi

# Install trunk if needed
if [[ "$TRUNK_NEEDS_INSTALL" == "true" ]]; then
  echo "  Installing @trunkio/launcher globally..."

  # Install trunk
  if npm install -g @trunkio/launcher 2>&1 | grep -v "^npm notice" | grep -v "^npm info" > /dev/null; then
    # Verify trunk is now in PATH and executable
    if command -v trunk &> /dev/null; then
      # Try to get version; network errors are OK
      TRUNK_VERSION=$(trunk --version 2>/dev/null | head -1 || echo "installed")
      echo -e "  ${GREEN}✓ trunk installed successfully ($TRUNK_VERSION)${NC}"
    else
      echo -e "  ${RED}✗ trunk not found in PATH after installation${NC}"
      exit 1
    fi
  else
    echo -e "  ${RED}✗ Failed to install trunk via npm${NC}"
    exit 1
  fi
fi
echo

# Step 6: Run trunk install to set up runtimes and tools
echo -e "${BLUE}[6/10]${NC} Trunk runtime and tool installation"
if command -v trunk &> /dev/null; then
  echo "  Running 'trunk install' to download runtimes..."

  # Capture trunk install output
  TRUNK_INSTALL_OUTPUT=$(trunk install 2>&1 || true)
  TRUNK_INSTALL_EXIT=$?

  # Check for success indicators
  if echo "$TRUNK_INSTALL_OUTPUT" | grep -qi "success\|complete\|installed"; then
    echo -e "  ${GREEN}✓ Trunk runtimes and tools installed${NC}"
  elif [[ $TRUNK_INSTALL_EXIT -eq 0 ]]; then
    echo -e "  ${GREEN}✓ Trunk install completed successfully${NC}"
  elif echo "$TRUNK_INSTALL_OUTPUT" | grep -qi "warning\|deprecated"; then
    echo "$TRUNK_INSTALL_OUTPUT" | tail -3
    echo -e "  ${YELLOW}⚠ Trunk install completed with warnings (continuing)${NC}"
  else
    echo "$TRUNK_INSTALL_OUTPUT" | tail -5
    echo -e "  ${YELLOW}⚠ Trunk install had issues but trunk CLI is functional${NC}"
  fi
else
  echo -e "  ${RED}✗ trunk not available after installation${NC}"
  exit 1
fi
echo

# Step 7: Ensure CodeQL is available (install if needed)
echo -e "${BLUE}[7/10]${NC} CodeQL installation"
if command -v codeql &> /dev/null; then
  CODEQL_VERSION="$(codeql version --format text 2>/dev/null | head -1 || echo 'unknown')"
  echo -e "  ${GREEN}✓ CodeQL already installed (version $CODEQL_VERSION)${NC}"
else
  echo "  CodeQL not found, downloading..."
  if _install_codeql; then
    echo -e "  ${GREEN}✓ CodeQL installed${NC}"
  else
    echo -e "  ${YELLOW}⚠ Could not install CodeQL (proceeding without it)${NC}"
    echo "     CodeQL is recommended but not required for non-security tasks"
  fi
fi
echo

# Step 8: Ensure jq is available (install if needed)
echo -e "${BLUE}[8/10]${NC} jq (JSON CLI tool) availability"
if command -v jq &> /dev/null; then
  JQ_VERSION="$(jq --version 2>/dev/null || echo 'unknown')"
  echo -e "  ${GREEN}✓ jq already installed ($JQ_VERSION)${NC}"
else
  echo "  jq not found, installing..."
  if _install_jq; then
    echo -e "  ${GREEN}✓ jq installed${NC}"
  else
    echo -e "  ${YELLOW}⚠ Could not install jq (some agent tasks may be slower)${NC}"
  fi
fi
echo

# Step 9: Ensure make is available (checked but not installed)
echo -e "${BLUE}[9/10]${NC} make availability"
if command -v make &> /dev/null; then
  MAKE_VERSION="$(make --version 2>/dev/null | head -1 || echo 'unknown')"
  echo -e "  ${GREEN}✓ make already installed${NC}"
else
  echo -e "  ${YELLOW}⚠ make not found (optional; some build tasks may need it)${NC}"
  echo "     Install with: apt-get install make (Debian/Ubuntu) or brew install make (macOS)"
fi
echo

# Step 10: Summary of agent-critical tools
echo -e "${BLUE}[10/10]${NC} Agent environment summary"
_check_critical_tools
echo

# Final status
echo -e "${GREEN}▶ Bootstrap complete${NC}"
echo
echo "Next steps for agents:"
echo "  • Run 'pnpm format' to format code (or 'pnpm format:without-trunk' if needed)"
echo "  • Run 'pnpm lint' to check code quality (or 'pnpm lint:without-trunk' if needed)"
echo "  • Run 'pnpm test' to run unit tests"
echo "  • Run 'pnpm coverage:report' to verify coverage meets thresholds"
echo "  • Run 'pnpm codeql' for security scanning (if CodeQL is available)"
echo

# Export PATH for any freshly installed tools
if [[ -d "$HOME/.local/bin" ]]; then
  if ! grep -q "$HOME/.local/bin" <<< "$PATH" 2>/dev/null; then
    export PATH="$HOME/.local/bin:$PATH"
  fi
fi

if [[ -d "$HOME/.local/share/trunkd/tools" ]]; then
  if ! grep -q "$HOME/.local/share/trunkd/tools" <<< "$PATH" 2>/dev/null; then
    export PATH="$HOME/.local/share/trunkd/tools:$PATH"
  fi
fi

exit 0
