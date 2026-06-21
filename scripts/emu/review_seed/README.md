# Architect Review Seed Data

Minimal seed fixtures for running Architect in "review mode" without production credentials.

## Purpose

These fixtures provide just enough data to boot the Architect feature and Trade Machine in a fresh environment (e.g., cloud/CI runners) using Firebase emulators. They do NOT require production Firebase credentials.

## Contents

- `baseTeams/LAL.json` — Los Angeles Lakers team data (thin 3-player roster)
- `baseTeams/BOS.json` — Boston Celtics team data (thin 3-player roster)
- `baseTeams/MIA.json` — Miami Heat **Full Cap Table coverage fixture** (see below)
- `baseTeams/PHX.json` — Phoenix Suns **first-apron hard-cap trigger** fixture (BZE-91)
- `baseTeams/MIN.json` — Minnesota Timberwolves **over-the-second-apron** fixture (BZE-91)
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
- **Live own-FA cap hold** — Grant Holloway (Bird/UFA). In base/sandbox review
  mode he renders as a roster row (see limitation below); his cap-hold state is
  data-verified by the coverage probe.
- **Legacy/dead hold** — an off-roster `FA Cap Hold` parked in the **Cap Holds**
  drawer ("Departed Veteran (Legacy Hold)").
- **Multi-season dead money** — stretched waiver (Jordan Baxter) across
  2026-27 → 2028-29.
- **Carried exception + TPE** — Taxpayer MLE and a traded-player exception.
- **Apron state** — real salaries place the team in the **first-apron band**
  (over the luxury tax and first apron, below the second apron).
- **Non-guaranteed future year** (Caleb Unger 2027-28) and a **two-way**
  contract (Tobias Lund).
- **Future-season columns** — salaries, options, dead money and incomplete
  roster charges (as the roster thins out by 2029-30) share the same route.

States intentionally NOT on the MIA fixture (covered by dedicated fixtures, not faked):

- **Hard-cap *trigger*** — a real hard cap is only set when a triggering
  transaction (NT-MLE, BAE, or sign-and-trade) is executed and records
  `hardCapTriggeredBy`. MIA exercises the **apron bands** (derived from salary)
  but does not force a hard-cap trigger, since doing so would contradict its
  still-usable carried exceptions. A real first-apron hard-cap trigger is covered
  by the **PHX** fixture below (BZE-91).
- **Second-apron freezes** — MIA is kept below the second apron on purpose so the
  carried Taxpayer MLE / TPE stay usable rather than frozen. A real
  over-the-second-apron posture is covered by the **MIN** fixture below (BZE-91).
- ~~**Inline renounce-able own-FA row**~~ — RESOLVED by BZE-89 (see below). The
  inline resign/absolve FA decision row (`cap-sheet-full-fa-decision-row`) does
  **not** need the world/home-base own-FA pipeline; it renders in base/sandbox
  review mode under the fixture's own season (2026-27, `?season=2027`). On the
  app's default landing season (2025-26 as of mid-2026) Grant Holloway still has
  a salary slice, so he renders as a roster row — that is why BZE-87 only saw a
  roster row. See the BZE-89 section below.

The deterministic coverage probe lives in
`tests/architect/reviewSeedFullCapTable.coverage.test.ts` and asserts these
states stay present at the data level (run via `npm run test:architect`).

## Browser verification (BZE-87)

The fixture is browser-verifiable at **`/gm/MIA`** (Full Cap Table is the default
landing room; `?room=capfull` is equivalent), season **2026-27**, in review mode.
The Playwright probe `tests/e2e/full-cap-table-mia.spec.ts` boots the review
harness and asserts, in a real browser, that the fuller roster, Player/Team
Option cells, multi-season dead money, the legacy cap-holds drawer, carried
exceptions (MLE/TPE), and the first-apron posture all render:

```bash
PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/full-cap-table-mia.spec.ts
```

The harness signs in anonymously against the auth emulator (`useAuth`), and the
MIA base team loads through `loadTeamCapSheet` → `hydrateBaseTeam`, so no saved
world is required for the read-only render.

