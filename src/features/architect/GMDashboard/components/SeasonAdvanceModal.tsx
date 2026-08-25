/**
 * FILE: src/features/architect/GMDashboard/components/SeasonAdvanceModal.tsx
 * PURPOSE: Modal/wizard for advancing seasons in Architect GMDashboard
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-20: Created for Phase 3B implementation per docs/architect/ARCHITECT_GAP_ANALYSIS.md
 *  - 2026-05-12: Wave 4 Step 0.5 — extracted types to SeasonAdvanceModal.types.ts,
 *                helpers to SeasonAdvanceModal.helpers.ts
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  toSeasonCode,
  toEndYear,
} from '@/features/architect/utils/seasonFormat';
import {
  WIZARD_STEPS,
  type WizardStepValue,
  type StagedOptionDecisionMap,
  type SeasonAdvanceSuccessResult,
  type SeasonAdvanceModalComponent,
  type SeasonAdvanceModalProps,
  type SeasonAdvanceRequest,
} from './SeasonAdvanceModal.types';
import {
  buildPreAdvanceWizardSteps,
  getWizardNavigationState,
  reconcileStagedOptionDecisions,
  buildOrderedStagedOptionDecisions,
  getStagedOptionValidationError,
  buildAdvanceOptionDecisions,
  findPlayersWithOptions,
  findExpiringContracts,
  findExpiringCapHolds,
  findExpiringTPEs,
  buildSeasonAdvanceSuccessResult,
  getSeasonAdvanceFailureMessage,
} from './SeasonAdvanceModal.helpers';

export type {
  WorldAdvanceAftermath,
  SeasonAdvanceSuccessResult,
  SeasonAdvanceFailureResult,
  SeasonAdvanceResult,
} from './SeasonAdvanceModal.types';

export const SeasonAdvanceModal: SeasonAdvanceModalComponent = ({
  isOpen,
  onClose,
  teamCapSheet = null,
  authoritativeWorldSeason,
  worldId = null,
  teamCode = null,
  onWorldAdvanceComplete = null,
}: SeasonAdvanceModalProps) => {
  const [currentStep, setCurrentStep] = useState<WizardStepValue>(
    WIZARD_STEPS.SUMMARY
  );
  const [stagedOptionDecisions, setStagedOptionDecisions] =
    useState<StagedOptionDecisionMap>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SeasonAdvanceSuccessResult | null>(null);

  const authoritativeSeasonEndYear = toEndYear(authoritativeWorldSeason) ?? 0;
  const fromSeason = authoritativeWorldSeason;
  const toYear = authoritativeSeasonEndYear + 1;
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
  const preAdvanceSteps = useMemo(
    () => buildPreAdvanceWizardSteps(hasOptions),
    [hasOptions]
  );
  const wizardNavigation = useMemo(
    () => getWizardNavigationState(currentStep, preAdvanceSteps),
    [currentStep, preAdvanceSteps]
  );
  const orderedStagedOptionDecisions = useMemo(
    () =>
      buildOrderedStagedOptionDecisions(
        playersWithOptions,
        stagedOptionDecisions
      ),
    [playersWithOptions, stagedOptionDecisions]
  );
  const stagedOptionValidationError = useMemo(
    () =>
      getStagedOptionValidationError(
        hasOptions,
        orderedStagedOptionDecisions
      ),
    [hasOptions, orderedStagedOptionDecisions]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setStagedOptionDecisions((previous) =>
      reconcileStagedOptionDecisions(previous, playersWithOptions)
    );
  }, [isOpen, playersWithOptions]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(WIZARD_STEPS.SUMMARY);
      setStagedOptionDecisions({});
      setError('');
      setResult(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  const handleOptionChange = useCallback(
    (playerId: string, decision: 'exercise' | 'decline') => {
      setStagedOptionDecisions((previous) => ({
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

    if (currentStep === WIZARD_STEPS.OPTIONS && stagedOptionValidationError) {
      setError(stagedOptionValidationError);
      return;
    }

    if (!wizardNavigation.nextStep) {
      return;
    }

    setCurrentStep(wizardNavigation.nextStep);
  }, [currentStep, stagedOptionValidationError, wizardNavigation.nextStep]);

  const handleBack = useCallback(() => {
    setError('');

    if (!wizardNavigation.previousStep) {
      return;
    }

    setCurrentStep(wizardNavigation.previousStep);
  }, [wizardNavigation.previousStep]);

  const handleAdvanceFailure = useCallback((failure: { error?: unknown } | unknown) => {
    setResult(null);
    setError(getSeasonAdvanceFailureMessage(failure));
    setCurrentStep(WIZARD_STEPS.CONFIRMATION);
  }, []);

  const handleAdvanceSeason = useCallback(async () => {
    if (!worldId) {
      setError(
        'No world selected. Please select a world before advancing seasons.'
      );
      return;
    }

    if (stagedOptionValidationError) {
      setError(stagedOptionValidationError);
      if (hasOptions) {
        setCurrentStep(WIZARD_STEPS.OPTIONS);
      }
      return;
    }

    setIsProcessing(true);
    setError('');
    setCurrentStep(WIZARD_STEPS.PROCESSING);

    try {
      // Dashboard adapter only: committed season/world advancement stays in seasonManager.ts.
      const seasonManagerModule = await import(
        '@/features/architect/utils/seasonManager'
      );
      const seasonAdvanceRequest: SeasonAdvanceRequest = {
        fromSeason,
        toSeason,
        optionDecisions: buildAdvanceOptionDecisions(
          playersWithOptions,
          stagedOptionDecisions,
          toSeason
        ),
        focusTeamCode: teamCode ?? undefined,
      };
      const advanceResult = await seasonManagerModule.advanceSeasonInWorld(
        worldId,
        seasonAdvanceRequest
      );

      if (!advanceResult.success) {
        handleAdvanceFailure(advanceResult);
        return;
      }

      const modalResult = buildSeasonAdvanceSuccessResult({
        advanceResult,
      });
      if (!modalResult) {
        handleAdvanceFailure({
          error:
            'Season advance succeeded but committed post-success state was missing from the authoritative executor result.',
        });
        return;
      }

      setResult(modalResult);
      setCurrentStep(WIZARD_STEPS.COMPLETE);

      if (onWorldAdvanceComplete) {
        try {
          await onWorldAdvanceComplete(modalResult);
        } catch (callbackError) {
          console.error(
            'Season advance post-success handling failed:',
            callbackError
          );
        }
      }
    } catch (err) {
      console.error('Season advance failed:', err);
      handleAdvanceFailure(err);
    } finally {
      setIsProcessing(false);
    }
  }, [
    hasOptions,
    handleAdvanceFailure,
    onWorldAdvanceComplete,
    playersWithOptions,
    stagedOptionDecisions,
    stagedOptionValidationError,
    fromSeason,
    teamCode,
    toSeason,
    worldId,
  ]);

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
                    stagedOptionDecisions[player.playerId]?.decision ===
                    'exercise'
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
                    stagedOptionDecisions[player.playerId]?.decision ===
                    'decline'
                  }
                  onChange={() =>
                    handleOptionChange(player.playerId, 'decline')
                  }
                  className="text-red-500"
                />
                <span className="text-sm text-white">Decline</span>
              </label>
            </div>

            {!stagedOptionDecisions[player.playerId]?.decision && (
              <p className="text-xs text-yellow-400 mt-1">Decision required</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderConfirmationStep = () => {
    const exercised = orderedStagedOptionDecisions.filter(
      (data) => data.decision === 'exercise'
    );
    const declined = orderedStagedOptionDecisions.filter(
      (data) => data.decision === 'decline'
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
                {exercised.map((data) => (
                  <li key={data.playerId}>{data.playerName}</li>
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
                {declined.map((data) => (
                  <li key={data.playerId}>
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
      <h3
        className={`text-lg font-semibold ${
          result?.persistenceConfirmed === false
            ? 'text-amber-300'
            : 'text-green-400'
        }`}
      >
        {result?.persistenceConfirmed === false
          ? 'Season Committed; Reload Confirmation Needed'
          : 'Season Advanced Successfully!'}
      </h3>
      <p className="text-sm text-white/70">
        You are now in the <strong>{result?.toSeason ?? toSeason}</strong>{' '}
        season.
      </p>
      {result?.updatedTeams?.length ? (
        <p className="text-xs text-white/50">
          Updated {result.updatedTeams.length} team(s)
        </p>
      ) : null}
      {result?.persistenceConfirmed === false ? (
        <p className="text-xs text-amber-200/80">
          The 30-team transaction committed. Do not run Season Advance again;
          reload this world to confirm its saved history.
        </p>
      ) : null}
    </div>
  );

  if (!isOpen) return null;

  const canProceed =
    currentStep !== WIZARD_STEPS.OPTIONS || stagedOptionValidationError === null;
  const showBackButton = Boolean(wizardNavigation.previousStep);
  const showNextButton = Boolean(wizardNavigation.nextStep);
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
          {wizardNavigation.isPreAdvanceStep && (
            <ol
              aria-label="Season advance progress"
              data-testid="season-advance-progress"
              className="mb-4 flex items-center gap-2 text-xs text-white/60"
            >
              {preAdvanceSteps.map((step, index) => {
                const isActive = wizardNavigation.currentIndex === index;
                const isComplete = wizardNavigation.currentIndex > index;

                return (
                  <li
                    key={step.value}
                    aria-current={isActive ? 'step' : undefined}
                    data-state={
                      isActive
                        ? 'current'
                        : isComplete
                          ? 'complete'
                          : 'upcoming'
                    }
                    data-testid={`season-advance-progress-${step.value}`}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                        isActive
                          ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                          : isComplete
                            ? 'border-green-500 bg-green-500/20 text-green-300'
                            : 'border-white/20 bg-white/5 text-white/50'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className={isActive ? 'text-white' : undefined}>
                      {step.label}
                    </span>
                    {index < preAdvanceSteps.length - 1 && (
                      <span className="text-white/20">/</span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

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
  authoritativeWorldSeason: PropTypes.string.isRequired,
  worldId: PropTypes.string,
  teamCode: PropTypes.string,
  onWorldAdvanceComplete: PropTypes.func,
};
