/**
 * FILE: src/features/architect/GMDashboard/components/SeasonAdvanceModal.jsx
 * PURPOSE: Modal/wizard for advancing seasons in Architect GMDashboard
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * HISTORY:
 *  - 2025-12-20: Created for Phase 3B implementation per ARCHITECT_GAP_ANALYSIS.md
 *
 * LINKS:
 *  - seasonManager: src/features/architect/utils/seasonManager.js
 *  - mutationPipeline: src/features/architect/utils/mutationPipeline.js
 *  - GMDashboard integration: src/features/architect/GMDashboard/GMDashboard.jsx
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { toSeasonCode, toEndYear } from '@/features/architect/utils/seasonFormat';

// ==============================================================================
// CONSTANTS
// ==============================================================================

const WIZARD_STEPS = {
  SUMMARY: 'summary',
  OPTIONS: 'options',
  CONFIRMATION: 'confirmation',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
};

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

/**
 * Find players with options for the target season
 * @param {Object} teamCapSheet - Current team cap sheet
 * @param {number} targetYear - Target season end year
 * @returns {Array} Players with options
 */
function findPlayersWithOptions(teamCapSheet, targetYear) {
  if (!teamCapSheet?.players || !Array.isArray(teamCapSheet.players)) {
    return [];
  }

  const targetSeason = toSeasonCode(targetYear);
  const playersWithOptions = [];

  for (const player of teamCapSheet.players) {
    if (!player?.contract?.salariesByYear) continue;

    // Support multiple ID formats but avoid using name as ID
    const playerId = player.player_id || player.id || player.playerId;
    if (!playerId) {
      console.warn('Player missing ID fields, skipping option:', player.displayName || player.name);
      continue;
    }

    const yearEntry = player.contract.salariesByYear.find((y) => {
      const yearEnd = toEndYear(y.season);
      return yearEnd === targetYear && y.option;
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

/**
 * Find players with expiring contracts
 * @param {Object} teamCapSheet - Current team cap sheet
 * @param {number} fromYear - Current season end year
 * @returns {Array} Players with expiring contracts
 */
function findExpiringContracts(teamCapSheet, fromYear) {
  if (!teamCapSheet?.players || !Array.isArray(teamCapSheet.players)) {
    return [];
  }

  const expiring = [];

  for (const player of teamCapSheet.players) {
    if (!player?.contract?.salariesByYear || player.contract.salariesByYear.length === 0) {
      continue;
    }

    // Find the last year of the contract
    const sortedYears = [...player.contract.salariesByYear].sort((a, b) => {
      return (toEndYear(a.season) || 0) - (toEndYear(b.season) || 0);
    });
    const lastYear = sortedYears[sortedYears.length - 1];
    const endYear = toEndYear(lastYear?.season);

    // Contract expires if endYear equals the current year (fromYear)
    if (endYear === fromYear && !lastYear.option) {
      expiring.push({
        playerId: player.player_id || player.id || player.name,
        playerName: player.displayName || player.name,
        lastSalary: lastYear.salary || lastYear.capHit || 0,
      });
    }
  }

  return expiring;
}

/**
 * Find expiring cap holds
 * @param {Object} teamCapSheet - Current team cap sheet  
 * @param {number} toYear - Target season end year
 * @returns {Array} Expiring cap holds
 */
function findExpiringCapHolds(teamCapSheet, toYear) {
  if (!teamCapSheet?.capHolds || !Array.isArray(teamCapSheet.capHolds)) {
    return [];
  }

  const expiringHolds = [];
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

// ==============================================================================
// COMPONENT
// ==============================================================================

/**
 * SeasonAdvanceModal - Modal wizard for advancing seasons
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Object} props.teamCapSheet - Current team cap sheet
 * @param {number} props.currentYear - Current season end year
 * @param {string|null} props.worldId - Current world ID (required for persistence)
 * @param {string} props.teamCode - Current team code
 * @param {Function} props.onAdvanceComplete - Callback when season advance completes
 */
export function SeasonAdvanceModal({
  isOpen,
  onClose,
  teamCapSheet,
  currentYear,
  worldId,
  teamCode,
  onAdvanceComplete,
}) {
  // Wizard step state
  const [currentStep, setCurrentStep] = useState(WIZARD_STEPS.SUMMARY);
  
  // Option decisions state: { [playerId]: { decision: 'exercise' | 'decline', ... } }
  const [optionDecisions, setOptionDecisions] = useState({});
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const toYear = currentYear + 1;
  const fromSeason = toSeasonCode(currentYear);
  const toSeason = toSeasonCode(toYear);

  // ===========================================================================
  // COMPUTED VALUES
  // ===========================================================================

  const playersWithOptions = useMemo(
    () => findPlayersWithOptions(teamCapSheet, toYear),
    [teamCapSheet, toYear]
  );

  const expiringContracts = useMemo(
    () => findExpiringContracts(teamCapSheet, currentYear),
    [teamCapSheet, currentYear]
  );

  const expiringCapHolds = useMemo(
    () => findExpiringCapHolds(teamCapSheet, toYear),
    [teamCapSheet, toYear]
  );

  const hasOptions = playersWithOptions.length > 0;
  const allOptionsDecided = useMemo(() => {
    if (!hasOptions) return true;
    return playersWithOptions.every((p) => optionDecisions[p.playerId]?.decision);
  }, [hasOptions, playersWithOptions, optionDecisions]);

  // ===========================================================================
  // INITIALIZE OPTION DECISIONS
  // ===========================================================================

  useEffect(() => {
    if (isOpen && hasOptions) {
      const initial = {};
      for (const player of playersWithOptions) {
        // Default to 'exercise' for visibility, but user must explicitly confirm
        initial[player.playerId] = {
          decision: null, // null means not yet decided
          optionType: player.optionType,
          season: player.season,
          playerName: player.playerName,
        };
      }
      setOptionDecisions(initial);
    }
  }, [isOpen, hasOptions, playersWithOptions]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(WIZARD_STEPS.SUMMARY);
      setOptionDecisions({});
      setError('');
      setResult(null);
      setIsProcessing(false);
    }
  }, [isOpen]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleOptionChange = useCallback((playerId, decision) => {
    setOptionDecisions((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        decision,
      },
    }));
  }, []);

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
        setError('Please make a decision for all player/team options before proceeding.');
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
      setError('No world selected. Please select a world before advancing seasons.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setCurrentStep(WIZARD_STEPS.PROCESSING);

    try {
      // Import the mutation pipeline dynamically to avoid circular deps
      const { advanceSeasonInWorld } = await import(
        '@/features/architect/utils/seasonManager'
      );

      // Build option decisions in the expected format
      const decisions = {};
      for (const [playerId, data] of Object.entries(optionDecisions)) {
        if (data.decision) {
          // Normalize option type to lowercase 'player' or 'team'
          const normalizedType = String(data.optionType || '').toLowerCase().includes('player')
            ? 'player'
            : 'team';
          decisions[playerId] = {
            decision: data.decision,
            optionType: normalizedType,
            season: data.season,
          };
        }
      }

      // Call the season advancement
      const advanceResult = await advanceSeasonInWorld(worldId, {
        fromSeason,
        toSeason,
        optionDecisions: decisions,
      });

      if (!advanceResult.success) {
        throw new Error(advanceResult.error || 'Season advance failed');
      }

      setResult(advanceResult);
      setCurrentStep(WIZARD_STEPS.COMPLETE);

      // Notify parent of completion
      if (onAdvanceComplete) {
        onAdvanceComplete(advanceResult);
      }
    } catch (err) {
      console.error('Season advance failed:', err);
      setError(err.message || 'Failed to advance season');
      setCurrentStep(WIZARD_STEPS.CONFIRMATION);
    } finally {
      setIsProcessing(false);
    }
  }, [worldId, optionDecisions, fromSeason, toSeason, onAdvanceComplete]);

  // ===========================================================================
  // RENDER HELPERS
  // ===========================================================================

  const renderSummaryStep = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">
        Advance to {toSeason}
      </h3>
      
      <div className="text-sm text-white/70 space-y-3">
        <p>This will advance the current world from {fromSeason} to {toSeason}. The following changes will occur:</p>
        
        {/* Expiring Contracts */}
        <div className="bg-[#1a1a1a] rounded p-3 border border-white/10">
          <h4 className="font-medium text-white mb-2">Expiring Contracts ({expiringContracts.length})</h4>
          {expiringContracts.length > 0 ? (
            <ul className="text-xs space-y-1">
              {expiringContracts.map((p) => (
                <li key={p.playerId} className="text-white/60">
                  {p.playerName} - ${(p.lastSalary / 1_000_000).toFixed(1)}M
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-white/50">No expiring contracts</p>
          )}
        </div>

        {/* Options */}
        {hasOptions && (
          <div className="bg-[#1a1a1a] rounded p-3 border border-yellow-500/30">
            <h4 className="font-medium text-yellow-400 mb-2">
              Options Requiring Decision ({playersWithOptions.length})
            </h4>
            <ul className="text-xs space-y-1">
              {playersWithOptions.map((p) => (
                <li key={p.playerId} className="text-white/60">
                  {p.playerName} - {p.optionType} - ${(p.salary / 1_000_000).toFixed(1)}M
                </li>
              ))}
            </ul>
            <p className="text-xs text-yellow-400/70 mt-2">
              You will decide these in the next step.
            </p>
          </div>
        )}

        {/* Expiring Cap Holds */}
        {expiringCapHolds.length > 0 && (
          <div className="bg-[#1a1a1a] rounded p-3 border border-white/10">
            <h4 className="font-medium text-white mb-2">Expiring Cap Holds ({expiringCapHolds.length})</h4>
            <ul className="text-xs space-y-1">
              {expiringCapHolds.map((h, idx) => (
                <li key={h.playerId || idx} className="text-white/60">
                  {h.playerName} - ${(h.amount / 1_000_000).toFixed(1)}M ({h.type})
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Other Effects */}
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
            ⚠️ No world selected. You must select a world before advancing seasons.
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
        Make a decision for each player/team option. These decisions cannot be undone.
      </p>

      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {playersWithOptions.map((player) => (
          <div
            key={player.playerId}
            className="bg-[#1a1a1a] rounded p-3 border border-white/10"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-medium text-white">{player.playerName}</span>
                <span className="text-xs text-white/50 ml-2">{player.optionType}</span>
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
                  checked={optionDecisions[player.playerId]?.decision === 'exercise'}
                  onChange={() => handleOptionChange(player.playerId, 'exercise')}
                  className="text-blue-500"
                />
                <span className="text-sm text-white">Exercise</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`option-${player.playerId}`}
                  checked={optionDecisions[player.playerId]?.decision === 'decline'}
                  onChange={() => handleOptionChange(player.playerId, 'decline')}
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
              <h4 className="font-medium text-green-400 mb-1">Options to Exercise ({exercised.length})</h4>
              <ul className="text-xs text-white/60">
                {exercised.map(([, data]) => (
                  <li key={data.playerName}>{data.playerName}</li>
                ))}
              </ul>
            </div>
          )}

          {declined.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
              <h4 className="font-medium text-red-400 mb-1">Options to Decline ({declined.length})</h4>
              <ul className="text-xs text-white/60">
                {declined.map(([, data]) => (
                  <li key={data.playerName}>{data.playerName} → Free Agent</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-yellow-400 text-xs">
            ⚠️ This action cannot be undone. Make sure all decisions are correct.
          </p>
        </div>
      </div>
    );
  };

  const renderProcessingStep = () => (
    <div className="space-y-4 text-center py-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
      <h3 className="text-lg font-semibold text-white">
        Advancing Season...
      </h3>
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
      {result?.updatedTeams?.length > 0 && (
        <p className="text-xs text-white/50">
          Updated {result.updatedTeams.length} team(s)
        </p>
      )}
    </div>
  );

  // ===========================================================================
  // RENDER
  // ===========================================================================

  if (!isOpen) return null;

  const canProceed = currentStep !== WIZARD_STEPS.OPTIONS || allOptionsDecided;
  const showBackButton = currentStep === WIZARD_STEPS.OPTIONS || currentStep === WIZARD_STEPS.CONFIRMATION;
  const showNextButton = currentStep === WIZARD_STEPS.SUMMARY || currentStep === WIZARD_STEPS.OPTIONS;
  const showAdvanceButton = currentStep === WIZARD_STEPS.CONFIRMATION;
  const showCloseButton = currentStep === WIZARD_STEPS.COMPLETE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={currentStep !== WIZARD_STEPS.PROCESSING ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-[#0d0d0d] border border-white/10 rounded-lg shadow-xl w-[500px] max-w-[90vw] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
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

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded p-3 mb-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {currentStep === WIZARD_STEPS.SUMMARY && renderSummaryStep()}
          {currentStep === WIZARD_STEPS.OPTIONS && renderOptionsStep()}
          {currentStep === WIZARD_STEPS.CONFIRMATION && renderConfirmationStep()}
          {currentStep === WIZARD_STEPS.PROCESSING && renderProcessingStep()}
          {currentStep === WIZARD_STEPS.COMPLETE && renderCompleteStep()}
        </div>

        {/* Footer */}
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
}

SeasonAdvanceModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  teamCapSheet: PropTypes.object,
  currentYear: PropTypes.number.isRequired,
  worldId: PropTypes.string,
  teamCode: PropTypes.string,
  onAdvanceComplete: PropTypes.func,
};

SeasonAdvanceModal.defaultProps = {
  teamCapSheet: null,
  worldId: null,
  teamCode: null,
  onAdvanceComplete: null,
};

export default SeasonAdvanceModal;
