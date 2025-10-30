// normalization_helpers.ts - Contract normalization helper functions
//
// These helpers implement the contract normalization spec:
// - extractOptionInfo: Parse option fields from table cells
// - toISODate: Normalize human dates to ISO
// - computeYearGuarantee: Compute guarantees with schedules
// - applyVoidByExtension: Handle option year voiding by extensions
// - rollupContractTotals: Compute contract-level rollups (no hard-coded season constants)
// - finalizeTradeEligibility: Set trade eligibility to spec
// - applyPlayerOptionPolicy: Treat live POs as guaranteed
// - validateOptionFieldPairing: Ensure optionUsed/optionDecisionDate pairing
//
// SCSP™: full-file replacement — safe to paste over your existing file.

import * as cheerio from 'cheerio'; // (kept for consistency; not strictly required in this module)

/* ──────────────────────────────────────────────────────────────────────────────
 * Season + void helpers
 * ──────────────────────────────────────────────────────────────────────────────
 */

/** Extract the first year (YYYY) from a season string like "2025-26" or "2025-2026". */
function parseSeasonFirstYear(season: string): number {
  const m = String(season).match(/^(\d{4})\s*-/);
  if (!m) throw new Error(`Invalid season format: ${season}`);
  return Number(m[1]);
}

/** Determine the current season’s first year given an "as of" date. */
function getCurrentSeasonFirstYear(asOf: Date): number {
  // NBA season nominally starts ~October. Use Aug (7) threshold so preseason/guarantee dates work.
  const y = asOf.getUTCFullYear();
  const m = asOf.getUTCMonth(); // 0=Jan ... 11=Dec
  return m >= 7 ? y : y - 1;
}

/** Whether a salary row has been voided by an extension. */
function isRowVoided(row: { voidedByExtension?: boolean }): boolean {
  return row?.voidedByExtension === true;
}

/** Legacy utility retained (may be used by callers); prefer parseSeasonFirstYear internally. */
function seasonStartYear(season?: string): number | undefined {
  const m = season?.match(/^(\d{4})\s*-\s*\d{2}$/);
  return m ? parseInt(m[1], 10) : undefined;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Option parsing + date normalization
 * ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * Extract option information from raw cell text.
 *
 * @param rawCellText - The text from the Option or Option Used column
 * @returns { option, optionUsed, optionDecisionDate }
 */
export function extractOptionInfo(rawCellText: string): {
  option: 'PO' | 'TO' | 'ETO' | null;
  optionUsed: boolean | null;
  optionDecisionDate: string | null;
} {
  const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
  const txt = norm(rawCellText).toLowerCase();

  // Option type
  let option: 'PO' | 'TO' | 'ETO' | null = null;
  if (/\bplayer option\b|\bpo\b/.test(txt)) option = 'PO';
  else if (/\bteam option\b|\bto\b/.test(txt)) option = 'TO';
  else if (/\bearly termination\b|\beto\b/.test(txt)) option = 'ETO';

  // Parse "Option Used: Yes/No (date)" or "Yes/No (date)"
  const match = rawCellText.match(
    /(?:Option\s*Used:\s*)?(Yes|No)\s*\(([^)]+)\)/i
  );
  if (!match) {
    return { option, optionUsed: null, optionDecisionDate: null };
  }

  const optionUsed = match[1].toLowerCase() === 'yes';
  const dateStr = match[2].trim();
  const optionDecisionDate = toISODate(dateStr);

  return { option, optionUsed, optionDecisionDate };
}

/**
 * Convert human-readable date to ISO format (YYYY-MM-DD).
 * Handles e.g. "Aug 2, 2025" and "07/06/2023".
 */
