/**
 * FILE: src/features/architect/utils/capLegalityValidation/signing.terms.ts
 * PURPOSE: Signing terms builders and getSigningTermsForPlayer.
 * OWNERSHIP: Feature: architect/core
 *
 * Wave 7 Step 5: Extracted from signing.ts (L478-L1175 of updated file).
 */

import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import {
  buildRuleContextForPlayerMove,
  getSalaryProfile,
} from '@/features/architect/utils/salaryEngine';
import type {
  RuleContext,
  SalaryProfile,
} from '@/features/architect/utils/salaryEngine';
import {
  getCanonicalExceptionAvailability,
  getCanonicalExceptionKeyForSigningMechanism,
} from '@/features/architect/utils/exceptions/exceptionOwnership';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import type { BuildRuleContextInput } from '@/features/architect/utils/buildRuleContext';
import type {
  MutationContract,
  MutationPlayer,
  MutationSalaryRow,
  MutationTeam,
  NormalizeSigningTermsOptions,
  SigningTerms,
} from './schema';
import { SIGNING_YEARS_LIMITS } from './constants';

function resolveSigningMechanism(
  contract: MutationContract | null | undefined,
  signedUsing: string | null | undefined
): string {
  const source = contract?.exceptionType || signedUsing;
  if (!source) return 'UNKNOWN';
  const normalized = String(source).toLowerCase().replace(/[^a-z]/g, '');
  if (['fullmle', 'ntmle', 'mle', 'full'].includes(normalized)) return 'FULL_MLE';
  if (normalized === 'tpmle' || normalized === 'taxpayermle' || normalized.includes('taxpayer')) return 'TPMLE';
  if (normalized === 'roommle' || normalized === 'rmle' || normalized.includes('room')) return 'ROOM_MLE';
  if (normalized === 'bae' || normalized === 'biannual') return 'BAE';
  if (['minimum', 'min', 'vetminimum', 'vetmin'].includes(normalized)) return 'MINIMUM';
  if (normalized === 'tenday' || normalized.includes('tenday') || normalized.includes('10day')) return 'TEN_DAY';
  return 'UNKNOWN';
}

const toFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as Record<string, unknown>).message);
  return String(error);
};

const asRecordLike = <T extends Record<string, unknown> = Record<string, unknown>>(
  value: unknown
): T | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as T;
  return null;
};

const getNormalizedContractType = (contract: MutationContract | null | undefined): string =>
  typeof contract?.contractType === 'string' ? contract.contractType.toLowerCase() : '';

// SIGNING TERMS HELPERS (Phase 4 + Phase 6 Schema)
// ==============================================================================

/**
 * @typedef {Object} SigningTerms
 * @property {'salary_engine'|'baseline'} source - Origin of terms data
 * @property {string} mechanism - Exception bucket (FULL_MLE, TPMLE, ROOM_MLE, BAE, MINIMUM, UNKNOWN)
 * @property {string|null} [rightsType] - Bird rights type (FULL_BIRD, EARLY_BIRD, NON_BIRD, CAP_SPACE, NONE, null)
 * @property {number|null} [maxYears] - Maximum contract years
 * @property {number|null} [minYears] - Minimum contract years
 * @property {number|null} [raisePercentage] - Max YoY raise percentage (e.g., 0.05 for 5%)
 * @property {number|null} [maxFirstYearSalary] - Maximum first-year salary
 * @property {number|null} [minFirstYearSalary] - Minimum first-year salary (if applicable)
 * @property {string} [notes] - Additional context/notes
 */

/**
 * Known Bird rights type values that may appear in legacy mechanism field.
 * These are used by the normalizeSigningTerms adapter to detect conflation.
 */
const BIRD_RIGHTS_KEYWORDS = [
  'Full Bird',
  'Early Bird',
  'Non-Bird',
  'Non Bird',
  'Cap Space',
  'Bird Rights',
  'bird rights',
];

/**
 * Mapping from raw Bird rights type strings to canonical rightsType values.
 */
