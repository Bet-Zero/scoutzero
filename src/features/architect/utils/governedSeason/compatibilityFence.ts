/**
 * FILE: src/features/architect/utils/governedSeason/compatibilityFence.ts
 * PURPOSE: The documented boundary between governed season inputs and legacy ones.
 * OWNERSHIP: Feature: architect/governed season inputs
 *
 * BZE-270 establishes a governed path. It does not migrate the application to
 * it. Both paths exist on purpose, and this fence states which is which so a
 * later reader does not mistake the legacy path for a governed one, or assume
 * the governed path has fixed the legacy one.
 *
 * GOVERNED SIDE — `src/features/architect/utils/governedSeason/**` plus
 * `capTotals/governedDatedSalaryLedgers.ts`. Fail-closed. Every value carries
 * source artifact identity, exact source field, record version, effective
 * period, and authority class. No runtime clock, no prior-season inheritance,
 * no ungoverned constant.
 *
 * LEGACY SIDE — everything listed in `LEGACY_UNGOVERNED_SEASON_INPUTS`. These
 * still behave exactly as they did before BZE-270. They are not governed, and
 * BZE-270 deliberately did not change them: rewriting them is a migration, and
 * migration is out of scope for this issue.
 *
 * THE FENCE RULES
 *
 *  1. The governed path must never import a legacy season-input module. Doing
 *     so would launder an unversioned constant into a governed result and
 *     re-create defect `CBA2-S02.3`. A structural test enforces this.
 *  2. The legacy path must not import the governed path either. A legacy caller
 *     that reads a governed record without adopting the fail-closed contract
 *     would silently downgrade it to a best-effort value.
 *  3. Crossing the fence is a migration, done per consumer, with that
 *     consumer's own issue and tests. Nothing in BZE-270 authorizes it.
 *
 * WHAT THE FENCE DOES NOT CLAIM: no legacy consumer is fixed by this work. Cap
 * Sheet, Trade Machine, Free Agency, contracts, persistence, and UI all still
 * read the legacy values, and the runtime-clock fallback in
 * `resolveWorldAsOfDate` is still there.
 */

/**
 * Legacy season-input surfaces that remain ungoverned after BZE-270. Each entry
 * names the module and the defect that keeps it on the legacy side.
 */
export const LEGACY_UNGOVERNED_SEASON_INPUTS = Object.freeze([
  Object.freeze({
    module: 'src/features/architect/utils/capProjections.ts',
    reason:
      'Unversioned mutable constants with a coarse confirmed flag; no source artifact, exact field, retrieval metadata, or record version (CBA2-S01.3, CBA2-S02.5).',
  }),
  Object.freeze({
    module: 'src/features/architect/utils/capRulesProfile/capRulesProfile.ts',
    reason:
      'Facade over the above; resolves by season key with prior-season and growth fallbacks rather than failing closed (CBA2-S01.9, CBA2-S02.3).',
  }),
  Object.freeze({
    module:
      'src/features/architect/utils/tradeMachine/utils/capSettingsProvider.ts',
    reason:
      'Supplies cap settings to the legacy facade from the same ungoverned constants (CBA2-S02.4).',
  }),
  Object.freeze({
    module: 'src/features/architect/data/minimumSalaryScales.ts',
    reason:
      'Season-keyed scales that fall back to the latest available season instead of returning unavailable (CBA2-S01.9).',
  }),
  Object.freeze({
    module: 'src/features/architect/utils/mutationPipeline.read.utils.ts',
    reason:
      'resolveWorldAsOfDate still falls back to the runtime clock when no date is supplied, which is exactly the world-time-defaults-remain defect (CBA2-L01.1).',
  }),
] as const);

/** Module path prefixes the governed path may never import. */
export const FENCED_LEGACY_MODULE_PATTERNS = Object.freeze([
  'capProjections',
  'capRulesProfile',
  'capSettingsProvider',
  'minimumSalaryScales',
  'mutationPipeline',
  'cbaConstants',
] as const);