## Own-FA decision row (BZE-89)

The inline renounce-able own-FA decision row (`cap-sheet-full-fa-decision-row`)
is browser-verifiable at **`/gm/MIA?season=2027`** (the fixture's own **2026-27**
season), in base/sandbox review mode — **no saved world required**.

Why the season matters: the Full Cap Table defaults to the current real-world
season (2025-26 as of mid-2026). Under 2025-26 the own free agent **Grant
Holloway** still has a salary slice (his contract runs 2023-24 → 2025-26), so he
renders as a normal **roster row** (what BZE-87 observed). Under **2026-27** his
contract has expired, so he drops off the roster list and his UFA cap hold
resolves to `placement: 'main'` and renders as the inline resign/absolve row:

- **Resign** — a clickable re-sign cell (`cap-sheet-full-fa-resign-cell`) in the
  free-agency column, tagged with his **Bird** rights (`fa-bird-rights`).
- **Absolve** — a renounce button (`cap-sheet-full-fa-absolve-button`) in the
  row's hover overlay. In base/sandbox mode the renounce mutation is applied
  `local-only` (in-memory, never persisted), so it is safe to exercise in tests:
  a reload re-reads the seeded hold, so no state leaks between tests.

The Playwright probe `tests/e2e/full-cap-table-own-fa.spec.ts` boots the review
harness and asserts, in a real browser, that the own FA surfaces as the inline
decision row, that the resign/absolve affordances are present, and that Absolve
clears the hold and removes the row:

```bash
PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/full-cap-table-own-fa.spec.ts
```

## Hard-cap / second-apron posture (BZE-91)

BZE-85 deliberately left a real hard-cap trigger and a second-apron posture off
the MIA fixture (both would have contradicted MIA's still-usable carried
exceptions). BZE-91 adds two **focused** fixtures that exercise those states
honestly, on the Full Cap Table's shared cockpit posture band (the apron tiles +
hard-cap lock). Both target season **2026-27** and are viewed under their own
season at **`?season=2027`**, because apron posture is derived from each team's
2026-27 salaries.

### PHX — triggered first-apron hard cap (`/gm/PHX?season=2027`)

A team that **triggered** a first-apron hard cap by using its **Non-Taxpayer
MLE**. This is the honest, non-faked representation: the fixture records the
originating trigger via `hardCapTriggeredBy: "fullMLE"` (top-level, read by
`hydrateBaseTeam`) and mirrors it under `totals` (read by `getHardCapStatus`),
plus `hardCapLevel: "firstApron"` and a user-facing `hardCapReason`. Roster
salary is left well below the first apron so the team never exceeds its own
ceiling.

Browser-verifiable: the **1st Apron** posture tile (`cockpit-status-apron1`)
carries the hard-cap lock (`cockpit-status-hard-cap-lock`); hovering it reveals
**"Hard Capped at 1st Apron"** and the **Non-Taxpayer MLE** trigger reason.

### MIN — over the second apron (`/gm/MIN?season=2027`)

A team whose **real salary is above the second apron** (~$234M of roster salary
vs the $222.37M second-apron line). This mirrors MIA's salary-derived first-apron
band, one tier up. It carries **no** triggered hard cap and **no** usable
exceptions (second-apron teams have them frozen), so it is honest, not a faked
flag.

Browser-verifiable: the **2nd Apron Space** tile value
(`cockpit-status-apron2-value`) renders in the over-the-line (red) treatment, and
there is **no** hard-cap lock badge (the second apron here is a band posture, not
a triggered cap).

The deterministic coverage probe lives in
`tests/architect/reviewSeedHardCapApron.coverage.test.ts`; the browser proof is
`tests/e2e/full-cap-table-hard-cap-apron.spec.ts`:

```bash
PLAYWRIGHT_ARCHITECT_REVIEW_MODE=true npx playwright test tests/e2e/full-cap-table-hard-cap-apron.spec.ts
```

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