const RIGHTS_TYPE_MAP: Record<string, string> = {
  'Full Bird': 'FULL_BIRD',
  'Full Bird Rights': 'FULL_BIRD',
  'Early Bird': 'EARLY_BIRD',
  'Early Bird Rights': 'EARLY_BIRD',
  'Non-Bird': 'NON_BIRD',
  'Non Bird': 'NON_BIRD',
  'Non-Bird Rights': 'NON_BIRD',
  'Cap Space': 'CAP_SPACE',
  'Cap Space / Rights': 'CAP_SPACE',
  None: 'NONE',
  none: 'NONE',
};

/**
 * Normalize signing terms to canonical shape (Phase 6).
 *
 * This adapter accepts ANY existing engine terms object and returns the
 * canonical SigningTerms shape with proper separation of mechanism vs rightsType.
 *
 * Rules:
 * - If the old object has `mechanism` containing Bird-rights words, move that to `rightsType`
 * - If `rightsType` is already present, use it directly
 * - The resulting `mechanism` is the exception bucket if determinable; otherwise UNKNOWN
 *
 * @param {Object} rawTerms - Raw signing terms from engine or legacy systems
 * @param {Object} [options] - Optional configuration
 * @param {string} [options.fallbackMechanism] - Fallback mechanism from signedUsing or contract.exceptionType
 * @returns {SigningTerms} Canonical signing terms
 */
export function normalizeSigningTerms(
  rawTerms: SigningTerms | null | undefined,
  options: NormalizeSigningTermsOptions = {}
): SigningTerms {
  if (!rawTerms) {
    return {
      source: 'baseline',
      mechanism: options.fallbackMechanism || 'UNKNOWN',
      rightsType: null,
      maxYears: null,
      minYears: null,
      raisePercentage: null,
      maxFirstYearSalary: null,
      minFirstYearSalary: null,
      notes: 'No terms provided',
    };
  }

  // Start with what we have
  let mechanism: string = String(rawTerms.mechanism || 'UNKNOWN');
  let rightsType: string | null = rawTerms.rightsType
    ? String(rawTerms.rightsType)
    : null;

  // Check if mechanism contains Bird rights info (legacy conflation)
  const mechanismStr = String(mechanism);
  const isBirdRightsInMechanism = BIRD_RIGHTS_KEYWORDS.some((kw) =>
    mechanismStr.toLowerCase().includes(kw.toLowerCase())
  );

  if (isBirdRightsInMechanism && !rightsType) {
    // Move Bird rights from mechanism to rightsType
    rightsType =
      RIGHTS_TYPE_MAP[mechanism] ||
      RIGHTS_TYPE_MAP[mechanismStr] ||
      'CAP_SPACE';
    // Try to recover exception bucket from other fields or use fallback
    mechanism = options.fallbackMechanism || 'UNKNOWN';
  }

  // Normalize rightsType if it's a raw string
  if (rightsType && RIGHTS_TYPE_MAP[rightsType]) {
    rightsType = RIGHTS_TYPE_MAP[rightsType];
  }

  return {
    source: String(rawTerms.source || 'baseline'),
    mechanism,
    rightsType,
    maxYears: rawTerms.maxYears ?? null,
    minYears: rawTerms.minYears ?? null,
    raisePercentage: rawTerms.raisePercentage ?? null,
    maxFirstYearSalary: rawTerms.maxFirstYearSalary ?? null,
    minFirstYearSalary: rawTerms.minFirstYearSalary ?? null,
    notes: rawTerms.notes ? String(rawTerms.notes) : undefined,
  };
}

/**
 * Determines if a signing is a "cap space" signing that should be subject to
 * cap hold validation (Phase 19).
 *
 * A cap-space signing is one that:
 * - Does NOT use an exception (mechanism is UNKNOWN)
 * - Does NOT have Bird rights (rightsType is CAP_SPACE, NONE, or null)
 *
 * These signings require the team to have actual cap room, which means
 * all cap holds must be accounted for.
 *
 * Signings using exceptions (MLE, BAE, etc.) or Bird rights are NOT
 * subject to this check as they have different cap treatment.
 *
 * @param {string} mechanism - Normalized mechanism from resolveSigningMechanism()
 * @param {string|null} rightsType - Bird rights type from normalizeSigningTerms()
 * @returns {boolean} True if this is a cap-space signing subject to cap hold check
 */
