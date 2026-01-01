/************************** SCSP™ BLOCK: tradeHelpers.js  **************************
 * FULL FILE REPLACEMENT — drop-in ready
 * ▸ Fixes: getSalaryForYear, getIncomingCeiling, calculateAllowableIncoming,
 * areSamePick  (numeric leniency)
 * ▸ Keeps: MIN_SALARY, getApronStatus, pick utils, TPE utils, format helpers
 * ▸ Phase 2 update: Delegates to unified salaryMatchingRules for tier calculations
 * -------------------------------------------------------------------------------*/
import {
  CBA_BY_YEAR,
  MATCHING_BANDS_2023,
} from '@/features/architect/utils/cbaConstants.js';
import {
  getSalaryMatchingResult,
  SALARY_MATCHING_TIERS,
} from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules.js';
export { wouldExceedHardCap } from '@/features/architect/utils/hardCapUtils.js';
import { isPriorYearTPE } from '@/features/architect/utils/tradeMachine/utils/tradeUtilities.js';
import { getTeamFaExceptionBuckets } from '@/features/architect/utils/faExceptionUtils.js';

/**
 * Returns tier thresholds for salary matching
 * @deprecated Use SALARY_MATCHING_TIERS from salaryMatchingRules.js directly
 */
export const getTierThresholds = (yearKey) => {
  // Return unified tier thresholds instead of CBA_BY_YEAR-based ones
  // This ensures consistency with the unified salary matching rules
  return [
    SALARY_MATCHING_TIERS.TIER_1_THRESHOLD,
    SALARY_MATCHING_TIERS.TIER_2_THRESHOLD,
  ];
};
export const MIN_SALARY = 1_119_563;

/*────────────────────────  Salary Helpers  ────────────────────────*/
import { toEndYear } from './seasonFormat.js';

/******************** SCSP™ BLOCK: getSalaryForYear ********************/
export const getSalaryForYear = (input, year) => {
  if (!year) return 0;

  // Accept a single player or an array
  const players = Array.isArray(input) ? input : [input];

  return players.reduce((sum, p) => {
    // Prefer Architect contract.salariesByYear if present
    let base = 0;
    let yData = {};

    if (p.contract?.salariesByYear?.length) {
      const slice =
        p.contract.salariesByYear.find((y) => toEndYear(y.season) === year) ||
        p.contract.salariesByYear.find(
          (y) => String(y.season) === String(year)
        );
      if (slice) {
        yData = slice;
        base = slice.capHit ?? slice.salary ?? 0;
      }
    }

    // Fall back to player's .salary property if no contract data found
    if (!base && typeof p.salary === 'number') {
      base = p.salary;
    }

    // Handle likely incentives from multiple possible locations:
    // - yData.likely_bonus (legacy format)
    // - yData.bonuses?.likely (nested object format)
    // - yData.incentives?.likely (test format)
    // - yData.likelyIncentives (alternative naming)
    // - p.bonusesByYear[year].likely (player-level bonuses)
    const likely =
      (typeof yData.likely_bonus === 'number' ? yData.likely_bonus : 0) ||
      (yData.bonuses?.likely ?? 0) ||
      (yData.incentives?.likely ?? 0) ||
      (yData.likelyIncentives ?? 0) ||
      (p.bonusesByYear?.[year]?.likely ??
        p.bonusesByYear?.[String(year)]?.likely ??
        0);

    return sum + base + likely;
  }, 0);
};
/****************** END SCSP™ BLOCK: getSalaryForYear ******************/

/*─────────────────────  Incoming-Salary (CBA rules)  ─────────────────────*/

// Default cap settings fallback (2024-25 values)
const DEFAULT_CAP_SETTINGS = {
  salaryCap: 141_000_000,
  firstApron: 178_132_000,
  secondApron: 188_931_000,
};

// ────────────────── Incoming-Salary Ceiling (CBA tiers) ──────────────────
/**
 * Calculates allowed incoming salary for over-cap teams below first apron
 * @deprecated Internal helper - use getSalaryMatchingResult from salaryMatchingRules.js
 * @param {number} out - Outgoing salary
 * @param {number} yearKey - Season year (unused, kept for backwards compatibility)
 * @param {Object} capSettings - Optional cap settings to use
 */
