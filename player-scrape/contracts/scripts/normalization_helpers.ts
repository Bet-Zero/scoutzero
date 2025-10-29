// normalization_helpers.ts - Contract normalization helper functions
//
// These helpers implement the contract normalization spec:
// - extractOptionInfo: Parse option fields from table cells
// - computeYearGuarantee: Compute guarantees with schedules
// - applyVoidByExtension: Handle option year voiding by extensions
// - rollupContractTotals: Compute contract-level rollups
// - finalizeTradeEligibility: Set trade eligibility to spec

import * as cheerio from 'cheerio';

/**
 * Extract option information from raw cell text
 * 
 * @param rawCellText - The text from the Option or Option Used column
 * @returns Object with option, optionUsed, and optionDecisionDate
 */
export function extractOptionInfo(rawCellText: string): {
  option: "PO" | "TO" | "ETO" | null;
  optionUsed: boolean | null;
  optionDecisionDate: string | null;
} {
  const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
  const txt = norm(rawCellText).toLowerCase();
  
  // Determine option type
  let option: "PO" | "TO" | "ETO" | null = null;
  if (/player option|\bpo\b/.test(txt)) option = 'PO';
  else if (/team option|\bto\b/.test(txt)) option = 'TO';
  else if (/early termination|eto/.test(txt)) option = 'ETO';
  
  // Parse "Option Used: Yes/No (date)" or just "Yes/No (date)"
  const match = rawCellText.match(/(?:Option\s+Used:\s*)?(Yes|No)\s*\(([^)]+)\)/i);
  if (!match) {
    return { option, optionUsed: null, optionDecisionDate: null };
  }
  
  const optionUsed = match[1].toLowerCase() === 'yes';
  const dateStr = match[2].trim();
  const optionDecisionDate = toISODate(dateStr);
  
  return { option, optionUsed, optionDecisionDate };
}

/**
 * Convert human-readable date to ISO format (YYYY-MM-DD)
 * Handles formats like "Aug 2, 2025" or "07/06/2023"
 */
export function toISODate(dateStr: string): string | null {
  // Parse date like "Aug 2, 2025" to ISO "2025-08-02"
  const dateMatch = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (dateMatch) {
    const monthMap: Record<string, string> = {
      jan: '01', january: '01',
      feb: '02', february: '02',
      mar: '03', march: '03',
      apr: '04', april: '04',
      may: '05',
      jun: '06', june: '06',
      jul: '07', july: '07',
      aug: '08', august: '08',
      sep: '09', september: '09',
      oct: '10', october: '10',
      nov: '11', november: '11',
      dec: '12', december: '12',
    };
    
    const month = monthMap[dateMatch[1].toLowerCase()];
    if (!month) return null;
    
    const day = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3];
    
    return `${year}-${month}-${day}`;
  }
  
  // Parse date like "07/06/2023" to ISO "2023-07-06"
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

/**
 * Compute year-level guarantee with schedule
 * 
 * @param yearRow - The salary year row object
 * @param guaranteeSchedule - Array of guarantee triggers (if any)
 * @returns Updated guarantee fields
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
  // If we have a guarantee schedule, add it to the output
  if (guaranteeSchedule && guaranteeSchedule.length > 0) {
    return {
      guaranteed: yearRow.guaranteed,
      guaranteedAmount: yearRow.guaranteedAmount,
      guaranteeSchedule: guaranteeSchedule,
    };
  }
  
  // No schedule - just return the guarantee status
  return {
    guaranteed: yearRow.guaranteed,
    guaranteedAmount: yearRow.guaranteedAmount,
  };
}

/**
 * Apply void-by-extension logic to contracts
 * 
 * This function:
 * - Finds if the future contract's startSeason matches an option year in the old contract
 * - Marks that year on the old contract as voided
 * - Adds supersession metadata
 * - Recomputes guaranteedValue, guaranteedYears, yearsRemaining for BOTH contracts
 * 
 * @param oldContract - The current contract object
 * @param futureContract - The future contract object (if exists)
 */
export function applyVoidByExtension(
  oldContract: any,
  futureContract: any | undefined
): void {
  if (!futureContract || !oldContract.salariesByYear) return;
  
  const futureStartSeason = futureContract.startSeason;
  if (!futureStartSeason) return;
  
  // Find PO year in current contract that matches future extension start
  const poYear = oldContract.salariesByYear.find(
    (y: any) => y.season === futureStartSeason && y.option === 'PO'
  );
  
  if (!poYear) return;
  
  // Parse the decision date if we have it
  let voidedDate: string;
  if (poYear.optionDecisionDate) {
    voidedDate = poYear.optionDecisionDate;
  } else if (futureContract.signingDate) {
    const converted = toISODate(futureContract.signingDate);
    voidedDate = converted || futureContract.signingDate;
  } else {
    voidedDate = new Date().toISOString().split('T')[0];
  }
  
  // Mark the PO year as voided
  poYear.option = 'PO';
  poYear.optionUsed = false; // Player option was declined
  poYear.optionDecisionDate = voidedDate;
  poYear.guaranteed = false;
  poYear.guaranteedAmount = 0;
  poYear.voidedByExtension = true;
  poYear.voidedOn = voidedDate;
  
  // DO NOT add guaranteeSchedule to voided years
  delete poYear.guaranteeSchedule;
  
  // Update current contract metadata
  oldContract.supersededIn = futureStartSeason;
  oldContract.supersededByContractRef = futureContract.contractType || 'extension';
  
  // Update future contract metadata
  futureContract.supersedesContractRef = oldContract.contractType;
  
  // Recompute rollups for both contracts
  rollupContractTotals(oldContract);
  rollupContractTotals(futureContract);
}