export function isCapSpaceSigning(
  mechanism: string | null | undefined,
  rightsType: string | null | undefined
) {
  // Exception signings are NOT cap-space signings
  if (mechanism && mechanism !== 'UNKNOWN') {
    return false;
  }

  // Bird rights signings are NOT cap-space signings
  if (
    rightsType &&
    ['FULL_BIRD', 'EARLY_BIRD', 'NON_BIRD'].includes(rightsType)
  ) {
    return false;
  }

  // This is a cap-space signing (no exception, no Bird rights)
  return true;
}

const DEFAULT_SIGNING_RAISE_PERCENT = 0.05;

function resolveSigningOperationType(
  contract: MutationContract | null | undefined,
  mechanism: string
) {
  const contractType = getNormalizedContractType(contract);
  if (contractType === 'two-way' || contractType === 'twoway') {
    return 'TWO_WAY_SIGNING';
  }
  if (mechanism === 'MINIMUM') {
    return 'MINIMUM_SIGNING';
  }
  if (mechanism && mechanism !== 'UNKNOWN') {
    return 'EXCEPTION_SIGNING';
  }
  return 'UFA_SIGNING';
}

function mapExceptionTypeForMechanism(mechanism: string) {
  switch (mechanism) {
    case 'FULL_MLE':
      return 'FULL_MLE';
    case 'TPMLE':
      return 'TAXPAYER_MLE';
    case 'ROOM_MLE':
      return 'ROOM_MLE';
    case 'BAE':
      return 'BAE';
    default:
      return null;
  }
}

/**
 * Build base signing terms from Salary Engine profile.
 *
 * Phase 6: Now correctly separates mechanism (exception bucket) from
 * rightsType (Bird rights classification).
 *
 * @param {Object} profile - Salary profile from engine
 * @param {string} [exceptionMechanism] - Exception bucket if known
 * @returns {SigningTerms} Signing terms with proper separation
 */
function buildBaseSigningTerms(
  profile: SalaryProfile | null | undefined,
  exceptionMechanism = 'UNKNOWN'
) {
  const birdAbilities = profile?.birdRights?.signingAbilities;
  const birdRightsType = profile?.birdRights?.type || null;
  const maxSalaryCap = profile?.maxSalary?.maxSalary ?? null;
  const maxSalaryBird = profile?.maxSalary?.maxSalaryBird ?? maxSalaryCap;

  const baseMaxFirstYear = (() => {
    if (birdAbilities?.canSignToMax && maxSalaryBird != null) {
      return maxSalaryBird;
    }
    if (birdAbilities?.maxFirstYearSalary != null) {
      return birdAbilities.maxFirstYearSalary;
    }
    return maxSalaryCap;
  })();

  // Map raw Bird rights type to canonical rightsType
  const rightsType = birdRightsType
    ? RIGHTS_TYPE_MAP[birdRightsType] || 'CAP_SPACE'
    : 'CAP_SPACE';

  return {
    maxYears: birdAbilities?.maxYears ?? 4,
    minYears: 1,
    raisePercentage:
      birdAbilities?.raisePercentage ?? DEFAULT_SIGNING_RAISE_PERCENT,
    maxFirstYearSalary: baseMaxFirstYear ?? null,
    // Phase 6: mechanism = exception bucket, rightsType = Bird rights
    mechanism: exceptionMechanism,
    rightsType,
    source: 'salary_engine',
    notes: birdRightsType
      ? `Bird rights: ${birdRightsType}`
      : 'No Bird rights data',
  };
}

/**
 * Build exception-based signing terms.
 *
 * Phase 6: Returns terms with mechanism as exception bucket (not Bird rights).
 * The rightsType should be merged from base terms.
 *
 * @param {string} mechanism - Exception bucket (FULL_MLE, TPMLE, etc.)
 * @param {Object} cap - Cap settings object
 * @returns {Partial<SigningTerms>|null} Exception terms or null if unknown mechanism
 */
