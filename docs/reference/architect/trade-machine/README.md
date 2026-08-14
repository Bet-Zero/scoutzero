# Architect Trade Machine

**Status:** Current Trade Machine reference cluster.

This folder groups the main Trade Machine master doc, the supporting cap
integration and preview/apply truth review docs, plus the two narrower
execution/history files that still contain useful current detail.

## Start Here

- [TRADE_MACHINE_MASTER.md](TRADE_MACHINE_MASTER.md) — mixed current Trade Machine runtime reference; use with the main Architect router and supporting docs here.

## Supporting Current Docs

- [ARCHITECT_TM_VALIDATOR_TRUTH_REVIEW.md](ARCHITECT_TM_VALIDATOR_TRUTH_REVIEW.md) — preview/apply authority review against live code (2026-03-25).

## Governed Salary-Matching Paths

The live Trade Machine requires an explicit salary-path election for each team
before validation. The currently supported paths are Standard TPE, Aggregated
Standard TPE, and Room. Each election carries exact post-assignment Apron Team
Salary and, for outgoing-player paths, exact pre-trade Salary by player.

Validation evaluates and receipts components instead of using the former
generic matching-band estimate. It fails closed on missing exact inputs,
unsupported below-cap TPE elections, Room/TPE overlap, and path structure or
limit violations. A passing Standard path may create only its exact remaining
component; that component retains its total, used amount, remaining amount,
one-year expiry, path provenance, and Canon leaf references through apply and
reload.

Current governed Canon scope is CBA2-A02.1, A02.2, A02.4, A02.5, A02.9,
A02.10, and A02.12. A02.3 expiry behavior and A02.14 Two-Way exclusion remain
in force. Expanded, Transition, explicit below-cap TPE election, and missing
transaction-history paths remain unsupported and fail closed rather than
falling back to a generic formula.

Execution history (TM_CAP_INTEGRATION_MASTER, TRADE_MACHINE_PICK_TRADING_MASTER, TRADE_MACHINE_VACUUM_MODE_MASTER) archived to `archive/docs/architect/`.

## Routing Rule

Use [../README.md](../README.md) for cross-feature Architect routing.
Use this folder when the question is specifically about Trade Machine preview,
apply, routing, sandbox behavior, or cap integration.
