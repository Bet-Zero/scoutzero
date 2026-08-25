/**
 * FILE: src/features/architect/GMDashboard/components/SeasonAdvanceModal.helpers.ts
 * PURPOSE: Pure helper functions for SeasonAdvanceModal — extracted from SeasonAdvanceModal.tsx (Wave 4 Step 0.5).
 * OWNERSHIP: Feature: architect/GMDashboard
 */
import {
  toSeasonCode,
  toEndYear,
} from '@/features/architect/utils/seasonFormat';
import {
  processTradeExceptions,
  getTpeExpiryISO,
  type TpeLifecycleRecord,
} from '@/features/architect/utils/tpeLifecycle';
import { getTeamTpeList } from '@/features/architect/utils/persistenceContracts';
import type { OffseasonOptionDecision } from '@/features/architect/utils/offseason/resolveOffseasonTransition';
import type { DashboardOffseasonSummary } from '@/features/architect/GMDashboard/hooks/useArchitectState';
import {
  WIZARD_STEPS,
  type WizardStepValue,
  type PreAdvanceWizardStepValue,
  type PreAdvanceWizardStep,
  type SeasonAdvanceModalTeamCapSheet,
  type PlayerOptionPreviewLike,
  type ExpiringContractPreviewLike,
  type ExpiringCapHoldPreviewLike,
  type ExpiringTpePreviewLike,
  type StagedOptionDecision,
  type StagedOptionDecisionMap,
  type OrderedStagedOptionDecision,
  type BuildWorldAdvanceAftermathParams,
  type BuildSeasonAdvanceSuccessResultParams,
  type SeasonAdvanceSummary,
  type WorldAdvanceAftermath,
  type SeasonAdvanceSuccessResult,
} from './SeasonAdvanceModal.types';

const PRE_ADVANCE_STEP_LABELS: Record<PreAdvanceWizardStepValue, string> = {
  [WIZARD_STEPS.SUMMARY]: 'Review',
  [WIZARD_STEPS.OPTIONS]: 'Options',
  [WIZARD_STEPS.CONFIRMATION]: 'Confirm',
};

export function buildPreAdvanceWizardSteps(
  hasOptions: boolean
): PreAdvanceWizardStep[] {
  return [
    {
      value: WIZARD_STEPS.SUMMARY,
      label: PRE_ADVANCE_STEP_LABELS[WIZARD_STEPS.SUMMARY],
    },
    ...(hasOptions
      ? [
          {
            value: WIZARD_STEPS.OPTIONS,
            label: PRE_ADVANCE_STEP_LABELS[WIZARD_STEPS.OPTIONS],
          },
        ]
      : []),
    {
      value: WIZARD_STEPS.CONFIRMATION,
      label: PRE_ADVANCE_STEP_LABELS[WIZARD_STEPS.CONFIRMATION],
    },
  ];
}

export function getWizardNavigationState(
  currentStep: WizardStepValue,
  preAdvanceSteps: PreAdvanceWizardStep[]
): {
  currentIndex: number;
  isPreAdvanceStep: boolean;
  previousStep: PreAdvanceWizardStepValue | null;
  nextStep: PreAdvanceWizardStepValue | null;
} {
  const currentIndex = preAdvanceSteps.findIndex(
    (step) => step.value === currentStep
  );
  const isPreAdvanceStep = currentIndex !== -1;

  return {
    currentIndex,
    isPreAdvanceStep,
    previousStep:
      currentIndex > 0 ? preAdvanceSteps[currentIndex - 1].value : null,
    nextStep:
      currentIndex >= 0 && currentIndex < preAdvanceSteps.length - 1
        ? preAdvanceSteps[currentIndex + 1].value
        : null,
  };
}

export function reconcileStagedOptionDecisions(
  previous: StagedOptionDecisionMap,
  playersWithOptions: PlayerOptionPreviewLike[]
): StagedOptionDecisionMap {
  if (playersWithOptions.length === 0) {
    return {};
  }

  const next: StagedOptionDecisionMap = {};

  for (const player of playersWithOptions) {
    const previousDecision = previous[player.playerId];
    next[player.playerId] = {
      decision: previousDecision?.decision ?? null,
      optionType: player.optionType ?? undefined,
      season: player.season,
      playerName: player.playerName ?? undefined,
    };
  }

  return next;
}