function buildExceptionSigningTerms(
  mechanism: string,
  cap: RuleContext['cap'] | null | undefined
) {
  const limits =
    (
      SIGNING_YEARS_LIMITS as Record<
        string,
        { minYears: number; maxYears: number }
      >
    )[mechanism] || null;
  if (!limits) return null;

  let maxFirstYearSalary = null;
  switch (mechanism) {
    case 'FULL_MLE':
      maxFirstYearSalary = cap?.fullMLE ?? null;
      break;
    case 'TPMLE':
      maxFirstYearSalary = cap?.taxpayerMLE ?? cap?.fullMLE ?? null;
      break;
    case 'ROOM_MLE':
      maxFirstYearSalary = cap?.roomMLE ?? cap?.taxpayerMLE ?? null;
      break;
    case 'BAE':
      maxFirstYearSalary = cap?.bae ?? null;
      break;
    case 'MINIMUM':
      maxFirstYearSalary = null;
      break;
    default:
      break;
  }

  return {
    maxYears: limits.maxYears,
    minYears: limits.minYears,
    raisePercentage: DEFAULT_SIGNING_RAISE_PERCENT,
    maxFirstYearSalary,
    // Phase 6: mechanism = exception bucket (correct)
    mechanism,
    // rightsType is NOT set here - it's merged from base terms
    notes: `Exception: ${mechanism.replace(/_/g, ' ')}`,
  };
}

function buildRuleContextContract(
  contract: MutationContract | null | undefined
): BuildRuleContextInput['player']['contract'] | undefined {
  if (!contract) {
    return undefined;
  }

  const salariesByYear = Array.isArray(contract.salariesByYear)
    ? contract.salariesByYear
        .filter(
          (
            yearData
          ): yearData is MutationSalaryRow & {
            season: string;
          } =>
            typeof yearData?.season === 'string' &&
            yearData.season.trim().length > 0
        )
        .map((yearData) => ({
          season: yearData.season,
          salary:
            yearData.salary == null
              ? undefined
              : toFiniteNumber(yearData.salary, 0),
          capHit:
            yearData.capHit == null
              ? undefined
              : toFiniteNumber(yearData.capHit, 0),
          guaranteed:
            typeof yearData.guaranteed === 'boolean'
              ? yearData.guaranteed
              : undefined,
        }))
    : undefined;

  const birdRightsRecord = asRecordLike<{
    status?: unknown;
    yearsWithTeam?: unknown;
  }>(contract.birdRights);
  const birdRights = birdRightsRecord
    ? {
        status:
          typeof birdRightsRecord.status === 'string'
            ? birdRightsRecord.status
            : undefined,
        yearsWithTeam:
          birdRightsRecord.yearsWithTeam == null
            ? undefined
            : toFiniteNumber(birdRightsRecord.yearsWithTeam, 0),
      }
    : undefined;

  return {
    salariesByYear,
    endSeason:
      typeof contract.endSeason === 'string' ? contract.endSeason : undefined,
    startSeason:
      typeof contract.startSeason === 'string'
        ? contract.startSeason
        : undefined,
    isRookieScale: contract.isRookieScale === true,
    contractType:
      typeof contract.contractType === 'string'
        ? contract.contractType
        : undefined,
    birdRights,
  };
}

function buildRuleContextPlayerInput(
  player: MutationPlayer
): BuildRuleContextInput['player'] {
  const bio = asRecordLike<{
    displayName?: string;
    experience?: number | string | null;
    yearsExperience?: number | string | null;
    draftYear?: number | string | null;
    draftRound?: number | string | null;
    draftPick?: number | string | null;
  }>(player.bio);

  return {
    playerId: typeof player.playerId === 'string' ? player.playerId : undefined,
    player_id:
      typeof player.player_id === 'string' ? player.player_id : undefined,
    id: typeof player.id === 'string' ? player.id : undefined,
    displayName:
      typeof player.displayName === 'string' ? player.displayName : undefined,
    name: typeof player.name === 'string' ? player.name : undefined,
    bio: bio
      ? {
          displayName:
            typeof bio.displayName === 'string' ? bio.displayName : undefined,
          experience:
            bio.experience == null
              ? undefined
              : toFiniteNumber(bio.experience, 0),
          yearsExperience:
            bio.yearsExperience == null
              ? undefined
              : toFiniteNumber(bio.yearsExperience, 0),
          draftYear:
            bio.draftYear == null
              ? undefined
              : toFiniteNumber(bio.draftYear, 0),
          draftRound:
            bio.draftRound == null
              ? undefined
              : toFiniteNumber(bio.draftRound, 0),
          draftPick:
            bio.draftPick == null
              ? undefined
              : toFiniteNumber(bio.draftPick, 0),
        }
      : undefined,
    contract: buildRuleContextContract(player.contract),
    yearsOfService:
      player.yearsOfService == null
        ? undefined
        : toFiniteNumber(player.yearsOfService, 0),
    experience:
      player.experience == null
        ? undefined
        : toFiniteNumber(player.experience, 0),
    teamId: typeof player.teamId === 'string' ? player.teamId : undefined,
    teamCode: typeof player.teamCode === 'string' ? player.teamCode : undefined,
  };
}

