/**
 * Wave 34 Step 1: Signing/offer-sheet types and preflight builders extracted
 * from useArchitectActions.helpers.ts (lines 47–509).
 */

import {
  toEndYear,
  toSeasonCode,
} from '@/features/architect/utils/seasonFormat';
import type {
  ArchitectMutationPayload,
  SignAndTradePreflightResult,
  OfferSheetPreflightResult,
  ArchitectGeneralMutationDashboardReloadTeamSnapshot,
} from '@/features/architect/utils/mutationPipeline';
import type { ReloadActiveWorldMetadataPatch } from './useArchitectState';
import type { PlayerRulesProfileInput } from '@/features/architect/types';
import type {
  LocalContract,
  LocalContractLegacySalaryInput,
  SigningDetails,
  ArchitectPlayer,
  CapHoldActionItem,
  CapSheet,
  DashboardCommittedTeamSnapshot,
} from './useArchitectActions.types';

export const ensureContractStructure = (
  contract: LocalContract | null | undefined,
  overrides: Partial<LocalContract> = {}
): LocalContract | null => {
  if (!contract) return null;

  const mutableOverrides: Partial<LocalContract> = { ...overrides };
  const startYearOverride = Number(
    mutableOverrides.startYear ?? contract.startYear ?? contract.year
  );
  delete mutableOverrides.startYear;

  // If contract already has salariesByYear array, use it directly
  if (contract.salariesByYear && Array.isArray(contract.salariesByYear)) {
    return {
      ...contract,
      ...mutableOverrides,
    };
  }

  // Legacy UI payload fallback: convert salaries[] to canonical salariesByYear[]
  const legacySalaries = contract.salaries;
  if (Array.isArray(legacySalaries) && legacySalaries.length > 0) {
    const yearsRaw = Number(contract.years) || legacySalaries.length;
    const years = Math.max(1, Math.min(yearsRaw, legacySalaries.length));
    const startYear = Number.isFinite(startYearOverride)
      ? startYearOverride
      : new Date().getFullYear();

    const salariesByYear = legacySalaries.slice(0, years).map((row, idx) => {
      const salaryRaw =
        typeof row === 'number'
          ? row
          : typeof row === 'string'
            ? Number(row)
            : Number(row?.salary);
      const salary = Number.isFinite(salaryRaw) ? Math.round(salaryRaw) : 0;
      return {
        season: toSeasonCode(startYear + idx),
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
        option: null,
        optionType: null,
        optionUsed: null,
      };
    });

    return {
      ...contract,
      ...mutableOverrides,
      salariesByYear,
    };
  }

  // If no contract data, return null
  return null;
};

export const deriveSigningMechanism = (
  contract: SigningDetails | null | undefined
): string | null => {
  const signedUsingRaw = contract?.signedUsing ?? contract?.exceptionType;
  const normalized =
    typeof signedUsingRaw === 'string' ? signedUsingRaw.trim() : '';
  if (!normalized || normalized.toLowerCase() === 'none') {
    return null;
  }
  return normalized;
};

export const MINIMUM_SIGNING_HEURISTIC = 2_200_000;

export function hasStagedScalarSigningSalaries(
  contract: SigningDetails | LocalContract | null | undefined
): contract is SigningDetails & { salaries: LocalContractLegacySalaryInput[] } {
  return Array.isArray(contract?.salaries) && contract.salaries.length > 0;
}

export function stripPrebuiltSigningRowsForAuthority(
  contract: SigningDetails | null | undefined
): LocalContract | null {
  if (!contract) {
    return null;
  }

  if (!hasStagedScalarSigningSalaries(contract)) {
    return contract as LocalContract;
  }

  const { salariesByYear: _ignoredPrebuiltRows, ...stagedContract } =
    contract as LocalContract;
  return stagedContract;
}

