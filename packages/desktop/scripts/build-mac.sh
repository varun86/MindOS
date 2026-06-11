#!/bin/bash

# ============================================
# MindOS Desktop - macOS Build Script
# Usage: ./scripts/build-mac.sh [--no-sign] [--no-notarize]
# Output: dist/*.dmg, dist/*.zip (host arch only — electron-builder --mac
#         builds the arch of the machine running this script)
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$PROJECT_DIR")"

cd "$PROJECT_DIR"

if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}Error: This script must run on macOS${NC}"
    echo "Current OS: $OSTYPE"
    exit 1
fi

# Parse arguments
SIGN=true
NOTARIZE=true
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-sign)      SIGN=false; NOTARIZE=false; shift ;;
        --no-notarize)  NOTARIZE=false; shift ;;
        --help|-h)
            echo "Usage: ./scripts/build-mac.sh [--no-sign] [--no-notarize]"
            echo ""
            echo "Options:"
            echo "  --no-sign        Disable code signing and notarization"
            echo "  --no-notarize    Sign but skip notarization"
            echo "  -h, --help       Show this help message"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ── Step 0: Install dependencies ──
echo -e "\n${YELLOW}Step 0/5: Installing dependencies...${NC}"
cd "$REPO_ROOT"
pnpm install --no-frozen-lockfile

# ── Step 1: Build Next.js standalone ──
echo -e "\n${YELLOW}Step 1/5: Building Next.js standalone...${NC}"
cd "$REPO_ROOT"
pnpm --filter @geminilight/mindos build
pnpm --filter @mindos/web build

# ── Step 2: Build Electron ──
echo -e "\n${YELLOW}Step 2/5: Building Electron...${NC}"
cd "$PROJECT_DIR"
pnpm run build

# ── Step 3: Prepare runtime ──
echo -e "\n${YELLOW}Step 3/5: Preparing bundled runtime...${NC}"
pnpm run prepare-mindos-runtime

# ── Step 4: Package (sign but skip notarization) ──
echo -e "\n${YELLOW}Step 4/5: Packaging...${NC}"
if [ "$SIGN" = true ]; then
    # grep -c prints 0 AND exits 1 on no match — an `|| echo "0"` fallback
    # would produce "0\n0", break the integer test, and silently take the
    # signed path with no certificate. `|| true` keeps the single "0".
    CERT_COUNT=$(security find-identity -v -p codesigning 2>/dev/null | grep -c "Developer ID Application" || true)
    if [ "$CERT_COUNT" -eq "0" ]; then
        echo -e "${RED}No Developer ID Application certificate found${NC}"
        echo "Run with --no-sign for unsigned build, or install a certificate."
        exit 1
    fi
    echo -e "${GREEN}Found $CERT_COUNT Developer ID certificate(s)${NC}"
    # notarize: false in electron-builder.yml, so this only signs
    pnpm exec electron-builder --mac --publish never
else
    echo "Building unsigned..."
    CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac --publish never
fi

# ── Step 5: Notarize ──
if [ "$SIGN" = true ] && [ "$NOTARIZE" = true ]; then
    echo -e "\n${YELLOW}Step 5/5: Notarizing...${NC}"

    # Detect auth method (use array to avoid word-splitting on paths with spaces)
    if [ -n "${APPLE_API_KEY_ID:-}" ]; then
        API_KEY_FILE=~/private_keys/AuthKey_${APPLE_API_KEY_ID}.p8
        if [ ! -f "$API_KEY_FILE" ]; then
            echo -e "${RED}APPLE_API_KEY_ID is set but $API_KEY_FILE does not exist${NC}"
            exit 1
        fi
        if [ -z "${APPLE_API_ISSUER:-}" ]; then
            echo -e "${RED}APPLE_API_KEY_ID requires APPLE_API_ISSUER to be set${NC}"
            exit 1
        fi
        AUTH_ARGS=(--key "$API_KEY_FILE" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER")
        echo "Using API Key authentication"
    elif [ -n "${APPLE_ID:-}" ]; then
        if [ -z "${APPLE_APP_SPECIFIC_PASSWORD:-}" ] || [ -z "${APPLE_TEAM_ID:-}" ]; then
            echo -e "${RED}APPLE_ID requires APPLE_APP_SPECIFIC_PASSWORD and APPLE_TEAM_ID to be set${NC}"
            exit 1
        fi
        AUTH_ARGS=(--apple-id "$APPLE_ID" --password "$APPLE_APP_SPECIFIC_PASSWORD" --team-id "$APPLE_TEAM_ID")
        echo "Using Apple ID authentication"
    else
        echo -e "${YELLOW}No notarization credentials found. Set APPLE_API_KEY_ID + APPLE_API_ISSUER, or APPLE_ID.${NC}"
        echo "Skipping notarization. The app is signed but not notarized."
        NOTARIZE=false
    fi

    if [ "$NOTARIZE" = true ]; then
        # notarytool accepts both DMG and ZIP — the updater ZIP must be
        # notarized too, or auto-updated apps hit Gatekeeper on first launch.
        for file in dist/*.dmg dist/*.zip; do
            [ -f "$file" ] || continue
            echo "Submitting: $(basename "$file")"
            xcrun notarytool submit "$file" "${AUTH_ARGS[@]}" --wait --timeout 2h
            echo -e "${GREEN}Notarized: $(basename "$file")${NC}"
        done

        # Staple DMG only — ZIP archives cannot be stapled
        for file in dist/*.dmg; do
            [ -f "$file" ] || continue
            echo "Stapling: $(basename "$file")"
            xcrun stapler staple "$file"
        done
    fi
else
    echo -e "\nStep 5/5: Notarization skipped"
fi

echo -e "\n${GREEN}Done!${NC}"
echo -e "\nOutput:"
ls -lh dist/*.dmg dist/*.zip 2>/dev/null || echo "No output files found"

if [ "$SIGN" = false ]; then
    echo -e "\n${YELLOW}This build is UNSIGNED. Users need: xattr -cr /Applications/MindOS.app${NC}"
elif [ "$NOTARIZE" = false ]; then
    echo -e "\n${YELLOW}This build is SIGNED but NOT NOTARIZED.${NC}"
else
    echo -e "\n${GREEN}This build is SIGNED and NOTARIZED.${NC}"
fi
