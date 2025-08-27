#!/usr/bin/env bash
# SCSP: Firestore/Storage path scanner (grep-only, macOS-safe)
# Usage: bash scripts/audit/scan_repo_for_firestore_paths.sh [root=.]
set -euo pipefail
ROOT="${1:-.}"
mkdir -p scripts/audit

# Build candidate file list (prunes vendor/build/venvs)
find "$ROOT" \
  \( -path "*/node_modules/*" -o -path "*/dist/*" -o -path "*/build/*" \
     -o -path "*/.git/*" -o -path "*/.vercel/*" -o -path "*/.vite/*" \
     -o -path "*/.venv/*" -o -path "*/venv/*" \) -prune -o \
  \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.mjs" -o -name "*.cjs" -o -name "*.py" \) \
  -print0 > scripts/audit/_filelist0.txt

echo "🔎 Scanning for Firestore refs…"
# Keep patterns SIMPLE to avoid shell parse issues; we'll overcapture a bit.
xargs -0 grep -nE 'collection\(|doc\(|collectionGroup\(|where\(|orderBy\(|limit\(' \
  2>/dev/null < scripts/audit/_filelist0.txt \
  | sort > scripts/audit/_firestore_refs.txt || true
echo "🗂  → scripts/audit/_firestore_refs.txt"

echo "🔎 Scanning for Storage refs…"
xargs -0 grep -nE 'getStorage\(|getDownloadURL\(|uploadBytes\(|uploadString\(|listAll\(|ref\(' \
  2>/dev/null < scripts/audit/_filelist0.txt \
  | sort > scripts/audit/_storage_refs.txt || true
echo "🖼  → scripts/audit/_storage_refs.txt"

echo "✅ Repo scan complete."
