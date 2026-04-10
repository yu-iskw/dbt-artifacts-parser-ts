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

# Install CodeQL bundle from GitHub (following GitHub's best practice)
# https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/scan-from-the-command-line/setting-up-the-codeql-cli
_install_codeql() {
  local TMPDIR
  TMPDIR=$(mktemp -d)
  trap "rm -rf $TMPDIR" RETURN

  # Determine system architecture
  local SYSTEM
  SYSTEM=$(uname -s | tr '[:upper:]' '[:lower:]')
  local ARCH
  ARCH=$(uname -m)

  # Map to CodeQL bundle naming convention
  local BUNDLE_PATTERN
  if [[ "$SYSTEM" == "linux" && "$ARCH" == "x86_64" ]]; then
    BUNDLE_PATTERN="linux64"
  elif [[ "$SYSTEM" == "darwin" && "$ARCH" == "x86_64" ]]; then
    BUNDLE_PATTERN="macos"
  elif [[ "$SYSTEM" == "darwin" && "$ARCH" == "arm64" ]]; then
    BUNDLE_PATTERN="osx64"
  else
    return 1
  fi

  # Fetch latest CodeQL bundle from github/codeql-action releases
  local RELEASE_JSON
  RELEASE_JSON=$(curl -s https://api.github.com/repos/github/codeql-action/releases/latest 2>/dev/null || echo '{}')

  if echo "$RELEASE_JSON" | grep -q "message.*API rate limit" 2>/dev/null; then
    return 1
  fi

  # Look for bundle (prefer .tar.zst, fall back to .tar.gz)
  local DOWNLOAD_URL
  DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep "browser_download_url" | grep "codeql-bundle-$BUNDLE_PATTERN" | grep "\.tar\.zst" | cut -d'"' -f4 | head -1)

  if [[ -z "$DOWNLOAD_URL" ]]; then
    # Fall back to tar.gz if zst not available
    DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep "browser_download_url" | grep "codeql-bundle-$BUNDLE_PATTERN" | grep "\.tar\.gz" | cut -d'"' -f4 | head -1)
  fi

  if [[ -z "$DOWNLOAD_URL" ]]; then
    return 1
  fi

  # Download and extract the bundle
  local BUNDLE_FILE="$TMPDIR/codeql-bundle.tar.gz"
  if [[ "$DOWNLOAD_URL" == *".tar.zst" ]]; then
    BUNDLE_FILE="$TMPDIR/codeql-bundle.tar.zst"
  fi

  if curl -L -o "$BUNDLE_FILE" "$DOWNLOAD_URL" 2>/dev/null; then
    mkdir -p "$HOME/.local/codeql"

    # Extract based on file type
    if [[ "$BUNDLE_FILE" == *".tar.zst" ]]; then
      if command -v zstd &> /dev/null; then
        tar -xf "$BUNDLE_FILE" -C "$HOME/.local/codeql" 2>/dev/null
      else
        # Fall back to tar.gz if zstd not available
        return 1
      fi
    else
      tar -xzf "$BUNDLE_FILE" -C "$HOME/.local/codeql" 2>/dev/null
    fi

    # Add codeql directory to PATH
    if [[ -x "$HOME/.local/codeql/codeql/codeql" ]]; then
      if ! grep -q "$HOME/.local/codeql/codeql" <<< "$PATH" 2>/dev/null; then
        export PATH="$HOME/.local/codeql/codeql:$PATH"
      fi
      return 0
    fi
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

  # Check trunk (in node_modules or global PATH)
  if [[ -x "$REPO_ROOT/node_modules/.bin/trunk" ]] || command -v trunk &> /dev/null; then
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

# Step 5: Ensure Trunk CLI is available (installed as dev dependency)
echo -e "${BLUE}[5/10]${NC} Trunk CLI setup"

# Check if trunk is available (should be in node_modules from pnpm install)
TRUNK_FOUND=false

# Method 1: Check if trunk is in node_modules/.bin (installed as dev dependency)
if [[ -x "$REPO_ROOT/node_modules/.bin/trunk" ]]; then
  TRUNK_FOUND=true
  TRUNK_PATH="$REPO_ROOT/node_modules/.bin/trunk"
  TRUNK_VERSION=$("$TRUNK_PATH" --version 2>/dev/null | head -1 || echo "installed")
  echo -e "  ${GREEN}✓ trunk available via node_modules (v$TRUNK_VERSION)${NC}"
fi

# Method 2: Check if trunk is in global PATH
if [[ "$TRUNK_FOUND" == "false" ]] && command -v trunk &> /dev/null; then
  TRUNK_FOUND=true
  TRUNK_PATH="$(command -v trunk)"
  TRUNK_VERSION=$(trunk --version 2>/dev/null | head -1 || echo "installed")
  echo -e "  ${GREEN}✓ trunk found in PATH ($TRUNK_VERSION)${NC}"
fi

# Method 3: Install trunk globally as fallback
if [[ "$TRUNK_FOUND" == "false" ]]; then
  echo "  trunk not found, installing @trunkio/launcher globally..."
  if npm install -g @trunkio/launcher 2>&1 | grep -v "^npm notice" | grep -v "^npm info" > /dev/null; then
    if command -v trunk &> /dev/null; then
      TRUNK_PATH="$(command -v trunk)"
      TRUNK_VERSION=$(trunk --version 2>/dev/null | head -1 || echo "installed")
      echo -e "  ${GREEN}✓ trunk installed globally ($TRUNK_VERSION)${NC}"
    else
      echo -e "  ${RED}✗ Failed to install trunk${NC}"
      exit 1
    fi
  else
    echo -e "  ${RED}✗ Failed to install @trunkio/launcher${NC}"
    exit 1
  fi
fi
echo

# Step 6: Run trunk install to set up runtimes and tools
echo -e "${BLUE}[6/10]${NC} Trunk runtime and tool installation"

# Use the trunk path we found/installed in Step 5
if [[ -z "${TRUNK_PATH:-}" ]]; then
  # Fallback: try to find trunk
  if command -v trunk &> /dev/null; then
    TRUNK_PATH="$(command -v trunk)"
  fi
fi

if [[ -n "${TRUNK_PATH:-}" ]] && [[ -x "$TRUNK_PATH" ]]; then
  echo "  Running 'trunk install' via $TRUNK_PATH..."

  # Capture trunk install output
  TRUNK_INSTALL_OUTPUT=$("$TRUNK_PATH" install 2>&1 || true)
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
