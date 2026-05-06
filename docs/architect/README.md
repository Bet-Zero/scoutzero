# Architect Runtime Reference

**Status:** Active runtime reference set for the current Architect implementation.

This router separates current Architect runtime documentation from older
planning/design material.

If you need the current save/load flow, world lifecycle behavior, persistence
rules, or Firestore layout for Architect, start here instead of the older
`docs/architect-teams-plan/` bundle.

## Start Here

These are the best entry points for the current runtime implementation:

1. [Code Ownership Map](../../src/features/architect/ARCHITECT_FEATURE_README.md)
2. [Current Firestore Schema](../schema/CURRENT_FIRESTORE_SCHEMA.md)
3. [Architect Schema Reference](../schema/architect.md)
4. [Persistence Contracts](contracts/PERSISTENCE_CONTRACTS.md)

## Official Runtime Reference Set

Use these as the current Architect runtime/reference set.

| Doc                                                                                     | What it covers                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [ARCHITECT_FEATURE_README.md](../../src/features/architect/ARCHITECT_FEATURE_README.md) | Runtime ownership map for world lifecycle, read stack, write authorities, and shared SSOTs. |
| [CURRENT_FIRESTORE_SCHEMA.md](../schema/CURRENT_FIRESTORE_SCHEMA.md)                    | Current collection layout, migration posture, and active Architect collections.             |
| [architect.md](../schema/architect.md)                                                  | Canonical generated schema reference for Architect documents.                               |
| [PERSISTENCE_CONTRACTS.md](contracts/PERSISTENCE_CONTRACTS.md)                          | Committed write boundary, allowlists, normalization rules, and persistence invariants.      |
| [ARCHITECT_CONNECTIVITY_MASTER.md](ARCHITECT_CONNECTIVITY_MASTER.md)                    | Cross-tab runtime connectivity, canonical write paths, and world-mode coherence.            |
| [ENTITLEMENTS_MASTER.md](entitlements/ENTITLEMENTS_MASTER.md)                           | Entitlement invariants and current world-mode entitlement behavior.                         |
| [OFFSEASON_MASTER.md](OFFSEASON_MASTER.md)                                              | Current season-advance and offseason behavior, including authoritative vs preview paths.    |
| [TEAM_HISTORY_MASTER.md](TEAM_HISTORY_MASTER.md)                                        | Canonical Team History event store and rendering contract.                                  |
| [CAP_SHEET_MASTER.md](cap-sheet/CAP_SHEET_MASTER.md)                                    | Active Cap Sheet runtime SSOT and correctness gates.                                        |
| [free_agency_MASTER.md](free-agency/free_agency_MASTER.md)                              | Free Agency world-mode validation, persistence, and sync behavior.                          |

## Supporting Current Integration Docs

These are current supporting docs, but they are narrower integration references
rather than the core runtime set.

- [cap-sheet/README.md](cap-sheet/README.md)
- [entitlements/README.md](entitlements/README.md)
- [free-agency/README.md](free-agency/README.md)
- [trade-machine/README.md](trade-machine/README.md)

## Maintenance / Gate Docs

These remain current, but they are maintenance references rather than runtime
behavior SSOTs.

- [type-hardening/README.md](type-hardening/README.md)
- [cap-sheet/ARCHITECT_CAP_VALIDATION_INCOMPLETE_FIX.md](cap-sheet/ARCHITECT_CAP_VALIDATION_INCOMPLETE_FIX.md)

## Mixed / Manual Review Required

These docs contain useful current information but should not be treated as the
official runtime source without additional cleanup.

- [trade-machine/TRADE_MACHINE_MASTER.md](trade-machine/TRADE_MACHINE_MASTER.md) — current runtime rules at the top, but also a long historical return-package and execution trail deeper in the file.
- [ARCHITECT_GAP_ANALYSIS.md](../ARCHITECT_GAP_ANALYSIS.md) — useful supporting analysis, but not a stable runtime reference doc.

## Historical Planning And Design

The older Architect planning bundle is preserved for design history and target
schema context, but it is not the live implementation truth.

- [Architect Teams Plan Bundle](../architect-teams-plan/README.md)
- [Archived Architect Teams Plan Bundle](../../archive/docs/architect-teams-plan/README.md)

## Archived Working Docs

Older Architect review trackers, ship-readiness docs, phase plans, audit
blueprints, completed hardening pass masters, and implementation-history docs
were moved out of the active folder.

- [Architect Docs Archive](../../archive/docs/architect/README.md)

## Practical Routing

For common questions, use this path:

- **Who owns a runtime behavior?** Start with [ARCHITECT_FEATURE_README.md](../../src/features/architect/ARCHITECT_FEATURE_README.md).
- **What is stored in Firestore?** Start with [CURRENT_FIRESTORE_SCHEMA.md](../schema/CURRENT_FIRESTORE_SCHEMA.md) and [architect.md](../schema/architect.md).
- **How do committed writes work?** Start with [PERSISTENCE_CONTRACTS.md](contracts/PERSISTENCE_CONTRACTS.md).
- **How do tabs stay connected in world mode?** Start with [ARCHITECT_CONNECTIVITY_MASTER.md](ARCHITECT_CONNECTIVITY_MASTER.md).
- **How do season advance or Team History behave now?** Use the corresponding master doc in this folder.
- **How do Cap Sheet, entitlement, Free Agency, or Trade Machine flows behave now?** Start with the corresponding feature-folder README in this directory, then open the master doc linked from there.

## Mixed Docs Still Pending Extraction

These remain in the active folder for now because they need information
extraction or cleaner replacement before the file itself should be archived.

- [trade-machine/TRADE_MACHINE_MASTER.md](trade-machine/TRADE_MACHINE_MASTER.md)
- [trade-machine/TRADE_MACHINE_PICK_TRADING_MASTER.md](trade-machine/TRADE_MACHINE_PICK_TRADING_MASTER.md)
- [trade-machine/TRADE_MACHINE_VACUUM_MODE_MASTER.md](trade-machine/TRADE_MACHINE_VACUUM_MODE_MASTER.md)