/**
 * Compute contract-level rollup totals
 * 
 * Sets:
 * - guaranteedValue: Sum of guaranteedAmount from non-voided years
 * - guaranteedYears: Count of years with guaranteedAmount > 0
 * - yearsRemaining: Count of non-voided years still in the future
 * 
 * @param contract - The contract object to update
 */
export function rollupContractTotals(contract: any): void {
  if (!contract.salariesByYear) return;
  
  // Filter out voided years for rollups
  const activeYears = contract.salariesByYear.filter(
    (y: any) => !y.voidedByExtension
  );
  
  // DO NOT change totalValue or averageAnnualValue - preserve headline numbers
  
  // Compute guaranteedValue (exclude voided years)
  contract.guaranteedValue = activeYears.reduce(
    (sum: number, y: any) => sum + (y.guaranteedAmount || 0),
    0
  );
  
  // Compute guaranteedYears (exclude voided years)
  contract.guaranteedYears = activeYears.filter(
    (y: any) => (y.guaranteedAmount || 0) > 0
  ).length;
  
  // Compute yearsRemaining (exclude voided years)
  const CURRENT_SEASON_START = 2025;
  const endSeason = activeYears.slice(-1)[0]?.season;
  
  if (endSeason) {
    const endYearNum = seasonStartYear(endSeason) ?? CURRENT_SEASON_START - 1;
    contract.yearsRemaining = Math.max(
      0,
      endYearNum - CURRENT_SEASON_START + 1
    );
  }
}

/**
 * Extract the start year from a season string like "2025-26"
 */
function seasonStartYear(season?: string): number | undefined {
  const m = season?.match(/^(\d{4})\s*-\s*\d{2}$/);
  return m ? parseInt(m[1], 10) : undefined;
}

/**
 * Finalize trade eligibility to match spec
 * 
 * Sets tradeEligibility to:
 * - canBeTradedNow: null (always)
 * - restrictedUntil: null (unless we have specific data)
 * - reason: null (unless we have specific data)
 * - rules: { baseYearCompensation, poisonPill, aggregation }
 * 
 * @param contract - The contract object to update
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
  
  // Ensure all required fields exist
  if (!contract.tradeEligibility.rules) {
    contract.tradeEligibility.rules = {
      baseYearCompensation: false,
      poisonPill: false,
      aggregation: true,
    };
  }
  
  // Ensure restrictedUntil and reason exist (can be null)
  if (contract.tradeEligibility.restrictedUntil === undefined) {
    contract.tradeEligibility.restrictedUntil = null;
  }
  if (contract.tradeEligibility.reason === undefined) {
    contract.tradeEligibility.reason = null;
  }
}

/**
 * Apply player option policy to salary years
 * 
 * House rule: A live player option (option === "PO") that is still in effect
 * and NOT voided and NOT explicitly declined is treated as guaranteed.
 * 
 * @param salariesByYear - Array of salary year objects
 */
export function applyPlayerOptionPolicy(salariesByYear: any[]): void {
  for (const yearRow of salariesByYear) {
    // Only apply to live POs (optionUsed=null) that are not voided by extension
    if (
      yearRow.option === 'PO' &&
      yearRow.optionUsed === null &&
      !yearRow.voidedByExtension
    ) {
      // Live player option - treat as guaranteed
      yearRow.guaranteed = true;
      yearRow.guaranteedAmount = yearRow.salary;
    }
  }
}

/**
 * Validate option field pairing
 * 
 * Requirements:
 * - If optionUsed is null, then optionDecisionDate MUST be null
 * - If optionUsed is true/false, then optionDecisionDate MUST be set to ISO date
 * 
 * @param salariesByYear - Array of salary year objects
 */
export function validateOptionFieldPairing(salariesByYear: any[]): void {
  for (const yearRow of salariesByYear) {
    const hasOptionUsed = yearRow.optionUsed !== null && yearRow.optionUsed !== undefined;
    const hasOptionDate = yearRow.optionDecisionDate !== null && yearRow.optionDecisionDate !== undefined;
    
    if (hasOptionUsed !== hasOptionDate) {
      throw new Error(
        `Invalid option field pairing in ${yearRow.season}: ` +
        `optionUsed=${yearRow.optionUsed}, optionDecisionDate=${yearRow.optionDecisionDate}. ` +
        `Both must be null or both must be set.`
      );
    }
  }
}
