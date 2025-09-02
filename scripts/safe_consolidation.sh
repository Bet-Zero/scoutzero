#!/bin/bash

# Safe Trade Machine Consolidation Script
# This script demonstrates the risk-minimized approach

set -e  # Exit on any error

BACKUP_BRANCH="trade-machine-backup-$(date +%Y%m%d_%H%M%S)"
ORIGINAL_BRANCH=$(git branch --show-current)

echo "🔒 Starting Safe Trade Machine Consolidation"
echo "Current branch: $ORIGINAL_BRANCH"

# Step 1: Create backup branch
echo "📁 Creating backup branch: $BACKUP_BRANCH"
git checkout -b "$BACKUP_BRANCH"
echo "📁 Backup branch created locally: $BACKUP_BRANCH"
echo "   (Push to remote will be handled by report_progress)"
git checkout "$ORIGINAL_BRANCH"

echo "✅ Backup created: $BACKUP_BRANCH"

# Step 2: Validate current state
echo "🧪 Validating current state..."
npm run test tests/capUtils.test.js -- --run
if [ $? -ne 0 ]; then
    echo "❌ Tests failing before consolidation. Aborting."
    exit 1
fi

echo "🏗️  Testing build..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failing before consolidation. Aborting."
    exit 1
fi

echo "✅ Current state validated"

# Step 3: Demonstrate Phase 3A (tiny files consolidation)
echo "📝 Phase 3A: Consolidating tiny files (DEMO MODE - no actual changes)"

TINY_FILES=(
    "src/utils/architect/tradeMachine/rules/enforceSecondApronHandcuffs.js"
    "src/utils/architect/tradeMachine/rules/validateSecondApron.js"  
    "src/utils/architect/tradeMachine/rules/enforceSecondApronRules.js"
    "src/utils/architect/tradeMachine/utils/pickUtils.js"
    "src/utils/architect/tradeMachine/constants/index.js"
)

echo "Files to consolidate:"
for file in "${TINY_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file ($(wc -l < "$file") lines)"
    else
        echo "  ⚠️ $file (not found)"
    fi
done

# Rollback demonstration
echo ""
echo "🔄 Rollback Strategy (DEMO):"
echo "If anything goes wrong, run:"
echo "  git checkout $BACKUP_BRANCH -- src/utils/architect/tradeMachine/"
echo "  npm run test tests/capUtils.test.js -- --run"

echo ""
echo "✅ Safe consolidation framework ready!"
echo "📋 Next steps:"
echo "   1. Review SAFE_IMPLEMENTATION_PLAN.md"
echo "   2. Start with Phase 3A (tiny files)"
echo "   3. Test after each consolidation"
echo "   4. Rollback if anything breaks"

echo ""
echo "🔒 Your trade validator is protected with backup: $BACKUP_BRANCH"