/**
 * Structural boundary for BZE-272's isolated completed-trade history path.
 *
 * The new path may import its canonical schema, its own modules, and BZE-270's
 * governed-time primitives. It may not read mutable transaction production
 * code, persistence, UI consumers, BZE-271 internals, or downstream state
 * owners. Crossing this fence is a later consumer migration.
 */

export const FENCED_TRANSACTION_HISTORY_DIRECTORY =
  'src/features/architect/utils/transactionHistory' as const;

export const FENCED_TRANSACTION_HISTORY_SCHEMA =
  'src/schemas/transactionEventLedger.ts' as const;

export const ALLOWED_TRANSACTION_HISTORY_LOCAL_MODULES = Object.freeze([
  'src/features/architect/utils/transactionHistory',
  'src/features/architect/utils/governedSeason/governedTime',
  'src/schemas/transactionEventLedger',
] as const);

/** Existing mutable surfaces remain unchanged and unmigrated by BZE-272. */
export const UNMIGRATED_TRANSACTION_SURFACES = Object.freeze([
  Object.freeze({
    module:
      'src/features/architect/utils/mutationPipeline.compute.ts and helpers',
    reason:
      'Computes mutable world writes without a versioned completed-trade ledger or exact commit receipt (CBA2-L06.1, CBA2-L06.7).',
  }),
  Object.freeze({
    module: 'src/features/architect/utils/mutationPipeline.persist.ts',
    reason:
      'Persists current snapshots and an unversioned audit payload; production persistence remains outside this foundation (CBA2-L06.2).',
  }),
  Object.freeze({
    module: 'src/features/architect/utils/tradeMachine/**',
    reason:
      'Trade legality and TPE/DPE behavior remain direct-owner work; Standard TPE behavior is preserved unchanged (CBA2-L06.3–.6).',
  }),
  Object.freeze({
    module:
      'Cap Sheet, Trade Machine, Free Agency, editor, and world consumers',
    reason:
      'No rendered or saved-data consumer is migrated to the isolated history path.',
  }),
] as const);
