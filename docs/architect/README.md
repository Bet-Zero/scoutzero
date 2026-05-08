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
| [ARCHITECT_FEATURE_README.md](../../src/features/architect/ARCHITECT_FEATURE_README.md) | Runtime ownership map for world lifecycle, read stack, write authorities, and shared SSOTs. |

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

- [trade-machine/TRADE_MACHINE_MASTER.md](trade-machine/TRADE_MACHINE_MASTER.md) — current runtime rules at the top, but also a long historical return-package and execution trail deeper in the file. (ESCALATE — 160 mixed references, no canonical tradeMachine return-package area yet.)

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
- **How do tabs stay connected / how do specific features behave?** Start with the corresponding feature-folder README in this directory.

## Mixed Reference

- [trade-machine/TRADE_MACHINE_MASTER.md](trade-machine/TRADE_MACHINE_MASTER.md) — current runtime overview at the top; historical execution trail below.
