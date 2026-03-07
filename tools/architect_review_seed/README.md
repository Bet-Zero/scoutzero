# Architect Review Seed Data

Minimal seed fixtures for running Architect in "review mode" without production credentials.

## Purpose

These fixtures provide just enough data to boot the Architect feature and Trade Machine in a fresh environment (e.g., cloud/CI runners) using Firebase emulators. They do NOT require production Firebase credentials.

## Contents

- `baseTeams/LAL.json` — Los Angeles Lakers team data
- `baseTeams/BOS.json` — Boston Celtics team data
- `basePlayers/` — Minimal player records for both teams
- `basePlayers/review_offer_sheet_guard.json` — Unrostered restricted free agent for review-mode free-agency coverage
- `baseEntitlements.json` — Sample entitlements for testing

## Usage

```bash
# Start emulators + seed + run dev
npm run architect:review:up

# Or separately:
npm run architect:review:seed   # Seed emulators with minimal data
npm run dev                     # Start Vite dev server
```

## Notes

- These fixtures are intentionally minimal and may differ from production data
- Missing franchises are backfilled with placeholder empty base-team documents so world-backed review flows can load a full league index
- Designed for UI walkthrough validation, not comprehensive testing
- For full test coverage, use `npm run emu` with production-derived seed data