export function buildOrderedStagedOptionDecisions(
  playersWithOptions: PlayerOptionPreviewLike[],
  stagedOptionDecisions: StagedOptionDecisionMap
): OrderedStagedOptionDecision[] {
  return playersWithOptions.map((player) => {
    const stagedDecision = stagedOptionDecisions[player.playerId];

    return {
      playerId: player.playerId,
      decision: stagedDecision?.decision ?? null,
      optionType:
        stagedDecision?.optionType ?? player.optionType ?? undefined,
      season: stagedDecision?.season ?? player.season,
      playerName:
        stagedDecision?.playerName ?? player.playerName ?? undefined,
    };
  });
}

export function getStagedOptionValidationError(
  hasOptions: boolean,
  orderedStagedOptionDecisions: OrderedStagedOptionDecision[]
): string | null {
  if (!hasOptions) {
    return null;
  }

  const hasUndecidedOptions = orderedStagedOptionDecisions.some(
    (decision) => !decision.decision
  );

  if (!hasUndecidedOptions) {
    return null;
  }

  return 'Please make a decision for all player/team options before proceeding.';
}

export function buildAdvanceOptionDecisions(
  playersWithOptions: PlayerOptionPreviewLike[],
  stagedOptionDecisions: StagedOptionDecisionMap,
  fallbackSeason: string
): Record<string, OffseasonOptionDecision> {
  const decisions: Record<string, OffseasonOptionDecision> = {};

  for (const player of playersWithOptions) {
    const stagedDecision = stagedOptionDecisions[player.playerId];
    if (!stagedDecision?.decision) {
      continue;
    }

    const normalizedType = String(
      stagedDecision.optionType || player.optionType || ''
    )
      .toLowerCase()
      .includes('player')
      ? 'player'
      : 'team';

    decisions[player.playerId] = {
      decision: stagedDecision.decision,
      optionType: normalizedType,
      season: stagedDecision.season || player.season || fallbackSeason,
    };
  }

  return decisions;
}

export function findPlayersWithOptions(
  teamCapSheet: SeasonAdvanceModalTeamCapSheet | null | undefined,
  targetYear: number
): PlayerOptionPreviewLike[] {
  if (!teamCapSheet?.players || !Array.isArray(teamCapSheet.players)) {
    return [];
  }

  const targetSeason = toSeasonCode(targetYear);
  const playersWithOptions: PlayerOptionPreviewLike[] = [];

  for (const player of teamCapSheet.players) {
    if (!player?.contract?.salariesByYear) continue;

    const playerId = player.player_id || player.id || player.playerId;
    if (!playerId) {
      console.warn(
        'Player missing ID fields, skipping option:',
        player.displayName || player.name
      );
      continue;
    }

    const yearEntry = player.contract.salariesByYear.find((year) => {
      const yearEnd = toEndYear(year.season);
      return yearEnd === targetYear && year.option;
    });

    if (yearEntry) {
      playersWithOptions.push({
        playerId,
        playerName: player.displayName || player.name,
        optionType: yearEntry.option,
        salary: yearEntry.salary || yearEntry.capHit || 0,
        season: targetSeason,
      });
    }
  }

  return playersWithOptions;
}

export function findExpiringContracts(
  teamCapSheet: SeasonAdvanceModalTeamCapSheet | null | undefined,
  fromYear: number
): ExpiringContractPreviewLike[] {
  if (!teamCapSheet?.players || !Array.isArray(teamCapSheet.players)) {
    return [];
  }

  const expiring: ExpiringContractPreviewLike[] = [];

  for (const player of teamCapSheet.players) {
    if (
      !player?.contract?.salariesByYear ||
      player.contract.salariesByYear.length === 0
    ) {
      continue;
    }

    const sortedYears = [...player.contract.salariesByYear].sort((a, b) => {
      return (toEndYear(a.season) || 0) - (toEndYear(b.season) || 0);
    });
    const lastYear = sortedYears[sortedYears.length - 1];
    const endYear = toEndYear(lastYear?.season);

    if (endYear === fromYear && !lastYear.option) {
      expiring.push({
        playerId: player.player_id || player.id || player.name || '',
        playerName: player.displayName || player.name,
        lastSalary: lastYear.salary || lastYear.capHit || 0,
      });
    }
  }

  return expiring;
}

