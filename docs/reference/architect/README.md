# Architect Runtime Reference

**Status:** Active runtime reference for the current Architect implementation.

## Definition

**The Architect** is HoopZero's GM simulation workspace. In product terms, it is
the GM Tools area that lets a user inspect a league entry view, open a team
dashboard, and run world-aware roster, cap, trade, free agency, offseason,
history, comparison, and guided front-office workflows.

Route map:

- `/gm` renders the Architect league entry view (`GmLeagueView` ->
  `LeagueView`).
- `/gm/:teamId` renders the primary Architect team dashboard
  (`GmDashboardView` -> `GMDashboard`).

The primary dashboard is the page headed "HoopZero Architect - GM Dashboard".
Its dashboard sections are Roster, Cap Sheet, Full Cap Table, Trade Machine,
Free Agency, Offseason, Team History, Compare, and Guide. Unless a request
specifically says "Architect League View", "The Architect" usually means this
team dashboard and the shared feature code under `src/features/architect/`.

## Start Here

1. [Code Ownership Map](../../../src/features/architect/ARCHITECT_FEATURE_README.md) — runtime ownership, world lifecycle, write authorities, shared SSOTs
2. [Current Firestore Schema](../schema/CURRENT_FIRESTORE_SCHEMA.md) — collection layout and active Architect collections
3. [Architect Schema Reference](../schema/architect.md) — canonical generated schema docs

## Feature-Specific Docs

- [trade-machine/README.md](trade-machine/README.md) — Trade Machine runtime reference and test gates
- [type-hardening/README.md](type-hardening/README.md) — Type cast ledger and cast gate protocol

Cap sheet, entitlements, and free agency docs have been fully archived. For questions in those areas, start with the [Code Ownership Map](../../../src/features/architect/ARCHITECT_FEATURE_README.md) and [Current Firestore Schema](../schema/CURRENT_FIRESTORE_SCHEMA.md).

## Mixed Reference

- [trade-machine/TRADE_MACHINE_MASTER.md](trade-machine/TRADE_MACHINE_MASTER.md) — current runtime overview at the top; historical execution trail below.

## Archived Docs

All completed execution docs, phase plans, and audit records are in [archive/docs/architect/](../../../archive/docs/architect/README.md).
