# Architect Review Seed Data

Minimal seed fixtures for running Architect in "review mode" without production credentials.

## Purpose

These fixtures provide just enough data to boot the Architect feature and Trade Machine in a fresh environment (e.g., cloud/CI runners) using Firebase emulators. They do NOT require production Firebase credentials.

## Contents

- `baseTeams/LAL.json` — Los Angeles Lakers team data (thin 3-player roster)
- `baseTeams/BOS.json` — Boston Celtics team data (thin 3-player roster)
- `baseTeams/MIA.json` — Miami Heat **Full Cap Table coverage fixture** (see below)
- `basePlayers/` — Player records for the seeded teams
- `basePlayers/review_offer_sheet_guard.json` — Unrostered restricted free agent for review-mode free-agency coverage
- `basePlayers/mia_*.json` — Roster + own-free-agent records for the MIA coverage fixture
- `baseEntitlements.json` — Sample entitlements for testing

## MIA — Full Cap Table coverage fixture (BZE-85)

`baseTeams/MIA.json` is a dedicated review fixture that exercises the
Full Cap Table at `/gm/MIA` against realistic cap/table states instead of the
thin 0-/3-player seeds. Season: `2026-27`.

States browser-verifiable at `/gm/MIA`:

- **Fuller roster** — 13 visible roster rows + 1 own free agent (14 roster ids).
- **Player Option** — Theo Bennett (2028-29) and **Team Option** — Andre Cole
  (2027-28); rookie-scale Team Option — Quentin Diaz (2027-28).
- **Live own-FA cap hold** — Grant Holloway (Bird/UFA, expired contract) renders
  as a renounce-able ("Absolve") cap-table row.
- **Legacy/dead hold** — an off-roster `FA Cap Hold` parked in the holds drawer.
- **Multi-season dead money** — stretched waiver (Jordan Baxter) across
  2026-27 → 2028-29.
- **Carried exception + TPE** — Taxpayer MLE and a traded-player exception.
- **Apron state** — real salaries place the team in the **first-apron band**
  (over the luxury tax and first apron, below the second apron).
- **Non-guaranteed future year** (Caleb Unger 2027-28) and a **two-way**
  contract (Tobias Lund).
- **Future-season columns** — salaries, options, dead money and incomplete
  roster charges (as the roster thins out by 2029-30) share the same route.

States NOT covered (documented limitations, not faked):

- **Hard-cap *trigger*** — a real hard cap is only set when a triggering
  transaction (NT-MLE, BAE, or sign-and-trade) is executed and records
  `hardCapTriggeredBy`. The fixture exercises the **apron bands** (derived from
  salary) but does not statically force a hard-cap trigger, since doing so would
  fake a state with no originating transaction.
- **Second-apron freezes** — kept below the second apron on purpose so the
  carried Taxpayer MLE / TPE stay usable rather than frozen.

The deterministic coverage probe lives in
`tests/architect/reviewSeedFullCapTable.coverage.test.ts` and asserts these
states stay present (run via `npm run test:architect`).

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