function buildRuleContextTeamState(
  team: MutationTeam | null | undefined
): BuildRuleContextInput['teamState'] | undefined {
  if (!team) {
    return undefined;
  }

  const totals = team.totals || {};
  const tradeExceptions = getTeamTpeList(team)
    .map((tradeException) => {
      const id =
        tradeException && typeof tradeException.id === 'string'
          ? tradeException.id
          : null;
      const amount = toFiniteNumber(
        tradeException?.remainingAmount ??
          tradeException?.amount ??
          tradeException?.totalAmount,
        Number.NaN
      );

      if (!id || !Number.isFinite(amount)) {
        return null;
      }

      return {
        id,
        amount,
        ...(typeof tradeException.expiresOn === 'string'
          ? { expiresSeasonId: tradeException.expiresOn }
          : {}),
      };
    })
    .filter(
      (
        tradeException
      ): tradeException is NonNullable<
        NonNullable<
          NonNullable<BuildRuleContextInput['teamState']>['exceptions']
        >['tradeExceptions']
      >[number] => Boolean(tradeException)
    );

  const fullMleAvailability = getCanonicalExceptionAvailability(team, 'mle');
  const taxpayerMleAvailability = getCanonicalExceptionAvailability(
    team,
    'tpmle'
  );
  const roomMleAvailability = getCanonicalExceptionAvailability(team, 'room');
  const baeAvailability = getCanonicalExceptionAvailability(team, 'bae');

  return {
    teamId: typeof team.id === 'string' ? team.id : undefined,
    teamCode: typeof team.teamCode === 'string' ? team.teamCode : undefined,
    players: (team.players || []).map((teamPlayer) => ({
      playerId:
        typeof teamPlayer.playerId === 'string'
          ? teamPlayer.playerId
          : undefined,
      contract: buildRuleContextContract(teamPlayer.contract),
    })),
    totals: {
      totalSalary: toFiniteNumber(totals.apronTeamSalary, Number.NaN),
    },
    exceptions: {
      fullMLE: {
        available: fullMleAvailability.usable,
        remaining: fullMleAvailability.remainingAmount,
      },
      taxpayerMLE: {
        available: taxpayerMleAvailability.usable,
        remaining: taxpayerMleAvailability.remainingAmount,
      },
      roomMLE: {
        available: roomMleAvailability.usable,
        remaining: roomMleAvailability.remainingAmount,
      },
      bae: {
        available: baeAvailability.usable,
        remaining: baeAvailability.remainingAmount,
      },
      ...(tradeExceptions.length > 0 ? { tradeExceptions } : {}),
    },
  };
}

export function validateCanonicalSigningExceptionAvailability({
  team,
  contract,
  signedUsing,
}: {
  team: MutationTeam;
  contract: MutationContract | null | undefined;
  signedUsing: string | null | undefined;
}) {
  const signingMechanism = resolveSigningMechanism(contract, signedUsing);
  const exceptionKey =
    getCanonicalExceptionKeyForSigningMechanism(signingMechanism);

  if (!exceptionKey) {
    return { blocked: false, reason: null, violation: null };
  }

  const availability = getCanonicalExceptionAvailability(team, exceptionKey);
  const displayName = String(
    signedUsing || contract?.exceptionType || signingMechanism
  );

  if (!availability.present) {
    return {
      blocked: true,
      reason: `${displayName} is not present for this team`,
      violation: {
        rule: 'exception_blocked',
        message: `Cannot use ${displayName} - no canonical ${exceptionKey.toUpperCase()} owner exists for this team.`,
        severity: 'error',
      },
    };
  }

  if (!availability.enabled) {
    return {
      blocked: true,
      reason: `${displayName} is disabled for this team`,
      violation: {
        rule: 'exception_blocked',
        message: `Cannot use ${displayName} - the canonical ${exceptionKey.toUpperCase()} owner is disabled for this team.`,
        severity: 'error',
      },
    };
  }

  if (!availability.usable) {
    return {
      blocked: true,
      reason: `${displayName} has no remaining amount`,
      violation: {
        rule: 'exception_blocked',
        message: `Cannot use ${displayName} - the canonical ${exceptionKey.toUpperCase()} owner has no remaining amount.`,
        severity: 'error',
      },
    };
  }

  return { blocked: false, reason: null, violation: null };
}

