/**
 * FILE: src/features/architect/utils/contractHistory/contractHistoryFence.ts
 * PURPOSE: The documented boundary between the contract event history and the mutable contract path.
 * OWNERSHIP: Feature: architect/contract history
 *
 * BZE-271 establishes an immutable contract history. It does not migrate the
 * application onto it. Both paths exist on purpose, and this fence states which
 * is which so a later reader does not mistake the mutable path for a governed
 * history, or assume the history layer has repaired the mutable one.
 *
 * HISTORY SIDE — `src/features/architect/utils/contractHistory/**`. Append-only.
 * Every event carries contract, player, team, and world identity, its own event
 * ID and version, distinct executed, effective, and recorded instants, its
 * predecessor and resulting contract versions, and a source-transaction or
 * authoring identity. Projections are taken at an explicit zoned instant and an
 * explicit Salary Cap Year, and retain the exact ordered events they consumed.
 * No runtime clock, no undated "latest" snapshot, no in-place edit.
 *
 * MUTABLE SIDE — everything listed in `MUTABLE_CONTRACT_CONSUMERS`. These behave
 * exactly as they did before BZE-271. They overwrite contract rows and infer
 * lifecycle state from flags, which is the `contract-event-ledger-incomplete`
 * defect; rewriting them is a migration, and migration is out of scope here.
 *
 * THE FENCE RULES
 *
 *  1. The history path must never import a mutable contract module. Doing so
 *     would launder an overwritten salary row or an inferred flag into a
 *     projected history and re-create the defect the ledger exists to fix. A
 *     structural test enforces this.
 *  2. The mutable path must not import the history path either. A consumer that
 *     read a projection without adopting the fail-closed contract would silently
 *     downgrade it to a best-effort snapshot.
 *  3. The history path must not import the governed season envelope, registry,
 *     or system levels. Replaying contract history needs no Salary Cap, floor,
 *     Tax, or apron value, and taking a dependency on them would make history
 *     unavailable whenever a money input was. Only BZE-270's validated date and
 *     Salary Cap Year primitives are shared.
 *  4. Crossing the fence is a migration, done per consumer, with that consumer's
 *     own issue and tests. Nothing in BZE-271 authorizes it.
 *
 * WHAT THE FENCE DOES NOT CLAIM: no mutable consumer is fixed by this work. The
 * Cap Sheet, Trade Machine, Free Agency, the contract editor, the mutation
 * pipeline, the offseason transition, world persistence, and every saved world
 * still read and overwrite the mutable contract shape.
 */

/**
 * Mutable contract surfaces that remain unmigrated after BZE-271. Each entry
 * names the module and the Canon leaf its behaviour leaves open.
 */
export const MUTABLE_CONTRACT_CONSUMERS = Object.freeze([
  Object.freeze({
    module: 'src/features/architect/utils/contractUtils.ts',
    reason:
      'Shapes and slices one mutable current contract per player; year rows are merged and re-read rather than replayed from dated events (CBA2-L02.1).',
  }),
  Object.freeze({
    module: 'src/features/architect/utils/contractNormalization.ts',
    reason:
      'Normalizes a single mutable contract document in place, with lifecycle state carried on flags such as optionUsed and isExtension (CBA2-L02.1).',
  }),
  Object.freeze({
    module:
      'src/features/architect/utils/mutationPipeline.compute.signings.playerOps.ts',
    reason:
      'computeExtensionResult and computeOptionResult overwrite the contract rather than appending a distinct amendment, conversion, ETO, Extension, or Renegotiation event (CBA2-L02.1).',
  }),
  Object.freeze({
    module:
      'src/features/architect/utils/mutationPipeline.helpers.playerNorm.contract.ts',
    reason:
      'Rebuilds the mutable current and future contract shape on every world write, so prior contract versions are not retained (CBA2-L02.1).',
  }),
  Object.freeze({
    module:
      'src/features/architect/utils/offseason/resolveOffseasonTransition.ts',
    reason:
      'Applies option and contract transitions by advancing the mutable contract, leaving no dated record of the version that existed before the transition (CBA2-L02.1, CBA2-L02.2).',
  }),
] as const);

