#!/usr/bin/env bash
# SCSP: Build READ/WRITE usage map from static scan results (macOS-safe)
# Usage: bash scripts/audit/make_usage_map.sh
set -euo pipefail
FS="scripts/audit/_firestore_refs.txt"
ST="scripts/audit/_storage_refs.txt"
OUT="scripts/audit/_usage_map.md"
mkdir -p scripts/audit

[ -s "$FS" ] || { echo "Missing or empty $FS. Run scan_repo_for_firestore_paths.sh first."; exit 1; }

# Common write verbs (JS/TS/Python, modular or namespaced)
WRITE_PAT='addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction|batch\.|set\(|update\(|delete\(|create\('

{
  echo "# Usage Map"
  echo
  echo "## Firestore"
  echo
  while IFS= read -r line; do
    if echo "$line" | grep -Eiq "$WRITE_PAT"; then tag="WRITE"; else tag="READ"; fi
    echo "- [$tag] $line"
  done < "$FS"
  echo
  echo "## Storage"
  echo
  if [ -s "$ST" ]; then
    cat "$ST"
  else
    echo "_No storage refs found (or scan not run)._"
  fi
} > "$OUT"

echo "✅ Usage map → $OUT"
