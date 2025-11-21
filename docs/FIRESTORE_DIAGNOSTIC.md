# Firestore Data Diagnostic Component

## Purpose

The `FirestoreDataDiagnostic` component (`src/components/diagnostic/FirestoreDataDiagnostic.jsx`) is a debugging tool that helps developers understand the current state of Firestore collections and troubleshoot data issues.

## What It Does

1. **Collection Counts**: Checks and displays document counts for all active and legacy collections:
   - `players_v2` (active)
   - `architect_basePlayers` (active)
   - `architect_baseTeams` (active)
   - `players` (legacy - deprecated)
   - `teams` (legacy - deprecated)
   - `seasons` (legacy - deprecated)

2. **Player Data Status**: Shows how many players are loaded via `useSimplePlayerData` hook

3. **Error Detection**: Identifies missing collections, connection issues, or data structure problems

4. **Visual Status Indicators**: Uses color-coded icons to show:
   - ✅ Green: Collection exists with data
   - ⚠️ Yellow: Collection exists but empty
   - ❌ Red: Collection missing or error

## When to Use

- After pushing new data to Firestore
- When troubleshooting missing player data
- To verify collection counts match expectations
- To check if legacy collections still exist (should be empty/deprecated)

## Current Expected Values

- `players_v2`: 674 documents
- `architect_basePlayers`: 674 documents
- `architect_baseTeams`: 30 documents (one per team)
- Legacy collections: Should be empty or deprecated

## Access

The diagnostic component is typically accessible via a diagnostic page or admin panel in the application.

