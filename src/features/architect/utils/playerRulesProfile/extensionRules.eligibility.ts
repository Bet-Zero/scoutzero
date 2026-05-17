/**
 * Wave 39 Step 1: Types, constants, and eligibility functions extracted from
 * extensionRules.ts (lines 29–422 + date utilities from 679–742).
 *
 * Contains all Loose* type definitions, EXTENSION_TYPES, RAISE_PERCENTAGES,
 * computeExtensionEligibility, and the private eligibility + date helpers it delegates to.
 */

import { checkSupermaxEligibility } from './maxSalaryRules';
import { parseSeasonEndYear } from '../seasonUtils';

// ============================================================
// Exported types
// ============================================================

export type ExtensionSalaryEntryLike = {
  season?: string | null;
  salary?: number | null;
  capHit?: number | null;
};

export type ExtensionContractLike = {
  contractType?: string | null;
  isRookieScale?: boolean | null;
  originalLength?: number | null;
  contractLength?: number | null;
  yearsRemaining?: number | null;
  startSeason?: string | null;
  endSeason?: string | null;
  signingDate?: string | null;
  salariesByYear?: ExtensionSalaryEntryLike[] | null;
  birdRights?: {
    status?: string | null;
    yearsWithTeam?: number | null;
  } | null;
};

export type ExtensionPlayerLike = {
  playerId?: string | null;
  bio?: {
    experience?: unknown;
    draftYear?: number | string | null;
  } | null;
  draftYear?: number | string | null;
  contract?: ExtensionContractLike | null;
  awards?: Array<Record<string, unknown>> | null;
  usedETO?: boolean | null;
  lastRenegotiatedDate?: string | null;
  lastTradedDate?: string | null;
  signingDate?: string | null;
};

export type ExtensionLeagueContextLike = {
  currentSeason?: string | null;
  currentYear?: number | null;
  simulationDate?: Date | null;
  capSettings?: {
    salaryCap?: number | null;
    averageSalary?: number | null;
  } | null;
};

export type ExtensionRuleContextLike = {
  timing?: {
    operationDate?: Date | null;
    operationSeasonId?: string | null;
    referenceSeasonId?: string | null;
  } | null;
  player?: {
    playerId?: string | null;
    isRookieScale?: boolean | null;
    draftInfo?: { year?: number | null } | null;
    contractEndSeasonId?: string | null;
    originalContractLength?: number | null;
    contractYearsRemaining?: number | null;
    yearsOfServiceAtOperation?: number | null;
    priorSeasonSalary?: number | null;
    currentSeasonSalary?: number | null;
    birdTypeAtOperation?: string | null;
    awards?: unknown[] | null;
    lastTradedDate?: string | null;
    signingDate?: string | null;
  } | null;
  cap?: {
    salaryCap?: number | null;
    averagePlayerSalary?: number | null;
  } | null;
};

export type ExtensionEligibilityInfo = {
  isEligible: boolean;
  reason: string;
  blockers: string[];
  extensionType: string;
  eligibleDate?: Date | null;
};

export type ExtensionTermsInfo = {
  maxYears: number;
  maxFirstYearSalary: number;
  minFirstYearSalary: number | null;
  raisePercentage: number;
  extensionType: string;
  basedOn: string;
  notes: string;
};

export type ExtensionProfile = {
  eligibility: ExtensionEligibilityInfo;
  terms: ExtensionTermsInfo | null;
};

// ============================================================
// Constants
// ============================================================

export const EXTENSION_TYPES = {
  ROOKIE: 'Rookie Scale Extension',
  VETERAN: 'Veteran Extension',
  DESIGNATED_VETERAN: 'Designated Veteran Extension',
  TRADE_RESTRICTED: 'Trade-Restricted Extension',
  INELIGIBLE: 'Not Eligible',
};

export const RAISE_PERCENTAGES = {
  standard: 0.08, // 8% for Bird rights
  nonBird: 0.05, // 5% for non-Bird
  trade: 0.05, // 5% for trade extensions
};