export function normalizeFiniteNumber(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function deriveSigningYearsOfService(
  playerObj: ArchitectPlayer,
  contract: SigningDetails | null | undefined
): number | null {
  const candidates = [
    contract?.yearsOfService,
    playerObj.yearsOfService,
    playerObj.yearsPro,
    playerObj.experience,
    playerObj.years_of_service,
    playerObj.bio?.experience,
    playerObj.bio?.yearsExperience,
    playerObj.bio?.['Years Pro'],
  ];

  for (const candidate of candidates) {
    const normalized = normalizeFiniteNumber(candidate);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

export type AuthoritativeSigningPreparationOverrides = Partial<LocalContract> & {
  contractType: string;
};

export type PreparedAuthoritativeSigningDetails = {
  actionSeasonContext: ReturnType<typeof buildActionSeasonContext>;
  architectContract: LocalContract | null;
  signedUsing: string | null;
};

export type StandardSigningMutationPayload = ArchitectMutationPayload & {
  teamCode: string;
  playerId: string;
  contract: LocalContract;
  signedUsing: string | null;
};

export type PreparedStandardSigningDetails = {
  actionSeasonContext: ReturnType<typeof buildActionSeasonContext>;
  standardSigningPayload: StandardSigningMutationPayload | null;
};

export type SignAndTradeMutationPayload = ArchitectMutationPayload & {
  teamCode: string;
  destinationTeamCode: string;
  playerId: string;
  contract: LocalContract;
  signedUsing: string | null;
  signAndTrade: true;
};

export type SignAndTradeTransactionPreparationFailure = {
  ok: false;
  message: string;
  preflightResult: SignAndTradePreflightResult;
  logContext?: Record<string, unknown>;
};

export type PreparedSignAndTradeTransactionDefinition =
  | {
      ok: true;
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>;
      mutationPayload: SignAndTradeMutationPayload;
    }
  | SignAndTradeTransactionPreparationFailure;

export type OfferSheetCreationDefinitionFailure = {
  ok: false;
  storeMessage: string;
  preflightResult: OfferSheetPreflightResult;
  logContext?: Record<string, unknown>;
};

export type OfferSheetMutationPayload = ArchitectMutationPayload & {
  teamCode: string;
  playerId: string;
  contract: LocalContract;
  signedUsing: string | null;
};

export type PreparedOfferSheetCreationDefinition =
  | {
      ok: true;
      actionSeasonContext: ReturnType<typeof buildActionSeasonContext>;
      preflightPayload: {
        offeringTeamCode: string;
        playerId: string;
        contract: LocalContract;
        offerSheetProposal?: SigningDetails['offerSheetProposal'];
      };
      mutationPayload: OfferSheetMutationPayload;
    }
  | OfferSheetCreationDefinitionFailure;

export type DashboardMutationPropagationMode = 'world-committed' | 'local-validated';
export type WorldCommittedTeamSource = 'changedTeams' | 'reload';
export const toDashboardCommittedTeamSnapshot = (
  team: ArchitectGeneralMutationDashboardReloadTeamSnapshot
): DashboardCommittedTeamSnapshot =>
  ({
    ...team,
    hardCapped:
      typeof team.hardCapped === 'boolean' ? team.hardCapped : undefined,
  }) as DashboardCommittedTeamSnapshot;

/**
 * Dashboard post-mutation propagation lane.
 * - `world-committed`: authoritative world persistence already succeeded, so
 *   visible reapply must go back through the committed-world reload/state seam.
 * - `local-validated`: no authoritative world write exists, so the validated
 *   local snapshot can be applied directly by the action layer.
 */
export type WorldCommittedTeamPropagation = {
  propagationMode: 'world-committed';
  committedTeam: DashboardCommittedTeamSnapshot;
  committedTeamSource: WorldCommittedTeamSource;
};
export type CommittedWorldReloadSeed = Pick<
  WorldCommittedTeamPropagation,
  'committedTeam' | 'committedTeamSource'
>;
export type LocalValidatedTeamPropagation = {
  propagationMode: 'local-validated';
  localValidatedTeam: CapSheet;
  localValidatedTeamSource: 'compute';
};
export type ResolvedCommittedWorldTeam = WorldCommittedTeamPropagation;
export type CommittedWorldReloadPlan = {
  committedWorldTeam: ResolvedCommittedWorldTeam;
  committedWorldMetadata: ReloadActiveWorldMetadataPatch | null;
  refreshRosterBundle: boolean;
};
export type CommittedWorldReloadResult =
  | {
      status: 'applied';
      committedWorldTeam: ResolvedCommittedWorldTeam;
    }
  | {
      status: 'stale-drop';
    };

export type WorldCommittedStandardSigningPropagation = {
  propagationMode: 'world-committed';
  reloadPlan: CommittedWorldReloadPlan;
};
export type StandardSigningResolvedState =
  | WorldCommittedStandardSigningPropagation
  | LocalValidatedTeamPropagation;

export type StandardSigningExecutionResult =
  | ({ success: true } & StandardSigningResolvedState)
  | {
      success: false;
      message: string;
    };

export type SignAndTradeExecutionResult =
  | ({ success: true } & WorldCommittedTeamPropagation)
  | {
      success: false;
      message: string;
    };

export type StandardSigningExecutionRoute = {
  mode: 'world' | 'vacuum';
  execute: (
    playerObj: ArchitectPlayer,
    actionSeasonContext: ReturnType<typeof buildActionSeasonContext>,
    standardSigningPayload: StandardSigningMutationPayload
  ) => Promise<StandardSigningExecutionResult>;
};

export type FreeAgencyWorldOnlyActionKind =
  | 'signAndTrade'
  | 'offerSheetCreation'
  | 'offerSheetLifecycle';

export type FreeAgencyWorldOnlyActionPhase = 'commit' | 'preview';

export type FreeAgencyWorldOnlyRequirement = {
  message: string;
};

export type FreeAgencyWorldOnlyRequirementTable = Record<
  FreeAgencyWorldOnlyActionKind,
  Partial<
    Record<FreeAgencyWorldOnlyActionPhase, FreeAgencyWorldOnlyRequirement>
  >
>;

export const FREE_AGENCY_WORLD_ONLY_REQUIREMENTS: FreeAgencyWorldOnlyRequirementTable =
  {
    signAndTrade: {
      commit: {
        message: 'Sign-and-trade requires an active world to commit.',
      },
      preview: {
        message: 'Sign-and-trade requires an active world to preview.',
      },
    },
    offerSheetCreation: {
      commit: {
        message: 'Offer sheet actions require an active world to commit.',
      },
      preview: {
        message: 'Offer sheet actions require an active world to preview.',
      },
    },
    offerSheetLifecycle: {
      commit: {
        message:
          'Offer-sheet lifecycle actions require an active world to commit.',
      },
    },
  };

export function isSignAndTradeTransactionPreparationFailure(
  value: PreparedSignAndTradeTransactionDefinition
): value is SignAndTradeTransactionPreparationFailure {
  return value.ok === false;
}

export function isOfferSheetCreationDefinitionFailure(
  value: PreparedOfferSheetCreationDefinition
): value is OfferSheetCreationDefinitionFailure {
  return value.ok === false;
}

export function resolveSeasonEndYear(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = toEndYear(value);
    return typeof parsed === 'number' && Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

export function deriveContractActionYear(
  contract: Partial<LocalContract> | null | undefined,
  fallbackYear: number
): number {
  const salaryRows = Array.isArray(contract?.salariesByYear)
    ? contract.salariesByYear
    : [];
  const firstSeasonValue = salaryRows.find(
    (row) => row?.season != null
  )?.season;
  const fromSeasonRow = resolveSeasonEndYear(firstSeasonValue);

  if (fromSeasonRow !== null) {
    return fromSeasonRow;
  }

  const fromStartYear = resolveSeasonEndYear(
    contract?.startYear ?? contract?.year
  );
  return fromStartYear ?? fallbackYear;
}

export function buildActionSeasonContext(
  contract: Partial<LocalContract> | null | undefined,
  fallbackYear: number
) {
  const actionYear = deriveContractActionYear(contract, fallbackYear);
  return {
    actionYear,
    seasonId: toSeasonCode(actionYear),
  };
}

export function buildBlockedSignAndTradePreflightResult(
  message: string
): SignAndTradePreflightResult {
  return {
    status: 'blocked',
    reasons: [message],
    warnings: [],
    source: 'authoritative-preflight',
  };
}

export function buildOfferSheetPreflightResult(
  status: OfferSheetPreflightResult['status'],
  message: string
): OfferSheetPreflightResult {
  return {
    status,
    reasons: [message],
    warnings: [],
    source: 'authoritative-preflight',
  };
}

export function buildSignAndTradeTransactionPreparationFailure(
  message: string,
  logContext?: Record<string, unknown>
): SignAndTradeTransactionPreparationFailure {
  return {
    ok: false,
    message,
    preflightResult: buildBlockedSignAndTradePreflightResult(message),
    logContext,
  };
}

export function buildOfferSheetCreationDefinitionFailure(
  preflightStatus: OfferSheetPreflightResult['status'],
  preflightMessage: string,
  storeMessage: string,
  logContext?: Record<string, unknown>
): OfferSheetCreationDefinitionFailure {
  return {
    ok: false,
    storeMessage,
    preflightResult: buildOfferSheetPreflightResult(
      preflightStatus,
      preflightMessage
    ),
    logContext,
  };
}

export function buildYearSeasonContext(year: unknown, fallbackYear: number) {
  const actionYear = resolveSeasonEndYear(year) ?? fallbackYear;
  return {
    actionYear,
    seasonId: toSeasonCode(actionYear),
  };
}

export function getFreeAgencyWorldOnlyRequirement(
  kind: FreeAgencyWorldOnlyActionKind,
  phase: FreeAgencyWorldOnlyActionPhase
): FreeAgencyWorldOnlyRequirement {
  const requirement = FREE_AGENCY_WORLD_ONLY_REQUIREMENTS[kind]?.[phase];
  if (!requirement) {
    throw new Error(
      `Missing Free Agency world-only requirement for ${kind}:${phase}`
    );
  }
  return requirement;
}

export const OFFER_SHEET_WORLD_REQUIRED_MESSAGE = getFreeAgencyWorldOnlyRequirement(
  'offerSheetLifecycle',
  'commit'
).message;

export type RenounceActionTarget =
  | PlayerRulesProfileInput
  | ArchitectPlayer
  | CapHoldActionItem;