const allowedIncomingBelowFirstApron = (out, yearKey, capSettings = DEFAULT_CAP_SETTINGS) => {
  // Use unified salary matching rules directly
  const result = getSalaryMatchingResult({
    // Placeholder salary - actual value irrelevant because apronStatus is forced to OVER_CAP
    teamTotalSalary: 150_000_000,
    outgoingSalary: out,
    capSettings,
    apronStatus: 'OVER_CAP', // Force over-cap band calculation
  });
  return result.allowableIncoming;
};
export const getIncomingCeiling = (
  teamTotalSalary,
  salaryOut,
  tradeExceptions = [],
  capSettings,
  yearKey = 2025
) => {
  // Use provided capSettings or fall back to defaults
  const effectiveCapSettings = capSettings || DEFAULT_CAP_SETTINGS;
  
  // 1️⃣ Cap-space clubs can climb to the cap.
  if (teamTotalSalary < effectiveCapSettings.salaryCap) {
    return effectiveCapSettings.salaryCap;
  }

  // 2️⃣ Over-cap matching bands (below first apron) - pass capSettings through
  let ceiling = allowedIncomingBelowFirstApron(salaryOut, yearKey, effectiveCapSettings);

  // 3️⃣ Apron limiters – 100 % of outgoing
  if (teamTotalSalary >= effectiveCapSettings.secondApron) {
    ceiling = salaryOut;
  } else if (teamTotalSalary >= effectiveCapSettings.firstApron) {
    ceiling = salaryOut;
  }

  // 4️⃣ Add any valid TPE amounts
  const tpeValue = tradeExceptions
    .filter(
      (t) =>
        !t.expired && // legacy tests
        (!t.expirationDate || Date.parse(t.expirationDate) > Date.now()) &&
        !(
          teamTotalSalary >= effectiveCapSettings.secondApron &&
          isPriorYearTPE(t, yearKey)
        )
    )
    .reduce(
      (sum, t) =>
        sum +
        (t.remaining ??
          (typeof t.amount === 'number'
            ? t.amount - (t.used ?? 0) // subtract “used” portion
            : typeof t.value === 'number'
              ? t.value - (t.used ?? 0)
              : 0)),
      0
    );

  return Math.floor(ceiling + tpeValue);
};

export const getIncomingCeilingViaFaException = (team, bucketType) => {
  const buckets = getTeamFaExceptionBuckets(team.team || {});
  const bucket = buckets.find((b) => b.type === bucketType);
  const remaining = bucket?.remaining ?? 0;
  return (team.salaryOut || 0) + remaining;
};

/******************** SCSP™ BLOCK: Allowable Incoming *******************
 * calculateAllowableIncoming now returns “allowable *incoming* salary”
 * – for over-cap teams = ceiling − salaryOut
 * – for cap-space teams = cap − current payroll
 ***********************************************************************/
// ────────────────── Allowable Incoming *Margin* ──────────────────
// ───────────────────────────────────────────────────────────────────
//  NEW calculateAllowableIncoming  (back-compat wrapper + impl)
// ───────────────────────────────────────────────────────────────────

/* internal object-style implementation */
function _calculateAllowableIncomingObj({
  currentTeamSalary,
  salaryOut,
  secondApronStatus,
  firstApronStatus = false,
  yearKey,
  tpeAmount = 0,
}) {
  const year = String(yearKey);
  const capData = CBA_BY_YEAR[year] || {};
  const salaryCap = capData.salaryCap || 0;

  if (currentTeamSalary < salaryCap) {
    const capSpace = salaryCap - currentTeamSalary;
    const margin = Math.max(capSpace, tpeAmount);
    return { ceiling: margin, margin };
  }

  let ceiling;
  if (secondApronStatus || firstApronStatus) {
    ceiling = salaryOut;
  } else {
    ceiling = allowedIncomingBelowFirstApron(salaryOut, yearKey);
  }
  if (salaryOut === 0) ceiling = 0;

  const gross = ceiling + tpeAmount;
  return { ceiling: gross, margin: gross - salaryOut };
}

/**
 *  Back-compat façade — works with either signature:
 *    1) object  ➜  { currentTeamSalary, salaryOut, … }
 *    2) positional ➜ (currentTeamSalary, salaryOut, secondApron, yearKey, tpe?)
 */

export const calculateAllowableIncoming = (...args) => {
  // Object style: passthrough to internal helper
  if (typeof args[0] === 'object' && args.length === 1) {
    return _calculateAllowableIncomingObj(args[0]);
  }

  // Positional legacy signature
  const [
    currentTeamSalary,
    salaryOut,
    /* _incomingPlayers = [], */,
    tradeExceptions = [],
    capSettings = {},
    yearKey = 2025,
  ] = args;

  const tpeAmount = (tradeExceptions || [])
    .filter(
      (t) =>
        !t.expired &&
        (!t.expirationDate || Date.parse(t.expirationDate) > Date.now())
    )
    .reduce(
      (sum, t) =>
        sum +
        (t.remaining ??
          (typeof t.amount === 'number'
            ? t.amount - (t.used ?? 0)
            : typeof t.value === 'number'
              ? t.value - (t.used ?? 0)
              : 0)),
      0
    );

  const secondApronStatus =
    typeof capSettings.secondApron === 'number'
      ? currentTeamSalary >= capSettings.secondApron
      : false;
  const firstApronStatus =
    typeof capSettings.firstApron === 'number'
      ? currentTeamSalary >= capSettings.firstApron
      : false;

  return _calculateAllowableIncomingObj({
    currentTeamSalary,
    salaryOut,
    secondApronStatus,
    firstApronStatus,
    yearKey,
    tpeAmount,
  }).margin;
};