function buildSigningRuleContextInput({
  team,
  player,
  contract,
  year,
  signedUsing,
}: {
  team?: MutationTeam | null;
  player: MutationPlayer;
  contract?: MutationContract | null;
  year: number;
  signedUsing?: string | null;
}): BuildRuleContextInput {
  const mechanism = resolveSigningMechanism(contract, signedUsing);

  return {
    player: buildRuleContextPlayerInput(player),
    teamState: buildRuleContextTeamState(team),
    operationType: resolveSigningOperationType(contract, mechanism),
    operationSeasonId: toSeasonCode(year),
    exceptionUsed: mapExceptionTypeForMechanism(mechanism),
    simulationDate: new Date(year - 1, 6, 15, 12, 0, 0),
  };
}

/**
 * Get signing terms from Salary Engine for a player (Phase 4 + Phase 6).
 *
 * Builds a RuleContext and merges Bird rights terms with exception guardrails
 * (matching UI buildSigningGuardrails behavior) when possible.
 *
 * Phase 6: Returns canonical SigningTerms with mechanism (exception bucket)
 * separated from rightsType (Bird rights classification).
 *
 * @param {Object} params
 * @param {Object} params.team - Team object (team state)
 * @param {Object} params.player - Player object
 * @param {Object} params.contract - Proposed contract
 * @param {number} params.year - Season end year
 * @param {string} params.signedUsing - Signing mechanism/exception
 * @returns {SigningTerms|null}
 */
export function getSigningTermsForPlayer({
  team,
  player,
  contract,
  year,
  signedUsing,
}: {
  team?: MutationTeam | null;
  player?: MutationPlayer | null;
  contract?: MutationContract | null;
  year?: number | null;
  signedUsing?: string | null;
}): SigningTerms | null {
  const mechanism = resolveSigningMechanism(contract, signedUsing);

  if (!player || !year) {
    return {
      mechanism,
      rightsType: null,
      source: 'baseline',
      notes: 'Missing player or year data',
    };
  }

  try {
    const ctx = buildRuleContextForPlayerMove(
      buildSigningRuleContextInput({
        team,
        player,
        contract,
        year,
        signedUsing,
      })
    );

    const profile = getSalaryProfile(ctx);
    if (!profile) {
      return {
        mechanism,
        rightsType: null,
        source: 'baseline',
        notes: 'Salary Engine profile unavailable',
      };
    }

    // Phase 6: Pass mechanism to buildBaseSigningTerms
    const baseTerms = buildBaseSigningTerms(profile, mechanism);
    const exceptionTerms = buildExceptionSigningTerms(mechanism, ctx.cap);

    if (exceptionTerms) {
      const notes = [baseTerms.notes, exceptionTerms.notes]
        .filter(Boolean)
        .join(' | ');
      return {
        ...baseTerms,
        ...exceptionTerms,
        // Phase 6: Preserve rightsType from baseTerms, mechanism from exceptionTerms
        rightsType: baseTerms.rightsType,
        mechanism: exceptionTerms.mechanism,
        source: 'salary_engine',
        notes,
      };
    }

    return baseTerms;
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.warn(
      '[getSigningTermsForPlayer] Failed to compute signing terms:',
      errorMessage
    );
    return {
      mechanism,
      source: 'baseline',
      notes: errorMessage || 'Salary Engine unavailable',
    };
  }
}
