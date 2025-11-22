/************************** SCSP™ BLOCK: tradeHelpers.js  **************************
 * FULL FILE REPLACEMENT — drop-in ready
 * ▸ Fixes: getSalaryForYear, getIncomingCeiling, calculateAllowableIncoming,
 * areSamePick  (numeric leniency)
 * ▸ Keeps: MIN_SALARY, getApronStatus, pick utils, TPE utils, format helpers
 * -------------------------------------------------------------------------------*/
import {
  CBA_BY_YEAR,
  MATCHING_BANDS_2023,
} from '@/utils/architect/cbaConstants.js';
export { wouldExceedHardCap } from '@/utils/architect/hardCapUtils.js';
import { isPriorYearTPE } from '@/utils/architect/tradeMachine/utils/tradeUtilities.js';
import { getTeamFaExceptionBuckets } from '@/utils/architect/faExceptionUtils.js';
import { getSalaryForSeason, yearToSeason, seasonToYear } from '@/utils/architect/tradeMachine/utils/seasonUtils.js';

export const getTierThresholds = (yearKey) => {
  const key = String(yearKey); // normalise
  const bucket =
    CBA_BY_YEAR[key] ?? CBA_BY_YEAR[Object.keys(CBA_BY_YEAR).pop()];
  return bucket.salaryTiers; // [tier1, tier2]
};
export const MIN_SALARY = 1_119_563;

/*────────────────────────  Salary Helpers  ────────────────────────*/
/******************** SCSP™ BLOCK: getSalaryForYear ********************/
/**
 * Convert year parameter to numeric year for old schema lookup
 * Old schema uses end-year keys (e.g., 2025 for "2024-25" season)
 * @param {number|string} year - Numeric year or season string
 * @returns {number|null} Numeric end year for old schema lookup
 */
const convertYearForOldSchema = (year) => {
  if (typeof year === 'number') {
    return year;
  }
  if (typeof year === 'string' && year.includes('-')) {
    const startYear = seasonToYear(year);
    return startYear ? startYear + 1 : null;
  }
  return null;
};

/**
 * Get salary for a year or season from player(s)
 * Works with both new schema (salariesByYear array) and old schema (salaries_by_year object)
 * @param {Object|Array} input - Single player or array of players
 * @param {number|string} year - Numeric year (2026) or season string ("2026-27")
 * @returns {number} Total salary including likely incentives
 */
export const getSalaryForYear = (input, year) => {
  if (!year) return 0;

  // Accept a single player or an array
  const players = Array.isArray(input) ? input : [input];

  // Convert year to season string if needed
  const season = typeof year === 'string' && year.includes('-') 
    ? year 
    : yearToSeason(year);

  return players.reduce((sum, p) => {
    let base = 0;
    let likely = 0;

    // Try new schema format: contract.salariesByYear[] array
    const contract = p.contract || p.primaryContract;
    if (contract?.salariesByYear && season) {
      const yearEntry = contract.salariesByYear.find(
        (entry) => entry.season === season
      );
      if (yearEntry) {
        base = yearEntry.salary || 0;
        // Extract likely incentives from new schema
        if (yearEntry.incentives?.likely) {
          likely = yearEntry.incentives.likely;
        }
      }
    }

    // Fallback to old schema format: contract_clean.salaries_by_year object
    // Note: old schema uses end-year keys (e.g., 2025 for "2024-25" season)
    if (base === 0) {
      const numericYear = convertYearForOldSchema(year);
      if (numericYear) {
        const yData = p.contract_clean?.salaries_by_year?.[numericYear] ?? {};
        base = typeof yData.salary === 'number' ? yData.salary : 0;
        
        // Old schema likely bonus extraction
        likely =
          (typeof yData.likely_bonus === 'number' ? yData.likely_bonus : 0) ||
          (yData.bonuses?.likely ?? yData.likelyIncentives ?? 0);
      }
    }

    // Additional fallbacks
    if (base === 0) {
      const numericYear = convertYearForOldSchema(year);
      const salaryMap = p.salaryByYear?.[numericYear];
      const fallback = p.salary;
      
      base = typeof salaryMap === 'number'
        ? salaryMap
        : typeof fallback === 'number'
          ? fallback
          : 0;
    }

    // Old schema bonusesByYear fallback
    if (likely === 0) {
      const numericYear = convertYearForOldSchema(year);
      likely = p.bonusesByYear?.[numericYear]?.likely ?? 0;
    }

    return sum + base + likely;
  }, 0);
};
/****************** END SCSP™ BLOCK: getSalaryForYear ******************/

/*─────────────────────  Incoming-Salary (CBA rules)  ─────────────────────*/

// ────────────────── Incoming-Salary Ceiling (CBA tiers) ──────────────────
const allowedIncomingBelowFirstApron = (out, yearKey) => {
  const [band1, band2] = getTierThresholds(yearKey);
  const limits = [band1, band2, Infinity];
  for (let i = 0; i < MATCHING_BANDS_2023.length; i++) {
    const limit = limits[i];
    if (out <= limit || limit === Infinity) {
      return MATCHING_BANDS_2023[i].allowed(out);
    }
  }
  return out;
};
export const getIncomingCeiling = (
  teamTotalSalary,
  salaryOut,
  tradeExceptions = [],
  capSettings,
  yearKey = 2025
) => {
  // 1️⃣ Cap-space clubs can climb to the cap.
  if (teamTotalSalary < capSettings.salaryCap) {
    return capSettings.salaryCap;
  }

  // 2️⃣ Over-cap matching bands (below first apron)
  let ceiling = allowedIncomingBelowFirstApron(salaryOut, yearKey);

  // 3️⃣ Apron limiters – 100 % of outgoing
  if (teamTotalSalary >= capSettings.secondApron) {
    ceiling = salaryOut;
  } else if (teamTotalSalary >= capSettings.firstApron) {
    ceiling = salaryOut;
  }

  // 4️⃣ Add any valid TPE amounts
  const tpeValue = tradeExceptions
    .filter(
      (t) =>
        !t.expired && // legacy tests
        (!t.expirationDate || Date.parse(t.expirationDate) > Date.now()) &&
        !(
          teamTotalSalary >= capSettings.secondApron &&
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
    _incomingPlayers = [],
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

  const salary =
    player.contract_clean?.salaries_by_year?.[yearKey]?.salary || 0;

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

/*───────────────────────────────  EOF  ───────────────────────────────*/