export const getSeasonalCashLimit = (yearKey) => {
  const key = String(yearKey);
  const fallbackKey = Object.keys(CBA_BY_YEAR).pop(); // latest defined year
  return (CBA_BY_YEAR[key] ?? CBA_BY_YEAR[fallbackKey]).cashLimit;
};

/****************** END SCSP™ BLOCK: Allowable Incoming ******************/

/*───────────────────────────  Apron Status  ───────────────────────────*/
export const getApronStatus = (salary, { firstApron, secondApron } = {}) => {
  if (secondApron && salary >= secondApron) return '2nd Apron';
  if (firstApron && salary >= firstApron) return '1st Apron';
  return 'Below Aprons';
};

/*───────────────────────────  Pick Helpers  ───────────────────────────*/
export const areSamePick = (a, b) =>
  +a.year === +b.year &&
  +a.round === +b.round &&
  (a.via || '') === (b.via || '');

export const formatPick = (p) => {
  let str = `${p.year} ${p.round} Round`;
  if (p.via) str += ` (via ${p.via})`;
  if (p.protection) str += ` 🛡 ${p.protection}`;
  if (p.isSwap) str += ' 🔁 Swap';
  if (p.note) str += ` 📝 ${p.note}`;
  return str;
};

export const isMeaningfulProtection = (prot) =>
  !!prot &&
  (/top\s*\d+/i.test(prot) || /lottery/i.test(prot) || /1-14/i.test(prot));

/*────────────────────────  Trade-Exception Helpers  ───────────────────────*/
export const calculateTPERemaining = (tpe, used = 0) => tpe.amount - used;

export const playerFitsInTPE = (player, yearKey, tpe) => {
  if (!tpe || tpe.isUsed) return false;

  const salary = getSalaryForYear(player, yearKey);

  const now = Date.now();
  const exp = tpe.expirationDate ? Date.parse(tpe.expirationDate) : Infinity;

  return salary <= tpe.amount && now < exp;
};

/*───────────────────────  Formatting & Misc Utilities  ───────────────────*/
export const formatCurrency = (val) =>
  typeof val === 'number' ? `$${val.toLocaleString()}` : '-';

export const generateTradeId = (teams) =>
  teams
    .map(
      (t) =>
        `${t.team?.id}:${t.sends
          .map((p) => p.id)
          .sort()
          .join(',')}`
    )
    .join('|');

/*───────────────────────  P1: Adjustment Type Detection  ───────────────────*/
/**
 * Detects specific matching adjustment types for a player.
 * Returns an array of adjustment types (e.g., ['BYC', 'Trade Kicker']).
 * Used for display purposes in trade UI tooltips.
 * 
 * RULES (P1 cleanup - January 2026):
 * - Only label specific adjustment types when EXPLICITLY flagged in player data
 * - BYC: only if player.isBYC === true OR player.baseYearCompensation === true
 * - Trade Kicker: only if player.tradeKicker exists OR player.tradeKickerPct > 0
 * - Poison Pill: ONLY if player.isPoisonPill === true (explicit flag)
 * - Do NOT infer Poison Pill from isRookieScale (rookie-scale ≠ poison pill)
 * 
 * @param {Object} player - Player object with contract/adjustment flags
 * @returns {string[]} Array of adjustment type names
 */
export const getPlayerAdjustmentTypes = (player) => {
  if (!player) return [];
  
  const adjustmentTypes = [];
  
  // BYC detection - explicit flag only
  if (player.isBYC === true || player.baseYearCompensation === true) {
    adjustmentTypes.push('BYC');
  }
  
  // Trade Kicker detection - explicit flag only
  if (player.tradeKicker || player.tradeKickerPct > 0) {
    adjustmentTypes.push('Trade Kicker');
  }
  
  // Poison Pill detection - EXPLICIT FLAG ONLY
  // NOTE: Do NOT infer from isRookieScale. Rookie-scale contracts are not automatically poison pills.
  // A poison pill only exists when a rookie extension's averaged salary differs materially from the current year.
  if (player.isPoisonPill === true) {
    adjustmentTypes.push('Poison Pill');
  }
  
  return adjustmentTypes;
};

/**
 * Returns a tooltip label for matching adjustments.
 * Returns specific types if detected, otherwise a generic message.
 * 
 * @param {Object} player - Player object
 * @returns {string} Human-readable adjustment label
 */
export const getAdjustmentTooltipLabel = (player) => {
  const types = getPlayerAdjustmentTypes(player);
  return types.length > 0
    ? types.join(', ')
    : 'Adjusted trade matching value (BYC/kicker/poison pill may apply)';
};

/*───────────────────────────────  EOF  ───────────────────────────────*/
