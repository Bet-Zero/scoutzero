// Contract parser for normalizing and linking contract data
// Phase 0: Transform canonical contract data with extension links and max detection

import {
  normalizeSeason,
  compareSeason,
  isSeasonActive,
  isSeasonFuture,
  isSeasonExpired,
} from './seasonNormalizer';
import { canonicalizeOptionType } from './optionType';

// ---------------------------------------------------------------------------
// Local types — output-shape interfaces for normalized contract data
// ---------------------------------------------------------------------------

/** Permissive record for unstructured upstream contract data */
type ContractParserRecord = Record<string, unknown>;

/** Season input accepted by this parser (mirrors seasonNormalizer's local type) */
type SeasonInputLike = string | number | null | undefined;

/** A single normalized salary row produced by normalizeSalariesByYear */
interface NormalizedSalaryRow {
  season: string | null;
  salary: number;
  guaranteed: boolean;
  option: 'PO' | 'TO' | 'ETO' | null;
}

/** Free agency block from normalizeFreeAgency */
interface NormalizedFreeAgency {
  type: unknown;
  year: unknown;
  birdRights: unknown;
  capHold: number | null;
  qualifyingOffer: number | null;
}

/** Max contract detection result from detectMaxContract */
interface MaxContractInfo {
  isMax: boolean;
  firstYearCapPct: number | null;
  tierPercent: number | null;
  capSeason: string | null;
  basis: string;
  notes: string | null;
}

/** Contract status flags */
interface ContractStatus {
  isActive: boolean;
  isFuture: boolean;
  isExpired: boolean;
}

/** Source metadata */
interface ContractSource {
  provider: string;
  scrapedAt: unknown;
}

/** A single fully normalized contract (return of normalizeContract) */
interface NormalizedContract {
  docId: string;
  kind: 'std' | 'ext';
  isExtension: boolean;
  extensionOf: string | null;
  extendedBy: string | null;
  contractGroupId: string | null;
  contractType: string;
  contractLength: number;
  startSeason: string | null;
  endSeason: string | null;
  totalValue: number;
  averageAnnualValue: number;
  guaranteedValue: number;
  guaranteedYears: number;
  signedUsing: string | null;
  signingDate: string | null;
  noTradeClause: boolean;
  tradeKicker: number | null;
  salariesByYear: NormalizedSalaryRow[];
  freeAgency: NormalizedFreeAgency;
  status: ContractStatus;
  max: MaxContractInfo;
  source: ContractSource;
}

