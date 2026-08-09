# Governed Rights Workflow

## Purpose

Saved-world free-agent rights are governed by dated, immutable evidence. The
Full Cap Table uses that evidence to classify Bird rights, calculate the Free
Agent Amount, and renounce rights without treating a mutable player or cap-hold
snapshot as authoritative.

This boundary currently governs the Phase 3A.5 Full Cap Table path only. It is
not a product-wide rights or contract-signing implementation.

## Ledger Rules

- A team's `rightsLedger` is validated by the canonical Zod contract in
  `src/schemas/rightsEventLedger.ts` before it is used.
- Events and their nested service and amount evidence are append-only,
  versioned records. Corrections supersede an exact prior version; they do not
  rewrite or delete history.
- Each player and Salary Cap Year has one reachable chain from a
  `rights-established` root. Detached events, forks, cycles, version gaps, and
  conflicting current records fail closed.
- Every event records stable world, team, player, state, date, and provenance
  references. These references are suitable for later transaction-manifest
  integration, but Phase 3A.5 does not create transaction history.

## Dated Projection

The Full Cap Table projects each cap hold in the Salary Cap Year identified by
that hold's season. The projection uses governed contract, salary, service,
minimum, maximum, source, and version inputs to derive Full Bird, Early Bird,
or Non-Bird status and the applicable Free Agent Amount.

If required evidence is missing, stale, conflicting, outside its effective
window, or unsupported, the row and affected yearly total show `Needs input`.
The stored hold amount, hardcoded multipliers, the runtime clock, and mutable
player flags are not fallback authorities on this path.

## Renunciation

Renunciation is available only in a compatible saved world with a governed
date and a readable rights ledger. The mutation appends a dated
`rights-renounced` event, removes only the matching cap hold, persists the team
and history event atomically, and rejects a stale ledger version rather than
overwriting a concurrent append.

After commit, Full Cap Table and Team History must show the same former rights
status, removed amount, and resulting state reference. Reload must reproduce
the same projection from the persisted ledger.

## Compatibility Boundary

Phase 3A.5 intentionally uses a clean break for saved worlds:

- New worlds carry the governed-rights compatibility version.
- A compatible branch preserves the source ledger and rewrites only the child
  world identity while retaining replayable history.
- A pre-ledger world or branch is incompatible and must be recreated.
- No migration, imported-current-state genesis, backfill, compatibility
  adapter, or invented history is allowed.

Treat the recreate-world message as a data-integrity guard, not a recoverable
legacy mode.

## Related Boundaries

- `docs/agent-guides/architect-boundary.md`
- `src/features/architect/utils/rightsHistory/`
- `src/features/architect/utils/mutationPipeline.persist.ts`
- `src/features/architect/capSheet/CapSheetFull/`