// ============================================================
// Exported: main eligibility entry point
// ============================================================

export function computeExtensionEligibility(
  player: ExtensionPlayerLike | null | undefined,
  leagueContext?: ExtensionLeagueContextLike | null
): ExtensionEligibilityInfo {
  const currentYear = leagueContext?.currentYear || new Date().getFullYear();
  const simulationDate = leagueContext?.simulationDate || new Date();
  const contract = player?.contract;

  const blockers: string[] = [];

  if (!contract) {
    return {
      isEligible: false,
      reason: 'No active contract',
      blockers: ['No contract data available'],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  if (
    contract.contractType === 'TwoWay' ||
    contract.contractType === 'Two-Way'
  ) {
    return {
      isEligible: false,
      reason: 'Two-way contracts cannot be extended',
      blockers: ['Two-way contract'],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  if (player?.usedETO) {
    return {
      isEligible: false,
      reason: 'Cannot extend contract after using Early Termination Option',
      blockers: ['Used Early Termination Option'],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  if (player?.lastRenegotiatedDate) {
    const renegotiatedDate = new Date(player.lastRenegotiatedDate);
    const monthsSinceRenegotiation = getMonthsBetween(
      renegotiatedDate,
      simulationDate
    );
    if (monthsSinceRenegotiation < 36) {
      const monthsRemaining = 36 - monthsSinceRenegotiation;
      blockers.push(
        `Must wait ${Math.ceil(monthsRemaining)} more months after renegotiation`
      );
    }
  }

  if (player?.lastTradedDate) {
    const tradedDate = new Date(player.lastTradedDate);
    const monthsSinceTrade = getMonthsBetween(tradedDate, simulationDate);
    if (monthsSinceTrade < 6) {
      const monthsRemaining = 6 - monthsSinceTrade;
      blockers.push(
        `Cannot extend within ${Math.ceil(monthsRemaining)} months of being traded`
      );
    }
  }

  if (
    contract.isRookieScale ||
    contract.contractType === 'Rookie Scale'
  ) {
    return computeRookieExtensionEligibility(
      player,
      contract,
      currentYear,
      blockers
    );
  }

  return computeVeteranExtensionEligibility(
    player,
    contract,
    currentYear,
    simulationDate,
    blockers
  );
}

// ============================================================
// Private eligibility helpers
// ============================================================

function computeRookieExtensionEligibility(
  player: ExtensionPlayerLike | null | undefined,
  contract: ExtensionContractLike,
  currentYear: number,
  blockers: string[]
): ExtensionEligibilityInfo {
  const draftYear = player?.bio?.draftYear || player?.draftYear;

  if (!draftYear) {
    return {
      isEligible: false,
      reason: 'Cannot determine draft year for rookie extension timing',
      blockers: [...blockers, 'Missing draft year'],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  const draftYearNum = parseInt(String(draftYear), 10);
  const extensionYear = draftYearNum + 4;

  if (currentYear < extensionYear) {
    const yearsUntilEligible = extensionYear - currentYear;
    return {
      isEligible: false,
      reason: `Rookie extensions available starting ${extensionYear - 1}-${String(extensionYear).slice(-2)} season (${yearsUntilEligible} year${yearsUntilEligible > 1 ? 's' : ''} away)`,
      blockers: [...blockers, 'Not yet in extension window'],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
      eligibleDate: new Date(extensionYear - 1, 6, 1),
    };
  }

  if (currentYear > extensionYear) {
    return {
      isEligible: false,
      reason: 'Rookie extension window has passed',
      blockers: [...blockers, 'Extension window closed'],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  if (blockers.length > 0) {
    return {
      isEligible: false,
      reason: `Blocked: ${blockers.join('; ')}`,
      blockers,
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  return {
    isEligible: true,
    reason: 'Eligible for rookie scale extension',
    blockers: [],
    extensionType: EXTENSION_TYPES.ROOKIE,
  };
}

function computeVeteranExtensionEligibility(
  player: ExtensionPlayerLike | null | undefined,
  contract: ExtensionContractLike,
  currentYear: number,
  simulationDate: Date,
  blockers: string[]
): ExtensionEligibilityInfo {
  const originalLength = contract.originalLength || contract.contractLength || 0;
  const yearsElapsed = computeYearsElapsed(contract, currentYear);

  let requiredYears;
  if (originalLength <= 2) {
    return {
      isEligible: false,
      reason: 'Contract must be 3+ years to be eligible for extension',
      blockers: [...blockers, `Contract length (${originalLength} years) too short`],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  } else if (originalLength <= 4) {
    requiredYears = 2;
  } else {
    requiredYears = 3;
  }

  if (yearsElapsed < requiredYears) {
    const yearsRemaining = requiredYears - yearsElapsed;
    const eligibleDate = computeExtensionEligibleDate(contract, requiredYears);
    return {
      isEligible: false,
      reason: `Must wait ${yearsRemaining} more year${yearsRemaining > 1 ? 's' : ''} - ${originalLength}-year contract requires ${requiredYears} years before extension`,
      blockers: [
        ...blockers,
        `Only ${yearsElapsed} of ${requiredYears} required years elapsed`,
      ],
      extensionType: EXTENSION_TYPES.INELIGIBLE,
      eligibleDate,
    };
  }

  if (blockers.length > 0) {
    return {
      isEligible: false,
      reason: `Blocked: ${blockers.join('; ')}`,
      blockers,
      extensionType: EXTENSION_TYPES.INELIGIBLE,
    };
  }

  if (player?.lastTradedDate) {
    const tradedDate = new Date(player.lastTradedDate);
    const yearsSinceTrade = getMonthsBetween(tradedDate, simulationDate) / 12;
    if (yearsSinceTrade < 1) {
      return {
        isEligible: true,
        reason: 'Eligible for trade-restricted extension (reduced terms)',
        blockers: [],
        extensionType: EXTENSION_TYPES.TRADE_RESTRICTED,
      };
    }
  }

  const supermaxCheck = checkSupermaxEligibility(player, { currentYear });
  if (supermaxCheck.isEligible && !supermaxCheck.isRookieExtensionBoost) {
    return {
      isEligible: true,
      reason: 'Eligible for Designated Veteran Extension (supermax)',
      blockers: [],
      extensionType: EXTENSION_TYPES.DESIGNATED_VETERAN,
    };
  }

  return {
    isEligible: true,
    reason: 'Eligible for veteran extension',
    blockers: [],
    extensionType: EXTENSION_TYPES.VETERAN,
  };
}

// ============================================================
// Private date utilities
// ============================================================

function computeYearsElapsed(
  contract: ExtensionContractLike | null | undefined,
  currentYear: number
): number {
  if (!contract) return 0;

  if (contract.startSeason) {
    const startYear = parseSeasonEndYear(contract.startSeason);
    if (startYear) {
      return currentYear - startYear;
    }
  }

  if (contract.signingDate) {
    const signedYear = new Date(contract.signingDate).getFullYear();
    const signedMonth = new Date(contract.signingDate).getMonth();
    const effectiveStartYear = signedMonth >= 6 ? signedYear + 1 : signedYear;
    return currentYear - effectiveStartYear;
  }

  if (contract.contractLength && contract.yearsRemaining) {
    return contract.contractLength - contract.yearsRemaining;
  }

  return 0;
}

function computeExtensionEligibleDate(
  contract: ExtensionContractLike | null | undefined,
  requiredYears: number
): Date | null {
  if (!contract?.signingDate) return null;

  const signedDate = new Date(contract.signingDate);
  const eligibleDate = new Date(signedDate);
  eligibleDate.setFullYear(eligibleDate.getFullYear() + requiredYears);

  return eligibleDate;
}

function getMonthsBetween(startDate: Date, endDate: Date): number {
  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  return Math.max(0, months);
}