export function findExpiringCapHolds(
  teamCapSheet: SeasonAdvanceModalTeamCapSheet | null | undefined,
  toYear: number
): ExpiringCapHoldPreviewLike[] {
  if (!teamCapSheet?.capHolds || !Array.isArray(teamCapSheet.capHolds)) {
    return [];
  }

  const expiringHolds: ExpiringCapHoldPreviewLike[] = [];
  const seasonStartDate = new Date(`${toYear - 1}-07-01`);

  for (const hold of teamCapSheet.capHolds) {
    if (hold.expiresOn) {
      const expireDate = new Date(hold.expiresOn);
      if (expireDate < seasonStartDate) {
        expiringHolds.push({
          playerId: hold.playerId,
          playerName: hold.playerName,
          amount: hold.amount || 0,
          type: hold.type,
        });
      }
    }
  }

  return expiringHolds;
}

export function findExpiringTPEs(
  teamCapSheet: SeasonAdvanceModalTeamCapSheet | null | undefined,
  toYear: number
): ExpiringTpePreviewLike[] {
  const tpes = getTeamTpeList(teamCapSheet ?? null) as TpeLifecycleRecord[];
  if (tpes.length === 0) {
    return [];
  }

  const toSeason = toSeasonCode(toYear);
  const { expiredTPEs = [] } = processTradeExceptions(tpes, toSeason);

  return expiredTPEs.map((tpe) => ({
    amount: tpe.amount || 0,
    date: getTpeExpiryISO(tpe as Record<string, unknown>) || '',
    source: typeof tpe.source === 'string' ? tpe.source : 'Trade Exception',
  }));
}

export function buildDashboardOffseasonSummary(
  summary: SeasonAdvanceSummary | undefined
): DashboardOffseasonSummary {
  return {
    declinedOptions: Array.isArray(summary?.declinedOptions)
      ? summary.declinedOptions.map((option) => option.playerName)
      : [],
    expiredContracts: Array.isArray(summary?.expiredContracts)
      ? summary.expiredContracts.map((contract) => contract.playerName)
      : [],
    expiredTPEs: Array.isArray(summary?.expiredTPEs)
      ? summary.expiredTPEs.map((tpe) => ({
          ...tpe,
          source:
            typeof tpe.source === 'string' ? tpe.source : null,
        }))
      : [],
    exercisedOptions: Array.isArray(summary?.exercisedOptions)
      ? summary.exercisedOptions
      : [],
    stepienUpdates: Array.isArray(summary?.stepienUpdates)
      ? summary.stepienUpdates
      : [],
  };
}

export function getCommittedTeamCapSheet(
  value: unknown
): SeasonAdvanceModalTeamCapSheet | null {
  return value && typeof value === 'object'
    ? (value as SeasonAdvanceModalTeamCapSheet)
    : null;
}

export function buildWorldAdvanceAftermath({
  committedState,
  summary,
}: BuildWorldAdvanceAftermathParams): WorldAdvanceAftermath {
  return {
    nextWorldSeason: committedState.metadata.currentSeason,
    nextViewingYear: committedState.metadata.currentYear,
    committedTeamCapSheet: getCommittedTeamCapSheet(
      committedState.focusTeamSnapshot
    ),
    offseasonSummary: buildDashboardOffseasonSummary(summary),
  };
}

export function buildSeasonAdvanceSuccessResult({
  advanceResult,
}: BuildSeasonAdvanceSuccessResultParams): SeasonAdvanceSuccessResult | null {
  const committedState = advanceResult.committedState;
  if (
    !committedState ||
    !committedState.metadata ||
    typeof committedState.metadata.currentSeason !== 'string' ||
    typeof committedState.metadata.currentYear !== 'number' ||
    !Array.isArray(committedState.metadata.lastModifiedTeams)
  ) {
    return null;
  }
  if (
    committedState.focusTeamCode &&
    getCommittedTeamCapSheet(committedState.focusTeamSnapshot) === null
  ) {
    return null;
  }
  const normalizedSummary = advanceResult.summary as
    | SeasonAdvanceSummary
    | undefined;

  return {
    success: true,
    persistenceConfirmed: advanceResult.persistenceConfirmed,
    confirmationWarning: advanceResult.confirmationError,
    toSeason: committedState.metadata.currentSeason,
    updatedTeams: committedState.metadata.lastModifiedTeams,
    summary: normalizedSummary,
    worldAdvanceAftermath: buildWorldAdvanceAftermath({
      committedState,
      summary: normalizedSummary,
    }),
  };
}

export function getSeasonAdvanceFailureMessage(
  failure: { error?: unknown } | unknown
): string {
  if (
    failure &&
    typeof failure === 'object' &&
    'error' in failure &&
    typeof failure.error === 'string'
  ) {
    return failure.error;
  }

  return failure instanceof Error ? failure.message : 'Season advance failed';
}
