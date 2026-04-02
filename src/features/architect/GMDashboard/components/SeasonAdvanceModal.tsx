/**
 * FILE: src/features/architect/GMDashboard/components/SeasonAdvanceModal.tsx
 * PURPOSE: Modal/wizard for advancing seasons in Architect GMDashboard
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-20: Created for Phase 3B implementation per ARCHITECT_GAP_ANALYSIS.md
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
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
import type {
  OffseasonAppliedChangesSummary,
  OffseasonOptionDecision,
} from '@/features/architect/utils/offseason/resolveOffseasonTransition';
import type { TeamTpeLike } from '@/features/architect/utils/persistenceContracts/normalizeTeamTpe';

const WIZARD_STEPS = {
  SUMMARY: 'summary',
  OPTIONS: 'options',
  CONFIRMATION: 'confirmation',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
} as const;

type WizardStepValue = (typeof WIZARD_STEPS)[keyof typeof WIZARD_STEPS];
type AdvanceSeasonInWorld = typeof import('@/features/architect/utils/seasonManager').advanceSeasonInWorld;
type AdvanceSeasonResult = Awaited<ReturnType<AdvanceSeasonInWorld>>;
type SeasonAdvanceSummary = AdvanceSeasonResult extends {
  summary?: infer Summary;
}
  ? Summary
  : never;
type SeasonAdvanceResult = {
  summary?: SeasonAdvanceSummary;
  updatedTeams?: string[];
  toSeason?: string;
  error?: string;
  success?: boolean;
};
type SeasonAdvanceModalTeamCapSheet = TeamCapSheetLike & TeamTpeLike;

type SalaryByYearLike = {
  season?: string | null;
  option?: string | null;
  salary?: number | null;
  capHit?: number | null;
  guaranteed?: boolean;
};

type ContractLike = {
  salariesByYear?: SalaryByYearLike[] | null;
};

type PlayerLike = {
  player_id?: string | null;
  playerId?: string | null;
  id?: string | null;
  name?: string | null;
  displayName?: string | null;
  contract?: ContractLike | null;
};

type CapHoldLike = {
  playerId?: string | null;
  playerName?: string | null;
  amount?: number | null;
  type?: string | null;
  expiresOn?: string | null;
};

type TeamCapSheetLike = {
  players?: PlayerLike[] | null;
  capHolds?: CapHoldLike[] | null;
};

type PlayerOptionPreviewLike = {
  playerId: string;
  playerName?: string | null;
  optionType?: string | null;
  salary: number;
  season: string;
};

type ExpiringContractPreviewLike = {
  playerId: string;
  playerName?: string | null;
  lastSalary: number;
};

type ExpiringCapHoldPreviewLike = {
  playerId?: string | null;
  playerName?: string | null;
  amount: number;
  type?: string | null;
};

type ExpiringTpePreviewLike = {
  amount: number;
  date: string;
  source?: string | null;
};

type PendingOptionDecision = Omit<OffseasonOptionDecision, 'decision'> & {
  decision?: OffseasonOptionDecision['decision'] | null;
  playerName?: string | null;
};

type OptionDecisionMap = Record<string, PendingOptionDecision>;

type SeasonAdvanceModalProps = {
  isOpen: boolean;
  onClose: () => void;
  teamCapSheet?: SeasonAdvanceModalTeamCapSheet | null;
  authoritativeSeasonEndYear: number;
  worldId?: string | null;
  teamCode?: string | null;
  onWorldAdvanceComplete?: ((result: SeasonAdvanceResult) => void) | null;
};

type SeasonAdvanceModalComponent = ((
  props: SeasonAdvanceModalProps
) => JSX.Element | null) & {
  propTypes?: Record<string, unknown>;
};

function findPlayersWithOptions(
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

function findExpiringContracts(
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

function findExpiringCapHolds(
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

function findExpiringTPEs(
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

export const SeasonAdvanceModal: SeasonAdvanceModalComponent = ({
  isOpen,
  onClose,
  teamCapSheet = null,
  authoritativeSeasonEndYear,
  worldId = null,
  teamCode = null,
  onWorldAdvanceComplete = null,
}: SeasonAdvanceModalProps) => {
  void teamCode;

  const [currentStep, setCurrentStep] = useState<WizardStepValue>(
    WIZARD_STEPS.SUMMARY
  );
  const [optionDecisions, setOptionDecisions] = useState<OptionDecisionMap>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SeasonAdvanceResult | null>(null);

  const toYear = authoritativeSeasonEndYear + 1;
  const fromSeason = toSeasonCode(authoritativeSeasonEndYear);
  const toSeason = toSeasonCode(toYear);

  const playersWithOptions = useMemo(
    () => findPlayersWithOptions(teamCapSheet, toYear),
    [teamCapSheet, toYear]
  );

  const expiringContracts = useMemo(
    () => findExpiringContracts(teamCapSheet, authoritativeSeasonEndYear),
    [teamCapSheet, authoritativeSeasonEndYear]
  );

  const expiringCapHolds = useMemo(
    () => findExpiringCapHolds(teamCapSheet, toYear),
    [teamCapSheet, toYear]
  );

  const expiringTPEs = useMemo(
    () => findExpiringTPEs(teamCapSheet, toYear),
    [teamCapSheet, toYear]
  );

  const hasOptions = playersWithOptions.length > 0;
  const allOptionsDecided = useMemo(() => {
    if (!hasOptions) return true;
    return playersWithOptions.every(
      (player) => optionDecisions[player.playerId]?.decision
    );
  }, [hasOptions, playersWithOptions, optionDecisions]);

  useEffect(() => {
    if (isOpen && hasOptions) {
      const initial: OptionDecisionMap = {};
      for (const player of playersWithOptions) {
        initial[player.playerId] = {
          decision: null,
          optionType: player.optionType,
          season: player.season,
          playerName: player.playerName,
        };
      }
      setOptionDecisions(initial);
    }
  }, [isOpen, hasOptions, playersWithOptions]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(WIZARD_STEPS.SUMMARY);
      setOptionDecisions({});
      setError('');
      setResult(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  const handleOptionChange = useCallback(
    (playerId: string, decision: 'exercise' | 'decline') => {
      setOptionDecisions((previous) => ({
        ...previous,
        [playerId]: {
          ...previous[playerId],
          decision,
        },
      }));
    },
    []
  );

  const handleNext = useCallback(() => {
    setError('');

    if (currentStep === WIZARD_STEPS.SUMMARY) {
      if (hasOptions) {
        setCurrentStep(WIZARD_STEPS.OPTIONS);
      } else {
        setCurrentStep(WIZARD_STEPS.CONFIRMATION);
      }
    } else if (currentStep === WIZARD_STEPS.OPTIONS) {
      if (!allOptionsDecided) {
        setError(
          'Please make a decision for all player/team options before proceeding.'
        );
        return;
      }
      setCurrentStep(WIZARD_STEPS.CONFIRMATION);
    }
  }, [currentStep, hasOptions, allOptionsDecided]);

  const handleBack = useCallback(() => {
    setError('');

    if (currentStep === WIZARD_STEPS.OPTIONS) {
      setCurrentStep(WIZARD_STEPS.SUMMARY);
    } else if (currentStep === WIZARD_STEPS.CONFIRMATION) {
      if (hasOptions) {
        setCurrentStep(WIZARD_STEPS.OPTIONS);
      } else {
        setCurrentStep(WIZARD_STEPS.SUMMARY);
      }
    }
  }, [currentStep, hasOptions]);

  const handleAdvanceSeason = useCallback(async () => {
    if (!worldId) {
      setError(
        'No world selected. Please select a world before advancing seasons.'
      );
      return;
    }

    setIsProcessing(true);
    setError('');
    setCurrentStep(WIZARD_STEPS.PROCESSING);

    try {
      const { advanceSeasonInWorld } = (await import(
        '@/features/architect/utils/seasonManager'
      )) as {
        advanceSeasonInWorld: AdvanceSeasonInWorld;
      };

      const decisions: Record<string, OffseasonOptionDecision> = {};
      for (const [playerId, data] of Object.entries(optionDecisions)) {
        if (data.decision) {
          const normalizedType = String(data.optionType || '')
            .toLowerCase()
            .includes('player')
            ? 'player'
            : 'team';
          decisions[playerId] = {
            decision: data.decision,
            optionType: normalizedType,
            season: data.season || toSeason,
          };
        }
      }

      const advanceResult = await advanceSeasonInWorld(worldId, {
        optionDecisions: decisions,
      });

      if (!advanceResult.success) {
        throw new Error(advanceResult.error || 'Season advance failed');
      }

      const modalResult: SeasonAdvanceResult = {
        success: advanceResult.success,
        error:
          typeof advanceResult.error === 'string'
            ? advanceResult.error
            : undefined,
        toSeason:
          typeof advanceResult.toSeason === 'string'
            ? advanceResult.toSeason
            : undefined,
        updatedTeams: Array.isArray(advanceResult.updatedTeams)
          ? advanceResult.updatedTeams
          : [],
        summary: advanceResult.summary as SeasonAdvanceSummary | undefined,
      };

      setResult(modalResult);
      setCurrentStep(WIZARD_STEPS.COMPLETE);

      if (onWorldAdvanceComplete) {
        onWorldAdvanceComplete(modalResult);
      }
    } catch (err) {
      console.error('Season advance failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to advance season');
      setCurrentStep(WIZARD_STEPS.CONFIRMATION);
    } finally {
      setIsProcessing(false);
    }
  }, [worldId, optionDecisions, onWorldAdvanceComplete, toSeason]);

  const renderSummaryStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">
        Advance to {toSeason}
      </h3>

      <div className="text-sm text-white/70 space-y-3">
        <p>
          This will advance the current world from {fromSeason} to {toSeason}.
          The following changes will occur:
        </p>

        <div className="bg-[#1a1a1a] rounded p-3 border border-white/10">
          <h4 className="font-medium text-white mb-2">
            Expiring Contracts ({expiringContracts.length})
          </h4>
          {expiringContracts.length > 0 ? (
            <ul className="text-xs space-y-1">
              {expiringContracts.map((player) => (
                <li key={player.playerId} className="text-white/60">
                  {player.playerName} - $
                  {(player.lastSalary / 1_000_000).toFixed(1)}M
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-white/50">No expiring contracts</p>
          )}
        </div>

        {hasOptions && (
          <div className="bg-[#1a1a1a] rounded p-3 border border-yellow-500/30">
            <h4 className="font-medium text-yellow-400 mb-2">
              Options Requiring Decision ({playersWithOptions.length})
            </h4>
            <ul className="text-xs space-y-1">
              {playersWithOptions.map((player) => (
                <li key={player.playerId} className="text-white/60">
                  {player.playerName} - {player.optionType} - $
                  {(player.salary / 1_000_000).toFixed(1)}M
                </li>
              ))}
            </ul>
            <p className="text-xs text-yellow-400/70 mt-2">
              You will decide these in the next step.
            </p>
          </div>
        )}

        {expiringCapHolds.length > 0 && (
          <div className="bg-[#1a1a1a] rounded p-3 border border-white/10">
            <h4 className="font-medium text-white mb-2">
              Expiring Cap Holds ({expiringCapHolds.length})
            </h4>
            <ul className="text-xs space-y-1">
              {expiringCapHolds.map((hold, index) => (
                <li key={hold.playerId || index} className="text-white/60">
                  {hold.playerName} - ${(hold.amount / 1_000_000).toFixed(1)}M (
                  {hold.type})
                </li>
              ))}
            </ul>
          </div>
        )}

        {expiringTPEs.length > 0 && (
          <div className="bg-[#1a1a1a] rounded p-3 border border-white/10">
            <h4 className="font-medium text-white mb-2">
              Expiring Trade Exceptions ({expiringTPEs.length})
            </h4>
            <ul className="text-xs space-y-1">
              {expiringTPEs.map((tpe, index) => (
                <li key={index} className="text-white/60">
                  ${(tpe.amount / 1_000_000).toFixed(1)}M -{' '}
                  {tpe.date.split('T')[0]}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-[#1a1a1a] rounded p-3 border border-white/10">
          <h4 className="font-medium text-white mb-2">Other Effects</h4>
          <ul className="text-xs space-y-1 text-white/60">
            <li>• MLE will be reset for the new season</li>
            <li>• Hard cap will be cleared</li>
            <li>• Draft picks will be updated</li>
            <li>• Stepien eligibility will be recalculated</li>
          </ul>
        </div>
      </div>

      {!worldId && (
        <div className="bg-red-500/20 border border-red-500/50 rounded p-3">
          <p className="text-sm text-red-400">
            ⚠️ No world selected. You must select a world before advancing
            seasons.
          </p>
        </div>
      )}
    </div>
  );

  const renderOptionsStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">
        Option Decisions for {toSeason}
      </h3>

      <p className="text-sm text-white/70">
        Make a decision for each player/team option. These decisions cannot be
        undone.
      </p>

      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {playersWithOptions.map((player) => (
          <div
            key={player.playerId}
            className="bg-[#1a1a1a] rounded p-3 border border-white/10"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-medium text-white">
                  {player.playerName}
                </span>
                <span className="text-xs text-white/50 ml-2">
                  {player.optionType}
                </span>
              </div>
              <span className="text-sm text-green-400">
                ${(player.salary / 1_000_000).toFixed(1)}M
              </span>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`option-${player.playerId}`}
                  checked={
                    optionDecisions[player.playerId]?.decision === 'exercise'
                  }
                  onChange={() =>
                    handleOptionChange(player.playerId, 'exercise')
                  }
                  className="text-blue-500"
                />
                <span className="text-sm text-white">Exercise</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`option-${player.playerId}`}
                  checked={
                    optionDecisions[player.playerId]?.decision === 'decline'
                  }
                  onChange={() =>
                    handleOptionChange(player.playerId, 'decline')
                  }
                  className="text-red-500"
                />
                <span className="text-sm text-white">Decline</span>
              </label>
            </div>

            {!optionDecisions[player.playerId]?.decision && (
              <p className="text-xs text-yellow-400 mt-1">Decision required</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderConfirmationStep = () => {
    const exercised = Object.entries(optionDecisions).filter(
      ([, data]) => data.decision === 'exercise'
    );
    const declined = Object.entries(optionDecisions).filter(
      ([, data]) => data.decision === 'decline'
    );

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">
          Confirm Season Advance
        </h3>

        <div className="text-sm text-white/70 space-y-3">
          <p>
            You are about to advance from <strong>{fromSeason}</strong> to{' '}
            <strong>{toSeason}</strong>.
          </p>

          {exercised.length > 0 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
              <h4 className="font-medium text-green-400 mb-1">
                Options to Exercise ({exercised.length})
              </h4>
              <ul className="text-xs text-white/60">
                {exercised.map(([, data]) => (
                  <li key={String(data.playerName)}>{data.playerName}</li>
                ))}
              </ul>
            </div>
          )}

          {declined.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
              <h4 className="font-medium text-red-400 mb-1">
                Options to Decline ({declined.length})
              </h4>
              <ul className="text-xs text-white/60">
                {declined.map(([, data]) => (
                  <li key={String(data.playerName)}>
                    {data.playerName} → Free Agent
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-yellow-400 text-xs">
            ⚠️ This action cannot be undone. Make sure all decisions are
            correct.
          </p>
        </div>
      </div>
    );
  };

  const renderProcessingStep = () => (
    <div className="space-y-4 text-center py-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
      <h3 className="text-lg font-semibold text-white">Advancing Season...</h3>
      <p className="text-sm text-white/70">
        Processing contracts, options, and draft picks...
      </p>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-4 text-center py-8">
      <div className="text-5xl">✅</div>
      <h3 className="text-lg font-semibold text-green-400">
        Season Advanced Successfully!
      </h3>
      <p className="text-sm text-white/70">
        You are now in the <strong>{toSeason}</strong> season.
      </p>
      {result?.updatedTeams?.length ? (
        <p className="text-xs text-white/50">
          Updated {result.updatedTeams.length} team(s)
        </p>
      ) : null}
    </div>
  );

  if (!isOpen) return null;

  const canProceed = currentStep !== WIZARD_STEPS.OPTIONS || allOptionsDecided;
  const showBackButton =
    currentStep === WIZARD_STEPS.OPTIONS ||
    currentStep === WIZARD_STEPS.CONFIRMATION;
  const showNextButton =
    currentStep === WIZARD_STEPS.SUMMARY ||
    currentStep === WIZARD_STEPS.OPTIONS;
  const showAdvanceButton = currentStep === WIZARD_STEPS.CONFIRMATION;
  const showCloseButton = currentStep === WIZARD_STEPS.COMPLETE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={currentStep !== WIZARD_STEPS.PROCESSING ? onClose : undefined}
      />

      <div className="relative bg-[#0d0d0d] border border-white/10 rounded-lg shadow-xl w-[500px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Advance Season</h2>
          {currentStep !== WIZARD_STEPS.PROCESSING && (
            <button
              type="button"
              onClick={onClose}
              className="text-white/50 hover:text-white text-xl leading-none"
            >
              ×
            </button>
          )}
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded p-3 mb-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {currentStep === WIZARD_STEPS.SUMMARY && renderSummaryStep()}
          {currentStep === WIZARD_STEPS.OPTIONS && renderOptionsStep()}
          {currentStep === WIZARD_STEPS.CONFIRMATION &&
            renderConfirmationStep()}
          {currentStep === WIZARD_STEPS.PROCESSING && renderProcessingStep()}
          {currentStep === WIZARD_STEPS.COMPLETE && renderCompleteStep()}
        </div>

        <div className="p-4 border-t border-white/10 flex justify-between">
          <div>
            {showBackButton && (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
                disabled={isProcessing}
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {showNextButton && (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!canProceed || !worldId}
              >
                Next
              </button>
            )}
            {showAdvanceButton && (
              <button
                type="button"
                onClick={handleAdvanceSeason}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isProcessing || !worldId}
              >
                {isProcessing ? 'Processing...' : 'Advance Season'}
              </button>
            )}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

SeasonAdvanceModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  teamCapSheet: PropTypes.object,
  authoritativeSeasonEndYear: PropTypes.number.isRequired,
  worldId: PropTypes.string,
  teamCode: PropTypes.string,
  onWorldAdvanceComplete: PropTypes.func,
};

export default SeasonAdvanceModal;
