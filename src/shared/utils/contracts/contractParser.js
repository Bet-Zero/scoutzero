// Contract parser for normalizing and linking contract data
// Phase 0: Transform canonical contract data with extension links and max detection

import {
  normalizeSeason,
  compareSeason,
  isSeasonActive,
  isSeasonFuture,
  isSeasonExpired,
} from './seasonNormalizer.js';

/**
 * Normalize a single contract from canonical format
 * @param {Object} contract - Raw contract data
 * @param {string} playerId - Player ID
 * @param {string} currentSeason - Current season in "YYYY-YY" format
 * @param {Object} options - Options including leagueCaps
 * @returns {Object} Normalized contract
 */
function normalizeContract(contract, playerId, currentSeason, options = {}) {
  const { leagueCaps = {} } = options;

  // Normalize seasons
  const startSeason = normalizeSeason(contract.startSeason);
  const endSeason = normalizeSeason(contract.endSeason);

  // Determine kind and isExtension
  let isExtension;
  if (contract.isExtension === null || contract.isExtension === undefined) {
    // Infer extension when the block starts after the current season
    isExtension = compareSeason(startSeason, currentSeason) > 0;
  } else {
    isExtension = Boolean(contract.isExtension);
  }
  const kind = isExtension ? 'ext' : 'std';

  // Build docId
  const docId = `${kind}_${startSeason}`;

  // Normalize salariesByYear
  const salariesByYear = normalizeSalariesByYear(contract.salariesByYear || []);

  // Calculate status flags
  const status = {
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
  const freeAgency = normalizeFreeAgency(contract.freeAgency || {});

  // Build normalized contract
  return {
    docId,
    kind,
    isExtension,
    extensionOf: null, // Will be set later during linking
    extendedBy: null, // Will be set later during linking
    contractGroupId: null, // Will be set later during linking
    contractType: contract.contractType || 'VETERAN CONTRACT',
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
      provider: contract.source?.provider || 'Unknown',
      scrapedAt: contract.source?.scrapedAt || null,
    },
  };
}

/**
 * Normalize salaries by year to consistent format
 * @param {Array} salaries - Array of salary objects
 * @returns {Array} Normalized salary array
 */
function normalizeSalariesByYear(salaries) {
  return salaries.map((row) => {
    const season = normalizeSeason(row.season || row.year);
    return {
      season,
      salary: Number(row.salary) || 0,
      guaranteed: Boolean(row.guaranteed),
      option: normalizeOption(row.option),
    };
  });
}

/**
 * Normalize option values
 * @param {string|null} option - Option type
 * @returns {string|null} Normalized option
 */
function normalizeOption(option) {
  if (!option) return null;
  const opt = String(option).toUpperCase();
  if (opt.includes('PLAYER') || opt === 'PO') return 'PO';
  if (opt.includes('TEAM') || opt === 'TO') return 'TO';
  return null;
}

/**
 * Normalize free agency data
 * @param {Object} freeAgency - Free agency data
 * @returns {Object} Normalized free agency
 */
function normalizeFreeAgency(freeAgency) {
  return {
    type: freeAgency.type || freeAgency.freeAgentType || null,
    year: freeAgency.year || freeAgency.freeAgentYear || null,
    birdRights: freeAgency.birdRights?.status || freeAgency.birdRights || null,
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
 * @param {string} signedUsing - Signing method
 * @returns {string|null} Normalized signing method
 */
function normalizeSignedUsing(signedUsing) {
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
 * @param {string} signingDate - Signing date
 * @returns {string|null} ISO date or null
 */
function normalizeSigningDate(signingDate) {
  if (!signingDate) return null;

  // If already ISO format, return as is
  if (/^\d{4}-\d{2}-\d{2}/.test(signingDate)) {
    return signingDate;
  }

  // Try to parse common date formats
  try {
    const date = new Date(signingDate);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    // Ignore parse errors
  }

  return null;
}

/**
 * Detect max contract based on first-year cap percentage
 * @param {Array} salariesByYear - Normalized salary array
 * @param {string} startSeason - Start season
 * @param {Object} leagueCaps - League cap by season
 * @param {Object} contract - Original contract data (may have capPercentage)
 * @returns {Object} Max contract info
 */
function detectMaxContract(salariesByYear, startSeason, leagueCaps, contract) {
  const maxInfo = {
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
  } else if (leagueCaps[startSeason]) {
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
    if (Math.abs(maxInfo.firstYearCapPct - tier) <= tolerance) {
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
 * @param {Array} contracts - Array of normalized contracts
 * @returns {Array} Contracts with extension links set
 */
function linkExtensions(contracts) {
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

/**
 * Parse contract situation from canonical format
 * @param {Object} canonical - Canonical contract data (contract or contracts array)
 * @param {string} currentSeason - Current season in "YYYY-YY" format
 * @param {Object} options - Options including leagueCaps
 * @returns {Object} Parsed contract situation
 */
export function parseContractSituation(canonical, currentSeason, options = {}) {
  const playerId = canonical.playerId;

  // Normalize current season
  const normalizedCurrentSeason = normalizeSeason(currentSeason);

  // Determine if we have a single contract or multiple
  let rawContracts = [];

  if (canonical.contract) {
    rawContracts.push(canonical.contract);
  }

  if (canonical.futureContract) {
    rawContracts.push(canonical.futureContract);
  }

  if (canonical.contracts && Array.isArray(canonical.contracts)) {
    rawContracts = canonical.contracts;
  }

  // Normalize all contracts
  let contracts = rawContracts.map((contract) =>
    normalizeContract(contract, playerId, normalizedCurrentSeason, options)
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
