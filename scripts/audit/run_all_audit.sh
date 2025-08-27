#!/usr/bin/env bash
# SCSP: One-shot audit runner
# Usage: bash scripts/audit/run_all_audit.sh
set -euo pipefail

chmod +x scripts/audit/scan_repo_for_firestore_paths.sh || true
chmod +x scripts/audit/make_usage_map.sh || true

echo "① Repo scan…"
bash scripts/audit/scan_repo_for_firestore_paths.sh

echo "② Live snapshot…"
node scripts/audit/firestore_schema_audit.mjs

echo "③ Usage map…"
bash scripts/audit/make_usage_map.sh

echo
echo "🎯 Done. Artifacts:"
echo "  • scripts/audit/_firestore_refs.txt"
echo "  • scripts/audit/_storage_refs.txt"
echo "  • scripts/audit/_usage_map.md"
echo "  • scripts/audit/_firestore_schema_snapshot.json"