/** Result of parseContractSituation (the sole export) */
export interface ParsedContractSituation {
  playerId: unknown;
  currentSeason: string | null;
  contracts: NormalizedContract[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a single contract from canonical format
 */
function normalizeContract(
  contract: ContractParserRecord,
  playerId: unknown,
  currentSeason: SeasonInputLike,
  options: ContractParserRecord = {}
): NormalizedContract {
  const leagueCaps = (options.leagueCaps ?? {}) as ContractParserRecord;

  // Normalize seasons
  const startSeason = normalizeSeason(contract.startSeason as SeasonInputLike);
  const endSeason = normalizeSeason(contract.endSeason as SeasonInputLike);

  // Determine kind and isExtension
  let isExtension;
  if (contract.isExtension === null || contract.isExtension === undefined) {
    // Infer extension when the block starts after the current season
    isExtension = compareSeason(startSeason, currentSeason) > 0;
  } else {
    isExtension = Boolean(contract.isExtension);
  }
  const kind: 'std' | 'ext' = isExtension ? 'ext' : 'std';

  // Build docId
  const docId = `${kind}_${startSeason}`;

  // Normalize salariesByYear
  const salariesByYear = normalizeSalariesByYear(
    (contract.salariesByYear as unknown[]) || []
  );

  // Calculate status flags
  const status: ContractStatus = {
    isActive: isSeasonActive(startSeason, endSeason, currentSeason),
    isFuture: isSeasonFuture(startSeason, currentSeason),
    isExpired: isSeasonExpired(endSeason, currentSeason),
  };

  // Detect max contract
  const max = detectMaxContract(
    salariesByYear,
    startSeason,
    leagueCaps,
    contract
  );

  // Normalize free agency
  const freeAgency = normalizeFreeAgency(
    (contract.freeAgency as ContractParserRecord) || {}
  );

  const source = contract.source as ContractParserRecord | null | undefined;

  // Build normalized contract
  return {
    docId,
    kind,
    isExtension,
    extensionOf: null, // Will be set later during linking
    extendedBy: null, // Will be set later during linking
    contractGroupId: null, // Will be set later during linking
    contractType: (contract.contractType as string) || 'VETERAN CONTRACT',
    contractLength: Number(contract.contractLength) || 0,
    startSeason,
    endSeason,
    totalValue: Number(contract.totalValue) || 0,
    averageAnnualValue: Number(contract.averageAnnualValue) || 0,
    guaranteedValue: Number(contract.guaranteedValue) || 0,
    guaranteedYears: Number(contract.guaranteedYears) || 0,
    signedUsing: normalizeSignedUsing(contract.signedUsing),
    signingDate: normalizeSigningDate(contract.signingDate),
    noTradeClause: Boolean(contract.noTradeClause),
    tradeKicker:
      contract.tradeKicker !== null && contract.tradeKicker !== undefined
        ? Number(contract.tradeKicker)
        : null,
    salariesByYear,
    freeAgency,
    status,
    max,
    source: {
      provider: (source?.provider as string) || 'Unknown',
      scrapedAt: source?.scrapedAt ?? null,
    },
  };
}

/**
 * Normalize salaries by year to consistent format
 */
function normalizeSalariesByYear(salaries: unknown[]): NormalizedSalaryRow[] {
  return salaries.map((raw) => {
    const row = raw as ContractParserRecord;
    const season = normalizeSeason(
      (row.season as SeasonInputLike) ?? (row.year as SeasonInputLike)
    );
    return {
      season,
      salary: Number(row.salary) || 0,
      guaranteed: Boolean(row.guaranteed),
      option: normalizeOption(row.option),
    };
  });
}

/**
 * Normalize option values to the canonical short code ('PO' | 'TO' | 'ETO' | null).
 * Delegates to the shared canonicalizer so the parser and the cap-legality
 * validators agree on one format. Preserves ETO (was previously dropped to null).
 */
function normalizeOption(option: unknown): 'PO' | 'TO' | 'ETO' | null {
  return canonicalizeOptionType(option);
}

/**
 * Normalize free agency data
 */
function normalizeFreeAgency(
  freeAgency: ContractParserRecord
): NormalizedFreeAgency {
  const birdRightsVal = freeAgency.birdRights;
  const birdRightsObj =
    birdRightsVal && typeof birdRightsVal === 'object'
      ? (birdRightsVal as ContractParserRecord)
      : null;

  return {
    type: freeAgency.type || freeAgency.freeAgentType || null,
    year: freeAgency.year || freeAgency.freeAgentYear || null,
    birdRights: birdRightsObj?.status ?? birdRightsVal ?? null,
    capHold:
      freeAgency.capHold !== null && freeAgency.capHold !== undefined
        ? Number(freeAgency.capHold)
        : null,
    qualifyingOffer:
      freeAgency.qualifyingOffer !== null &&
      freeAgency.qualifyingOffer !== undefined
        ? Number(freeAgency.qualifyingOffer)
        : null,
  };
}

/**
 * Normalize signedUsing field
 */
function normalizeSignedUsing(signedUsing: unknown): string | null {
  if (!signedUsing) return null;

  const str = String(signedUsing).trim();

  // Normalize common variations
  if (str.toLowerCase().includes('bird')) {
    if (str.toLowerCase().includes('early')) return 'Early Bird Exception';
    return 'Bird Exception';
  }
  if (str.toLowerCase().includes('mle')) return 'Mid-Level Exception';
  if (str.toLowerCase().includes('mid-level')) return 'Mid-Level Exception';

  return str;
}

/**
 * Normalize signing date to ISO format
 */
function normalizeSigningDate(signingDate: unknown): string | null {
  if (!signingDate) return null;

  const str = String(signingDate);

  // If already ISO format, return as is
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str;
  }

  // Try to parse common date formats
  try {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (parseError) {
    console.error(
      'Date parse error in normalizeSigningDate:',
      signingDate,
      parseError
    );
    // Ignore parse errors
  }

  return null;
}

/**
 * Detect max contract based on first-year cap percentage
 */
function detectMaxContract(
  salariesByYear: NormalizedSalaryRow[],
  startSeason: string | null,
  leagueCaps: ContractParserRecord,
  contract: ContractParserRecord
): MaxContractInfo {
  const maxInfo: MaxContractInfo = {
    isMax: false,
    firstYearCapPct: null,
    tierPercent: null,
    capSeason: startSeason,
    basis: 'unknown',
    notes: null,
  };

  // Find first year salary
  const firstRow = salariesByYear.find((row) => row.season === startSeason);
  if (!firstRow || !firstRow.salary) {
    return maxInfo;
  }

  // Try to get cap percentage from source
  if (contract.capPercentage !== null && contract.capPercentage !== undefined) {
    maxInfo.firstYearCapPct = Number(contract.capPercentage);
    maxInfo.basis = 'source_estimate';
  } else if (startSeason && leagueCaps[startSeason]) {
    // Compute from league cap
    const cap = Number(leagueCaps[startSeason]);
    maxInfo.firstYearCapPct = (firstRow.salary / cap) * 100;
    maxInfo.basis = 'computed';
  } else {
    // No cap info available
    return maxInfo;
  }

  // Snap to tier if within tolerance
  const tolerance = 0.75; // ±0.75%
  const tiers = [25, 30, 35];

  for (const tier of tiers) {
    if (
      maxInfo.firstYearCapPct !== null &&
      Math.abs(maxInfo.firstYearCapPct - tier) <= tolerance
    ) {
      maxInfo.isMax = true;
      maxInfo.tierPercent = tier;
      maxInfo.notes = 'Snapped within ±0.75%';
      break;
    }
  }

  return maxInfo;
}

/**
 * Link extensions between contracts
 */
function linkExtensions(contracts: NormalizedContract[]): NormalizedContract[] {
  // Sort by start season
  const sorted = [...contracts].sort((a, b) =>
    compareSeason(a.startSeason, b.startSeason)
  );

  // Find standard and extension pairs
  for (let i = 0; i < sorted.length; i++) {
    const contract = sorted[i];

    if (contract.isExtension && i > 0) {
      // Link to previous standard contract
      const prevContract = sorted[i - 1];
      if (!prevContract.isExtension) {
        contract.extensionOf = prevContract.docId;
        prevContract.extendedBy = contract.docId;

        // Set contract group ID to first standard contract's docId
        const groupId = prevContract.docId;
        contract.contractGroupId = groupId;
        prevContract.contractGroupId = groupId;
      }
    }
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse contract situation from canonical format
 */
export function parseContractSituation(
  canonical: ContractParserRecord,
  currentSeason: SeasonInputLike,
  options: ContractParserRecord = {}
): ParsedContractSituation {
  const playerId = canonical.playerId;

  // Normalize current season
  const normalizedCurrentSeason = normalizeSeason(currentSeason);

  // Determine if we have a single contract or multiple
  let rawContracts: unknown[] = [];

  if (canonical.contract) {
    rawContracts.push(canonical.contract);
  }

  if (canonical.futureContract) {
    rawContracts.push(canonical.futureContract);
  }

  if (canonical.contracts && Array.isArray(canonical.contracts)) {
    rawContracts = canonical.contracts as unknown[];
  }

  // Normalize all contracts
  let contracts = rawContracts.map((contract) =>
    normalizeContract(
      contract as ContractParserRecord,
      playerId,
      normalizedCurrentSeason,
      options
    )
  );

  // Link extensions
  contracts = linkExtensions(contracts);

  // Sort by start season
  contracts.sort((a, b) => compareSeason(a.startSeason, b.startSeason));

  return {
    playerId,
    currentSeason: normalizedCurrentSeason,
    contracts,
  };
}