/**
 * Module path fragments the history path may never import.
 *
 * `governedSeason` is deliberately absent: the history path imports exactly one
 * governed module, `governedSeason/governedTime`, for the validated date and
 * Salary Cap Year primitives. The structural test allows that single specifier
 * and rejects every other governed import, which is narrower than a fragment
 * pattern could express.
 */
export const FENCED_MUTABLE_CONTRACT_PATTERNS = Object.freeze([
  'contractUtils',
  'contractNormalization',
  'contractSalaryUtils',
  'mutationPipeline',
  'resolveOffseasonTransition',
  'capProjections',
  'capRulesProfile',
  'capSettingsProvider',
  'minimumSalaryScales',
  'cbaConstants',
  'capTotals',
] as const);

/**
 * The one governed module the history path may import, as a repo-relative path
 * with no extension. Contract history needs dates and Salary Cap Years, not
 * money.
 *
 * This is a full module path rather than a fragment because a fragment is not a
 * fence. Matching `governedSeason/governedTime` as a substring would also admit
 * `governedSeason/governedTime/money` and anything else nested beneath it, which
 * is exactly the money dependency the boundary exists to keep out. The fence
 * test resolves each specifier — alias or relative — to this form and compares
 * it exactly.
 */
export const ALLOWED_GOVERNED_HISTORY_MODULE =
  'src/features/architect/utils/governedSeason/governedTime' as const;

/**
 * Files the fence covers. The canonical schema is included because it is part of
 * the history contract: it must not reach a mutable contract module or the
 * runtime clock either, even though it lives in `src/schemas/`.
 */
export const FENCED_HISTORY_DIRECTORY =
  'src/features/architect/utils/contractHistory' as const;

export const FENCED_HISTORY_SCHEMA_MODULE =
  'src/schemas/contractEventLedger.ts' as const;

/**
 * Explicit governed consumers. BZE-274 initializes the pinned baselines;
 * BZE-275 owns option authority, atomic persistence, and branch identity
 * rewriting; BZE-276 consumes that authority at the Prior Team signing gate;
 * BZE-282 owns governed extension inspection and immutable event creation;
 * BZE-284 consumes the same pinned history for governed waiver authority;
 * BZE-286 authors the root event for a governed saved-world signing; BZE-287
 * projects that history for ordinary Trade Machine player salary basis;
 * BZE-289 appends complete immutable contract events for one atomic governed
 * 30-team Season Advance.
 */
export const GOVERNED_CONTRACT_HISTORY_CONSUMERS = Object.freeze([
  'src/features/architect/utils/contractSource/contractSourceRelease.ts',
  'src/features/architect/utils/capLegalityValidation/governedPriorTeamOptionSigning.ts',
  'src/features/architect/utils/optionDecisions/contractOverlaySetDigest.ts',
  'src/features/architect/utils/optionDecisions/governedOptionDecision.ts',
  'src/features/architect/utils/optionDecisions/worldOptionDecisionAuthority.ts',
  'src/features/architect/utils/extensions/governedExtension.ts',
  'src/features/architect/utils/extensions/worldExtensionAuthority.ts',
  'src/features/architect/utils/waivers/governedWaiver.ts',
  'src/features/architect/utils/waivers/worldWaiverAuthority.ts',
  'src/features/architect/utils/signings/governedSigningHistory.ts',
  'src/features/architect/utils/tradeMachine/utils/governedTradeSalaryBasis.ts',
  'src/features/architect/utils/seasonManager.history.ts',
  'src/features/architect/utils/mutationPipeline.persist.ts',
  'src/features/architect/utils/worldManager.core.ts',
] as const);