export function toISODate(dateStr: string): string | null {
  if (!dateStr) return null;

  // "Aug 2, 2025"
  const monthMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (monthMatch) {
    const monthMap: Record<string, string> = {
      jan: '01',
      january: '01',
      feb: '02',
      february: '02',
      mar: '03',
      march: '03',
      apr: '04',
      april: '04',
      may: '05',
      jun: '06',
      june: '06',
      jul: '07',
      july: '07',
      aug: '08',
      august: '08',
      sep: '09',
      september: '09',
      oct: '10',
      october: '10',
      nov: '11',
      november: '11',
      dec: '12',
      december: '12',
    };
    const month = monthMap[monthMatch[1].toLowerCase()];
    if (!month) return null;
    const day = monthMatch[2].padStart(2, '0');
    const year = monthMatch[3];
    return `${year}-${month}-${day}`;
  }

  // "07/06/2023"
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const mm = slashMatch[1].padStart(2, '0');
    const dd = slashMatch[2].padStart(2, '0');
    const yyyy = slashMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Guarantees (per-year)
 * ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * Compute year-level guarantee with schedule.
 *
 * @param yearRow - The salary year row object (already carrying guaranteed + guaranteedAmount)
 * @param guaranteeSchedule - Array of guarantee triggers (if any)
 */
export function computeYearGuarantee(
  yearRow: any,
  guaranteeSchedule: Array<{
    effectiveDate: string;
    guaranteedAmount: number;
    status: string;
    note: string;
  }> | null
): {
  guaranteed: boolean;
  guaranteedAmount: number;
  guaranteeSchedule?: Array<{
    effectiveDate: string;
    guaranteedAmount: number;
    status: string;
    note: string;
  }>;
} {
  if (guaranteeSchedule && guaranteeSchedule.length > 0) {
    return {
      guaranteed: Boolean(yearRow.guaranteed),
      guaranteedAmount: Number(yearRow.guaranteedAmount || 0),
      guaranteeSchedule,
    };
  }

  return {
    guaranteed: Boolean(yearRow.guaranteed),
    guaranteedAmount: Number(yearRow.guaranteedAmount || 0),
  };
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Player option policy (live POs are treated as guaranteed)
 * ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * House rule: A live player option (option === "PO") that is still in effect
 * and NOT voided and NOT explicitly declined is treated as guaranteed.
 */
export function applyPlayerOptionPolicy(salariesByYear: any[]): void {
  for (const yearRow of salariesByYear) {
    if (
      yearRow.option === 'PO' &&
      yearRow.optionUsed === null &&
      !yearRow.voidedByExtension
    ) {
      yearRow.guaranteed = true;
      yearRow.guaranteedAmount = Number(yearRow.salary || 0);
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Option field pairing validation
 * ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * Validate optionUsed / optionDecisionDate pairing:
 * - If optionUsed is null => optionDecisionDate must be null
 * - If optionUsed is boolean (true/false) => optionDecisionDate must be ISO (non-null)
 */
export function validateOptionFieldPairing(salariesByYear: any[]): void {
  for (const yearRow of salariesByYear) {
    const used = yearRow.optionUsed;
    const date = yearRow.optionDecisionDate;

    const hasOptionUsed =
      used !== null && used !== undefined && typeof used === 'boolean';
    const hasOptionDate = date !== null && date !== undefined;

    if (!hasOptionUsed && hasOptionDate) {
      throw new Error(
        `Invalid option pairing in ${yearRow.season}: optionDecisionDate present but optionUsed is null/undefined.`
      );
    }
    if (hasOptionUsed && !hasOptionDate) {
      throw new Error(
        `Invalid option pairing in ${yearRow.season}: optionUsed=${used} requires an ISO optionDecisionDate.`
      );
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Trade eligibility (contract-level)
 * ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * Finalize trade eligibility to match spec:
 * - canBeTradedNow: null (always)
 * - restrictedUntil: null (unless parsed)
 * - reason: null (unless parsed)
 * - rules: { baseYearCompensation, poisonPill, aggregation }
 */
export function finalizeTradeEligibility(contract: any): void {
  if (!contract.tradeEligibility) {
    contract.tradeEligibility = {
      canBeTradedNow: null,
      restrictedUntil: null,
      reason: null,
      rules: {
        baseYearCompensation: false,
        poisonPill: false,
        aggregation: true,
      },
    };
    return;
  }

  // Force canBeTradedNow to null per spec
  contract.tradeEligibility.canBeTradedNow = null;

  // Ensure rules object exists with defaults
  if (!contract.tradeEligibility.rules) {
    contract.tradeEligibility.rules = {
      baseYearCompensation: false,
      poisonPill: false,
      aggregation: true,
    };
  }

  // Ensure nullable fields exist
  if (contract.tradeEligibility.restrictedUntil === undefined) {
    contract.tradeEligibility.restrictedUntil = null;
  }
  if (contract.tradeEligibility.reason === undefined) {
    contract.tradeEligibility.reason = null;
  }
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Supersession (voiding PO year when extension starts same season)
 * ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * Apply void-by-extension logic to contracts.
 *
 * - If futureContract.startSeason matches an option year on the old contract,
 *   mark that year as voided by extension.
 * - Add supersession metadata both ways.
 * - Recompute rollups for BOTH contracts (with a stable "asOf" date).
 */
export function applyVoidByExtension(
  oldContract: any,
  futureContract: any | undefined
): void {
  if (!futureContract || !oldContract?.salariesByYear) return;

  const futureStartSeason = futureContract.startSeason;
  if (!futureStartSeason) return;

  // Find the PO year in old contract that matches the future start season
  const poYear = oldContract.salariesByYear.find(
    (y: any) =>
      String(y.season) === String(futureStartSeason) && y.option === 'PO'
  );
  if (!poYear) return;

  // Determine void date: prefer existing optionDecisionDate; else signingDate; else today
  let voidedDate: string;
  if (poYear.optionDecisionDate) {
    voidedDate = poYear.optionDecisionDate;
  } else if (futureContract.signingDate) {
    const iso = toISODate(futureContract.signingDate);
    voidedDate = iso || futureContract.signingDate;
  } else {
    voidedDate = new Date().toISOString().split('T')[0];
  }

  // Mark the year as voided by the extension
  poYear.option = 'PO';
  poYear.optionUsed = false; // Player did not exercise it (voided by extension)
  poYear.optionDecisionDate = voidedDate;
  poYear.guaranteed = false;
  poYear.guaranteedAmount = 0;
  poYear.voidedByExtension = true;
  poYear.voidedOn = voidedDate;
  delete poYear.guaranteeSchedule; // never attach guarantee schedule to voided years

  // Supersession metadata
  oldContract.supersededIn = futureStartSeason;
  oldContract.supersededByContractRef =
    futureContract.contractType || 'extension';
  futureContract.supersedesContractRef = oldContract.contractType;

  // Recompute rollups with a stable "asOf" date (deterministic)
  const asOf =
    (poYear.optionDecisionDate && new Date(poYear.optionDecisionDate)) ||
    (futureContract.signingDate &&
      new Date(
        toISODate(futureContract.signingDate) ||
          (futureContract.signingDate as string)
      )) ||
    new Date();

  rollupContractTotals(oldContract, { asOf });
  rollupContractTotals(futureContract, { asOf });
}

/* ──────────────────────────────────────────────────────────────────────────────
 * Rollups (contract-level)
 * ──────────────────────────────────────────────────────────────────────────────
 */

/**
 * Compute contract-level rollup totals.
 *
 * Sets:
 * - guaranteedValue: Sum of guaranteedAmount from non-voided years
 * - guaranteedYears: Count of years with guaranteedAmount > 0 (non-voided)
 * - yearsRemaining: Count of non-voided rows whose season first-year >= currentSeasonFirstYear(asOf)
 *
 * @param contract - The contract object to update
 * @param opts     - Optional { asOf?: Date } to freeze snapshots in tests/CI
 */
export function rollupContractTotals(
  contract: any,
  opts?: { asOf?: Date }
): void {
  if (!contract?.salariesByYear) return;

  const asOf = opts?.asOf ?? new Date();
  const currentSeasonFirstYear = getCurrentSeasonFirstYear(asOf);

  // Exclude rows voided by extension
  const activeYears = contract.salariesByYear.filter(
    (y: any) => !isRowVoided(y)
  );

  // Preserve headline numbers (totalValue / averageAnnualValue / contractLength)

  // guaranteedValue: sum of guaranteedAmount on non-voided rows
  contract.guaranteedValue = activeYears.reduce(
    (sum: number, y: any) => sum + (Number(y.guaranteedAmount) || 0),
    0
  );

  // guaranteedYears: count rows with some guaranteedAmount (> 0)
  contract.guaranteedYears = activeYears.filter(
    (y: any) => (Number(y.guaranteedAmount) || 0) > 0
  ).length;

  // yearsRemaining: count non-voided rows whose season first-year is current or future
  contract.yearsRemaining = activeYears.reduce((count: number, y: any) => {
    try {
      const firstYear = parseSeasonFirstYear(String(y.season));
      return count + (firstYear >= currentSeasonFirstYear ? 1 : 0);
    } catch {
      // Skip malformed seasons safely
      return count;
    }
  }, 0);
}
