/**
 * FILE: src/shared/components/EditContractModal.tsx
 * PURPOSE: Manage Architect contract actions (options, FA, extensions, waivers) with validation and rules profile guidance.
 * OWNERSHIP: Feature: architect/contracts
 *
 * HISTORY:
 *  - 2025-12-10: Integrated PlayerRulesProfile for extension defaults/validation (chunk_01).
 *  - 2025-12-10: Added fallback extension gating and FA/QO validation via rules profile (chunk_02).
 *  - 2025-12-17: Replaced deprecated extensionRules.js with salaryEngine for fallback.
 *  - 2025-12-24: Refactored to use shared capHelpers.js per Step 6 consolidation
 *
 * LINKS:
 *  - Plan: plans/_archive/player-rules-architect/plan.md
 *  - Latest Chunk: plans/_archive/player-rules-architect/chunks/chunk_02.md
 *
 * TODO: Track consolidation progress in ARCHITECT_PHASE5_HARDENING.md Step 6
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { Dialog, DialogContent } from '@/shared/components/ui/Dialog';
import { formatCurrencyFull, formatCurrency } from '@/shared/utils/formatting';
import { getCapSettings } from '@/features/architect/utils/capHelpers';
import {
  generateExtensionContract,
  getContractYearsForDisplay,
} from '@/features/architect/utils/contractUtils';
import { useCapValidation } from '@/features/architect/hooks/useCapValidation';
import { ValidationWarnings } from '@/features/architect/shared/ValidationWarnings';
import { TeamSelectDropdown } from '@/shared/components/TeamSelectDropdown';
import { resolveTeamCode } from '@/features/architect/utils/worldTeamData';
import { useEditContractModalForm } from './EditContractModal.form.hook';
import { useEditContractModalPreflight } from './EditContractModal.preflight.hook';
import { ContractSummaryPanel } from './EditContractModal.SummaryPanel';
import type {
  ContractYearWithNumberYear,
  ContractActionKey,
  SelectedContractAction,
  PlayerLike,
  PlayerRulesProfileLike,
  RulesLeagueContextLike,
  TeamCapSheetLike,
  OverrideMetadataLike,
  AuditLogEntryLike,
  ActionResultLike,
  StagedSigningPayloadLike,
  SignAndTradeInitiation,
  OfferSheetInitiation,
  ActionSetKey,
  EditContractModalProps,
  ValidationAuthority,
  ValidationStateLike,
} from './EditContractModal.types';
import {
  DEFAULT_VALIDATION_STATE,
  hasNumberContractYear,
  buildAdvisoryModalValidationState,
  buildAuthoritativePreflightState,
  buildValidationCopy,
  normalizeContractActionResult,
  ACTION_SETS,
  ACTION_LABELS,
  ACTION_DESCRIPTIONS,
  ACTION_TEST_IDS,
  isContractActionKey,
} from './EditContractModal.helpers';
export { normalizeContractActionResult } from './EditContractModal.helpers';

export const EditContractModal = ({
  player,
  isOpen,
  onClose,
  onSignFreeAgent,
  onResign,
  onWaive,
  onOptionDecision,
  onExtend,
  signAndTradeInitiation = null,
  onSignAndTrade,
  getSignAndTradePreflight = null,
  getOfferSheetPreflight = null,
  onRenounce,
  onStoreOfferSheet = null, // Phase 16
  initialAction = null,
  targetYear = null,
  actionYear: actionYearProp = null,
  actionContext = null, // 'option' | 'freeAgent' | null - from clicked cell
  teamCapSheet = null,
  currentYear: currentYearProp = null,
  playerRulesProfile = null,
  rulesLeagueContext = null,
  actionsOverride = null,
  actionLabelsOverride = {},
  showOfferSheetToggle = null,
  onAuditLog = null, // Callback to record override audit entries
}: EditContractModalProps) => {
  const [selectedAction, setSelectedAction] =
    useState<SelectedContractAction>('');
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  const [destinationTeamId, setDestinationTeamId] = useState<string | null>(
    null
  ); // Phase 23
  const [buyoutAmountInput, setBuyoutAmountInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Override state management
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [overrideText, setOverrideText] = useState('');
  const isOverrideConfirmed = overrideText === 'OVERRIDE';

  const normalizedTargetYear =
    typeof targetYear === 'number' ? targetYear : null;
  const normalizedActionYear =
    typeof actionYearProp === 'number' ? actionYearProp : null;
  const normalizedActionContext: ActionSetKey | null =
    actionContext === 'option' ||
    actionContext === 'freeAgent' ||
    actionContext === 'underContract'
      ? actionContext
      : null;
  const resolvedOfferSheetInitiation = useMemo<OfferSheetInitiation | null>(() => {
    if (getOfferSheetPreflight && onStoreOfferSheet) {
      return {
        getOfferSheetPreflight,
        onStoreOfferSheet,
      };
    }

    return null;
  }, [getOfferSheetPreflight, onStoreOfferSheet]);
  const resolvedShowOfferSheetToggle =
    typeof showOfferSheetToggle === 'boolean'
      ? showOfferSheetToggle && Boolean(resolvedOfferSheetInitiation)
      : Boolean(resolvedOfferSheetInitiation);

  const today = new Date();
  // CURRENT_YEAR = the END year of the current NBA season
  // e.g., in Dec 2025 we're in the 2025-26 season, so CURRENT_YEAR = 2026
  // After June, we're in the next season (e.g., July 2025 = 2025-26 season = 2026)
  const simulationDate = rulesLeagueContext?.simulationDate;
  const simDate = simulationDate instanceof Date ? simulationDate : today;
  const CURRENT_YEAR =
    (typeof currentYearProp === 'number' ? currentYearProp : null) ||
    (typeof rulesLeagueContext?.currentYear === 'number'
      ? rulesLeagueContext.currentYear
      : null) ||
    simDate.getFullYear() + (simDate.getMonth() >= 6 ? 1 : 0);
  const ACTION_YEAR =
    normalizedActionYear ??
    normalizedTargetYear ??
    (typeof rulesLeagueContext?.currentYear === 'number'
      ? rulesLeagueContext.currentYear
      : null) ??
    CURRENT_YEAR;

  const capSettings = useMemo(
    () => getCapSettings(ACTION_YEAR),
    [ACTION_YEAR]
  );

  const isSigningAction =
    selectedAction === 'signNew' || selectedAction === 'resign';


  const contractYears = useMemo<ContractYearWithNumberYear[]>(
    () => getContractYearsForDisplay(player).filter(hasNumberContractYear),
    [player]
  );



  const remainingGuaranteedForBuyout = useMemo(() => {
    const salaries = player?.contract?.salariesByYear || [];
    return salaries
      .filter((y) => {
        const season = String(y.season || '');
        const yearEnd = /^\d{4}-\d{2}$/.test(season)
          ? 2000 + parseInt(season.split('-')[1], 10)
          : parseInt(season, 10);
        return Number.isFinite(yearEnd) && yearEnd >= CURRENT_YEAR;
      })
      .filter((y) => y.guaranteed !== false)
      .reduce((sum, y) => sum + (Number(y.salary) || 0), 0);
  }, [CURRENT_YEAR, player]);

  const freeAgentYear =
    player?.freeAgentYear == null ? null : Number(player.freeAgentYear);
  const isFreeAgent =
    freeAgentYear != null &&
    Number.isFinite(freeAgentYear) &&
    freeAgentYear <= CURRENT_YEAR;

  // Only consider options on future years (not current season - that decision is already made)
  const optionYearEntry = contractYears.find(
    (y) => y.year > CURRENT_YEAR && y.option
  );
  const optionYear = optionYearEntry?.year || null;
  const optionType = optionYearEntry?.option || null;

  const lastSalaryForPrefill = useMemo(() => {
    if (!player) return 0;

    const years = [...contractYears].sort((a, b) => b.year - a.year);
    if (!years.length) return 0;

    if (isFreeAgent) {
      const lastYearEntry =
        years.find((y) => y.year <= CURRENT_YEAR) ?? years[0];
      return lastYearEntry?.salary || 0;
    }

    const targetYearForBase = optionYear ?? years[0]?.year;
    const targetEntry = years.find((y) => y.year === targetYearForBase);
    return targetEntry?.salary || 0;
  }, [CURRENT_YEAR, contractYears, isFreeAgent, optionYear, player]);

  const {
    extension,
    setExtension,
    salaryInputs,
    setSalaryInputs,
    selectedException,
    setSelectedException,
    isOfferSheet,
    setIsOfferSheet,
    extReason,
    extMax,
    signingGuardrails,
    availableSigningExceptions,
    contractDataForValidation,
    clampFirstYearToGuardrails,
    buildSalarySeries,
    toSalaryInputs,
    buildSigningDispatchPayload,
    buildCanonicalSigningDispatchPayload,
    buildOfferSheetDispatchPayload,
    signAndTradeDispatchPayload,
    offerSheetDispatchPayload,
  } = useEditContractModalForm({
    player,
    playerRulesProfile,
    capSettings,
    teamCapSheet,
    ACTION_YEAR,
    CURRENT_YEAR,
    lastSalaryForPrefill,
    initialAction,
    isSigningAction,
    selectedAction,
    isOpen: isOpen ?? false,
    resolvedShowOfferSheetToggle,
  });

  const hasOption = !!optionType;

  // Player is "under contract" if they have the current season or future guaranteed years
  const isUnderContract = contractYears.some((y) => y.year >= CURRENT_YEAR);

  // Player is expiring (for context text) - under contract now but no future years
  const isExpiring =
    isUnderContract && !contractYears.some((y) => y.year > CURRENT_YEAR);

  // Determine action set:
  // If actionContext is provided (from cell click), use it directly
  // Otherwise, infer from player's contract state (when clicking player name)
  const actionSet: ActionSetKey | null = normalizedActionContext
    ? normalizedActionContext
      : hasOption
        ? 'option'
        : isFreeAgent && !isUnderContract
          ? 'freeAgent'
          : isUnderContract
            ? 'underContract'
            : null;

  const actions = useMemo<ContractActionKey[]>(
    () =>
      (actionsOverride || (actionSet ? ACTION_SETS[actionSet] : []) || []).filter(
        isContractActionKey
      ),
    [actionSet, actionsOverride]
  );
  const extensionEligibility = playerRulesProfile?.extensionEligibility;
  const isExtendEligible =
    extensionEligibility?.isEligible ?? extReason === 'Eligible';

  // Determine if option actions are currently actionable (timing check)
  // ONLY applies when this is an option scenario, not for free agents or under contract
  const isOptionActionable =
    actionSet !== 'option' ||
    !normalizedTargetYear ||
    normalizedTargetYear === CURRENT_YEAR + 1;

  // Get the timing error message for display - ONLY for option scenarios
  const optionTimingError =
    actionSet === 'option' && !isOptionActionable && normalizedTargetYear
      ? normalizedTargetYear < CURRENT_YEAR + 1
        ? `This option has already been decided (past season)`
        : `Cannot act on this option yet. It can be decided during the ${normalizedTargetYear - 2}-${String((normalizedTargetYear - 1) % 100).padStart(2, '0')} offseason.`
      : null;

  const resolvedSignAndTradeInitiation = useMemo<SignAndTradeInitiation | null>(() => {
    if (signAndTradeInitiation) {
      return signAndTradeInitiation;
    }

    if (onSignAndTrade && getSignAndTradePreflight) {
      return {
        onSignAndTrade,
        getSignAndTradePreflight,
      };
    }

    return null;
  }, [getSignAndTradePreflight, onSignAndTrade, signAndTradeInitiation]);
  const signAndTradeActionDisabledReason =
    !resolvedSignAndTradeInitiation
      ? 'Sign-and-trade requires an active world to commit.'
      : null;
  const resolvedDestinationTeamCode =
    selectedAction === 'signAndTrade' && destinationTeamId
      ? resolveTeamCode(String(destinationTeamId)) || String(destinationTeamId)
      : null;


  const { signAndTradePreflight, offerSheetPreflight } =
    useEditContractModalPreflight({
      isOpen,
      selectedAction,
      player,
      resolvedSignAndTradeInitiation,
      resolvedDestinationTeamCode,
      signAndTradeActionDisabledReason,
      signAndTradeDispatchPayload,
      resolvedOfferSheetInitiation,
      offerSheetDispatchPayload,
      isOfferSheet,
    });

  const validationAuthority: ValidationAuthority =
    selectedAction === 'signAndTrade' ||
    (selectedAction === 'signNew' && isOfferSheet)
      ? 'authoritative-preflight'
      : 'advisory-modal';

  const {
    warnings: advisoryWarnings,
    errors: advisoryErrors,
    isValid: isAdvisoryValid,
    incomplete: advisoryIncomplete,
  } = useCapValidation({
    player,
    action: validationAuthority === 'advisory-modal' ? selectedAction : null,
    contractData: contractDataForValidation,
    teamCapSheet,
    currentYear: isSigningAction ? ACTION_YEAR : CURRENT_YEAR,
    targetYear: normalizedTargetYear,
    rulesProfile: playerRulesProfile,
  });
  const validationState = useMemo(() => {
    if (!selectedAction) {
      return DEFAULT_VALIDATION_STATE;
    }

    if (validationAuthority === 'authoritative-preflight') {
      return buildAuthoritativePreflightState({
        kind: selectedAction === 'signAndTrade' ? 'sign-and-trade' : 'offer-sheet',
        preflight:
          selectedAction === 'signAndTrade'
            ? signAndTradePreflight
            : offerSheetPreflight,
      });
    }

    return buildAdvisoryModalValidationState({
      isValid: isAdvisoryValid,
      errors: advisoryErrors,
      warnings: advisoryWarnings,
      isExtendEligible,
      selectedAction,
      incomplete: advisoryIncomplete,
    });
  }, [
    advisoryErrors,
    advisoryIncomplete,
    advisoryWarnings,
    isAdvisoryValid,
    isExtendEligible,
    offerSheetPreflight,
    selectedAction,
    signAndTradePreflight,
    validationAuthority,
  ]);
  const validationCopy = useMemo(
    () => buildValidationCopy(validationState.authority),
    [validationState.authority]
  );

  // Primary button is disabled if:
  // 1. No action selected
  // 2. Action is illegal AND override not confirmed
  // Environment flag to enable CBA override feature
  // In production, this should be false to prevent illegal state creation
  // Set VITE_ENABLE_CBA_OVERRIDE=true in .env for development/sandbox mode
  const canOverride = import.meta.env.VITE_ENABLE_CBA_OVERRIDE === 'true';

  const parsedBuyoutAmount = useMemo(() => {
    const trimmed = String(buyoutAmountInput || '').trim();
    if (!trimmed) return null;
    const amount = Number(trimmed);
    if (!Number.isFinite(amount) || amount < 0) return null;
    return amount;
  }, [buyoutAmountInput]);

  const buyoutAmountIsValid =
    selectedAction !== 'buyout' ||
    (parsedBuyoutAmount != null &&
      parsedBuyoutAmount <= remainingGuaranteedForBuyout);
  const disableConfirm =
    !selectedAction ||
    (selectedAction === 'signAndTrade' && !resolvedDestinationTeamCode) ||
    validationState.incomplete ||
    (!validationState.isLegal &&
      !validationState.incomplete &&
      (validationState.authority === 'authoritative-preflight' ||
        !canOverride ||
        !isOverrideConfirmed)) ||
    !buyoutAmountIsValid ||
    isSubmitting;

  const showOverrideOption =
    canOverride &&
    selectedAction &&
    validationState.authority === 'advisory-modal' &&
    !validationState.isLegal &&
    !validationState.incomplete;

  useEffect(() => {
    if (
      selectedAction &&
      (validationState.warnings.length > 0 || validationState.errors.length > 0)
    ) {
      setShowValidationErrors(true);
    } else {
      setShowValidationErrors(false);
    }
  }, [selectedAction, validationState.errors, validationState.warnings]);

  // Reset override state when action changes or modal closes
  useEffect(() => {
    setShowAdvanced(false);
    setOverrideText('');
    setDestinationTeamId(null);
    setSaveError('');
    setIsSubmitting(false);
    if (selectedAction !== 'buyout') {
      setBuyoutAmountInput('');
    }
  }, [selectedAction, isOpen]);

  const confirmButtonLabel = useMemo(() => {
    if (isSubmitting) {
      return 'Saving...';
    }

    if (validationState.isLegal) {
      return 'Confirm Action';
    }

    if (validationState.incomplete && !isOverrideConfirmed) {
      return validationCopy.incompleteButtonLabel;
    }

    if (isOverrideConfirmed) {
      return '⚠️ Force Override';
    }

    return validationCopy.blockedButtonLabel;
  }, [isOverrideConfirmed, isSubmitting, validationCopy, validationState]);

  // Contract Summary Calculations
  const summary = useMemo(() => {
    const totalValue = contractYears.reduce((sum, y) => sum + y.salary, 0);
    const totalYears = contractYears.length;

    // Remaining = current season + future years
    const remainingYearsList = contractYears.filter(
      (y) => y.year >= CURRENT_YEAR
    );
    const remainingValue = remainingYearsList.reduce(
      (sum, y) => sum + y.salary,
      0
    );
    const remainingYears = remainingYearsList.length;

    // Extension calculations
    const extensionYearsList = contractYears.filter((y) => y.isExtension);
    const extensionValue = extensionYearsList.reduce(
      (sum, y) => sum + y.salary,
      0
    );
    const extensionYears = extensionYearsList.length;

    return {
      totalValue,
      totalYears,
      remainingValue,
      remainingYears,
      extensionValue,
      extensionYears,
    };
  }, [contractYears, CURRENT_YEAR]);



  const dispatchSelectedFreeAgencyAction = useCallback(
    async (
      overrideMetadata: OverrideMetadataLike | null
    ): Promise<ActionResultLike> => {
      if (!player) {
        return {
          success: false,
          message: 'Player is required before this contract action can be saved.',
        };
      }

      if (isOfferSheet && selectedAction === 'signNew') {
        return resolvedOfferSheetInitiation?.onStoreOfferSheet?.(
          player,
          buildOfferSheetDispatchPayload({
            ...(overrideMetadata || {}),
          })
        );
      }

      switch (selectedAction) {
        case 'signNew':
          return onSignFreeAgent?.(
            player,
            buildSigningDispatchPayload({
              ...(overrideMetadata || {}),
            })
          );
        case 'resign':
          return onResign?.(
            player,
            buildSigningDispatchPayload({
              ...(overrideMetadata || {}),
            })
          );
        case 'signAndTrade':
          if (!resolvedDestinationTeamCode) {
            return {
              success: false,
              message: 'Destination team is required for sign-and-trade.',
            };
          }

          return resolvedSignAndTradeInitiation?.onSignAndTrade?.(
            player,
            overrideMetadata
              ? {
                  ...signAndTradeDispatchPayload,
                  ...overrideMetadata,
                }
              : signAndTradeDispatchPayload,
            resolvedDestinationTeamCode
          );
        default:
          return undefined;
      }
    },
    [
      buildOfferSheetDispatchPayload,
      buildSigningDispatchPayload,
      isOfferSheet,
      onResign,
      onSignFreeAgent,
      player,
      resolvedOfferSheetInitiation,
      resolvedSignAndTradeInitiation,
      resolvedDestinationTeamCode,
      selectedAction,
      signAndTradeDispatchPayload,
    ]
  );

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setSaveError('');

    if (!player) {
      setSaveError(
        'Player is required before this contract action can be saved.'
      );
      return;
    }

    if (selectedAction === 'buyout' && !buyoutAmountIsValid) {
      setSaveError(
        `Enter a buyout amount between 0 and ${formatCurrencyFull(
          remainingGuaranteedForBuyout
        )}.`
      );
      return;
    }

    setIsSubmitting(true);
    const timestamp = new Date().toISOString();
    const overrideUsed =
      validationState.authority === 'advisory-modal' &&
      !validationState.isLegal &&
      isOverrideConfirmed;
    if (overrideUsed && onAuditLog) {
      onAuditLog({
        actionType: selectedAction,
        timestamp,
        reasons: validationState.reasons,
        overrideUsed: true,
        playerId: player?.id || player?.player_id || player?.name,
        playerName: player?.name || player?.displayName,
      });
    }

    const overrideMetadata = overrideUsed
      ? {
          overrideUsed: true,
          overrideReasons: validationState.reasons,
          overrideTimestamp: timestamp,
        }
      : null;

    try {
      let actionResult: ActionResultLike;

      if (
        selectedAction === 'signNew' ||
        selectedAction === 'resign' ||
        selectedAction === 'signAndTrade'
      ) {
        actionResult = await dispatchSelectedFreeAgencyAction(overrideMetadata);
      } else {
        switch (selectedAction) {
          case 'accept':
            actionResult = await onOptionDecision?.(
              player,
              true,
              overrideMetadata,
              normalizedTargetYear
            );
            break;
          case 'decline':
            actionResult = await onOptionDecision?.(
              player,
              false,
              overrideMetadata,
              normalizedTargetYear
            );
            break;
          case 'renounce':
            actionResult = await onRenounce?.(player, overrideMetadata);
            break;
          case 'extend': {
            const startYear = optionYear ? optionYear + 1 : CURRENT_YEAR + 1;
            const contract = generateExtensionContract({
              firstYearSalary: extension.salaries[0] || 0,
              years: extension.years,
              raisePct: extMax?.baseRaisePct || 0.08,
              startYear,
            });
            actionResult = await onExtend?.(player, {
              ...contract,
              ...(overrideMetadata || {}),
            });
            break;
          }
          case 'waive':
            actionResult = await onWaive?.(player, {
              stretch: false,
              buyout: false,
              ...(overrideMetadata || {}),
            });
            break;
          case 'waiveStretch':
            actionResult = await onWaive?.(player, {
              stretch: true,
              buyout: false,
              ...(overrideMetadata || {}),
            });
            break;
          case 'buyout':
            actionResult = await onWaive?.(player, {
              stretch: false,
              buyout: true,
              buyoutAmount: parsedBuyoutAmount ?? 0,
              ...(overrideMetadata || {}),
            });
            break;
          default:
            actionResult = {
              success: false,
              message: 'Select an action first.',
            };
            break;
        }
      }

      const normalizedResult = normalizeContractActionResult(actionResult);
      if (normalizedResult.success) {
        onClose();
        return;
      }

      setSaveError(
        normalizedResult.message ||
          'Action was not completed. Review details and try again.'
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to save this action. Please try again.';
      setSaveError(
        errorMessage || 'Failed to save this action. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!player) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent
        data-testid="edit-contract-modal"
        className="max-w-6xl w-[95vw] bg-[#0f0f0f] border-2 border-white/20 rounded-xl shadow-2xl shadow-black/50 p-0 overflow-hidden flex flex-col lg:flex-row min-h-[500px] max-h-[85vh]"
      >
        <ContractSummaryPanel
          summary={summary}
          contractYears={contractYears}
          currentYear={CURRENT_YEAR}
        />

        {/* === RIGHT PANEL: Actions === */}
        <div className="w-full lg:w-[65%] p-8 bg-[#0f0f0f] flex flex-col overflow-y-auto">
          <h2 className="text-xl font-bold text-white mb-6">
            Available Actions
          </h2>

          {/* Context Text */}
          <div className="mb-6 text-sm text-white/70 leading-relaxed">
            {hasOption && (
              <p>
                <span className="text-white font-semibold">{player.name}</span>{' '}
                has a <span className="text-orange-400">{optionType}</span> for
                the{' '}
                {optionYear
                  ? `${optionYear - 1}-${String(optionYear % 100).padStart(2, '0')}`
                  : 'upcoming'}{' '}
                season. You may choose to accept it to retain him, decline it to
                make him a Free Agent, or negotiate a new contract.
              </p>
            )}
            {actionSet === 'freeAgent' && (
              <p>
                <span className="text-white font-semibold">{player.name}</span>{' '}
                is currently a Free Agent (Cap Hold). You can re-sign him using
                Bird Rights (if applicable), renounce his rights to clear cap
                space, or execute a sign-and-trade.
              </p>
            )}
            {actionSet === 'underContract' && isExpiring && (
              <p>
                <span className="text-white font-semibold">{player.name}</span>{' '}
                is on an expiring contract. You can extend his deal if eligible,
                or waive him to clear a roster spot (with potential dead cap
                implications). He will become a free agent after this season.
              </p>
            )}
            {actionSet === 'underContract' && !isExpiring && (
              <p>
                <span className="text-white font-semibold">{player.name}</span>{' '}
                is under contract. You can extend his deal if eligible, or waive
                him to clear a roster spot (with potential dead cap
                implications).
              </p>
            )}
          </div>

          {/* Action Selection */}
          <div className="space-y-3 mb-6">
            {/* Show timing error for future options immediately */}
            {optionTimingError && (
              <div className="flex items-start gap-2 px-3 py-2 rounded border bg-red-500/10 border-red-500/30 mb-3">
                <span className="shrink-0 text-sm">❌</span>
                <span className="text-xs text-red-300">
                  {optionTimingError}
                </span>
              </div>
            )}

            {actions.map((type) => {
              // Option actions (accept/decline) are disabled when not actionable
              const isOptionAction = type === 'accept' || type === 'decline';
              const extendBlocked = type === 'extend' && !isExtendEligible;
              const signAndTradeBlocked =
                type === 'signAndTrade' && !!signAndTradeActionDisabledReason;
              const isDisabled =
                (isOptionAction && !isOptionActionable) ||
                extendBlocked ||
                signAndTradeBlocked;

              return (
                <label
                  key={type}
                  className={`flex items-start gap-3 p-3 rounded border transition-all ${
                    isDisabled
                      ? 'cursor-not-allowed opacity-40 bg-white/[0.01] border-white/5'
                      : selectedAction === type
                        ? 'bg-orange-500/10 border-orange-500/50 cursor-pointer'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/5 cursor-pointer'
                  }`}
                >
                  <input
                    type="radio"
                    value={type}
                    data-testid={ACTION_TEST_IDS[type] || undefined}
                    checked={selectedAction === type}
                    onChange={() => !isDisabled && setSelectedAction(type)}
                    disabled={isDisabled}
                    className="mt-1 accent-orange-500 disabled:opacity-50"
                  />
                  <div>
                    <div
                      className={`font-medium ${
                        isDisabled
                          ? 'text-white/40'
                          : selectedAction === type
                            ? 'text-orange-400'
                            : 'text-white'
                      }`}
                    >
                      {actionLabelsOverride[type] || ACTION_LABELS[type]}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">
                      {ACTION_DESCRIPTIONS[type]}
                      {extendBlocked && (
                        <span className="block text-red-300 mt-1">
                          {playerRulesProfile?.extensionEligibility?.reason ||
                            'Not extension eligible'}
                        </span>
                      )}
                      {signAndTradeBlocked && (
                        <span className="block text-red-300 mt-1">
                          {signAndTradeActionDisabledReason}
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* === Contract Details (Cap Table Row Preview) === */}
          {['signNew', 'resign', 'extend', 'signAndTrade'].includes(
            selectedAction
          ) && (
            <div className="bg-white/5 rounded-lg border border-white/20 p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                  New Contract Preview
                </h4>
                <div className="flex items-center gap-2">
                  <select
                    value={extension.contractType}
                    onChange={(e) =>
                      setExtension({
                        ...extension,
                        contractType: e.target.value,
                      })
                    }
                    className="px-2 py-1 rounded bg-black border border-white/20 text-xs text-white focus:border-orange-500 outline-none"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Rookie Scale">Rookie Scale</option>
                    <option value="Designated veteran">
                      Designated Veteran
                    </option>
                  </select>

                  {['signNew', 'resign'].includes(selectedAction) && (
                    <select
                      value={selectedException}
                      onChange={(e) => setSelectedException(e.target.value)}
                      className="px-2 py-1 rounded bg-black border border-white/20 text-xs text-white focus:border-orange-500 outline-none"
                    >
                      {availableSigningExceptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Phase 16: Offer Sheet Toggle */}
                  {['signNew'].includes(selectedAction) &&
                    resolvedShowOfferSheetToggle && (
                      <label className="flex items-center gap-1.5 cursor-pointer ml-2 bg-black px-2 py-1 rounded border border-white/20 select-none">
                        <input
                          type="checkbox"
                          checked={isOfferSheet}
                          onChange={(e) => setIsOfferSheet(e.target.checked)}
                          className="accent-cyan-500"
                        />
                        <span
                          className={`text-xs font-bold ${isOfferSheet ? 'text-cyan-400' : 'text-white/50'}`}
                        >
                          Offer Sheet
                        </span>
                      </label>
                    )}

                  <select
                    value={extension.years}
                    onChange={(e) => {
                      const guardrailYears =
                        isSigningAction && signingGuardrails?.maxYears
                          ? Math.min(signingGuardrails.maxYears, 5)
                          : null;
                      const maxYearsOption =
                        selectedAction === 'extend' && extMax?.maxYears
                          ? extMax.maxYears
                          : guardrailYears || 5;
                      const yrs = Math.min(
                        Number(e.target.value),
                        maxYearsOption
                      );
                      const raisePct =
                        signingGuardrails?.raisePct ??
                        extension.raisePct ??
                        0.05;
                      const firstYear = isSigningAction
                        ? clampFirstYearToGuardrails(
                            extension.salaries?.[0] ??
                              signingGuardrails?.minFirstYear ??
                              0
                          )
                        : extension.salaries?.[0] || 0;
                      const salaries = isSigningAction
                        ? buildSalarySeries(firstYear, yrs, raisePct)
                        : Array.from(
                            { length: yrs },
                            (_, i) => extension.salaries[i] || 0
                          );
                      setExtension({
                        ...extension,
                        years: yrs,
                        salaries,
                        raisePct,
                      });
                      setSalaryInputs(toSalaryInputs(salaries, yrs));
                    }}
                    className="px-2 py-1 rounded bg-black border border-white/20 text-xs text-white focus:border-orange-500 outline-none"
                  >
                    {[1, 2, 3, 4, 5].map((yr) => {
                      const maxYearsOption =
                        selectedAction === 'extend' && extMax?.maxYears
                          ? extMax.maxYears
                          : isSigningAction && signingGuardrails?.maxYears
                            ? Math.min(signingGuardrails.maxYears, 5)
                            : 5;
                      return (
                        <option
                          key={yr}
                          value={yr}
                          disabled={yr > maxYearsOption}
                        >
                          {yr}yr
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {isSigningAction && signingGuardrails && (
                <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-white/70">
                  <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                    Rights/Exception: {signingGuardrails.source}
                    {playerRulesProfile?.birdRights?.type
                      ? ` (${playerRulesProfile.birdRights.type})`
                      : ''}
                  </span>
                  <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                    First-year range:{' '}
                    {formatCurrencyFull(signingGuardrails.minFirstYear || 0)} -{' '}
                    {signingGuardrails.maxFirstYear != null
                      ? formatCurrencyFull(signingGuardrails.maxFirstYear)
                      : 'Max'}
                  </span>
                  <span className="px-2 py-1 rounded bg-white/5 border border-white/10">
                    Raises up to{' '}
                    {Math.round((signingGuardrails.raisePct || 0) * 100)}% • Max{' '}
                    {signingGuardrails.maxYears || '—'} yrs
                  </span>
                  {playerRulesProfile?.restrictedFreeAgency
                    ?.qualifyingOfferAmount ? (
                    <span className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-100">
                      QO:{' '}
                      {formatCurrencyFull(
                        playerRulesProfile.restrictedFreeAgency
                          .qualifyingOfferAmount
                      )}
                    </span>
                  ) : null}
                </div>
              )}

              {/* Phase 23: Sign & Trade Destination Selector */}
              {selectedAction === 'signAndTrade' && (
                <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <label className="block text-xs font-bold text-blue-200 uppercase tracking-wider mb-2">
                    Destination Team
                  </label>
                  <TeamSelectDropdown
                    selectedTeamId={destinationTeamId}
                    onChange={setDestinationTeamId}
                    valueFormat="teamCode"
                  />
                  <p className="mt-2 text-[11px] text-white/60">
                    The player will be signed to your team, then immediately
                    traded to this destination.
                  </p>
                </div>
              )}

              {/* Salary Inputs Grid */}
              <div className="grid grid-cols-5 gap-2 bg-white/5 rounded-lg p-3">
                {Array.from({ length: 5 }, (_, idx) => {
                  const isActive = idx < extension.years;
                  const year =
                    CURRENT_YEAR + idx + (selectedAction === 'extend' ? 1 : 0);

                  return (
                    <div
                      key={idx}
                      className={`${isActive ? 'opacity-100' : 'opacity-30'}`}
                    >
                      <div className="text-[10px] text-white/50 text-center mb-1 font-medium">
                        {year - 1}-{String(year % 100).padStart(2, '0')}
                      </div>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40 text-xs">
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          disabled={!isActive}
                          value={salaryInputs[idx] || ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '');
                            const parsed = Number(raw);
                            const nextSalaries = (() => {
                              const arr = [...extension.salaries];
                              let nextVal = parsed;
                              if (isSigningAction && signingGuardrails) {
                                if (idx === 0) {
                                  nextVal = clampFirstYearToGuardrails(parsed);
                                } else if (signingGuardrails.raisePct != null) {
                                  const prevSalary = arr[idx - 1] || 0;
                                  const allowed = Math.round(
                                    prevSalary *
                                      (1 + signingGuardrails.raisePct)
                                  );
                                  nextVal = Math.min(parsed || 0, allowed);
                                }
                              }
                              arr[idx] = nextVal;
                              return arr;
                            })();
                            const activeYears =
                              extension.years || nextSalaries.length || 0;
                            setExtension((prev) => ({
                              ...prev,
                              salaries: nextSalaries,
                            }));
                            setSalaryInputs(
                              toSalaryInputs(nextSalaries, activeYears)
                            );
                          }}
                          className="w-full pl-5 pr-2 py-2 rounded bg-black/50 border border-white/10 text-xs text-white font-medium text-center focus:border-cyan-500 focus:bg-cyan-500/10 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Extension Eligibility Note */}
              {selectedAction === 'extend' && (
                <div className="mt-3 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded text-xs text-orange-200 space-y-1">
                  {isExtendEligible && extMax ? (
                    <>
                      <div>
                        {`Up to ${extMax?.maxYears || 0} years — first-year range ${formatCurrencyFull(
                          extMax?.minFirstYearSalary ?? 0
                        )} to ${formatCurrencyFull(
                          extMax?.maxFirstYearSalary ?? 0
                        )}`}
                      </div>
                      <div className="text-[11px] text-orange-100/80">
                        Raises: {Math.round((extMax?.baseRaisePct || 0) * 100)}%
                        {extMax?.basedOn ? ` • ${extMax.basedOn}` : ''}
                      </div>
                      {(extMax?.notes || extMax?.type) && (
                        <div className="text-[11px] text-orange-100/60">
                          {extMax?.notes || extMax?.type}
                        </div>
                      )}
                    </>
                  ) : (
                    <span>
                      {`Not eligible: ${
                        playerRulesProfile?.extensionEligibility?.reason ||
                        extReason
                      }`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Buyout Details */}
          {selectedAction === 'buyout' && (
            <div className="bg-white/5 rounded-lg border border-white/20 p-4 space-y-3">
              <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                Buyout Terms
              </h4>
              <div className="text-xs text-white/70">
                Remaining guaranteed salary:{' '}
                <span className="text-white font-semibold">
                  {formatCurrencyFull(remainingGuaranteedForBuyout)}
                </span>
              </div>
              <div>
                <label
                  htmlFor="buyout-amount-input"
                  className="block text-xs font-medium text-white/80 mb-1"
                >
                  Buyout Amount
                </label>
                <input
                  id="buyout-amount-input"
                  type="number"
                  min={0}
                  max={remainingGuaranteedForBuyout || undefined}
                  step="1000"
                  value={buyoutAmountInput}
                  onChange={(event) => setBuyoutAmountInput(event.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded bg-black/50 border border-white/20 text-sm text-white outline-none focus:border-orange-500"
                />
              </div>
              <div className="text-[11px] text-white/60">
                Resulting dead cap:{' '}
                <span className="text-white">
                  {formatCurrencyFull(
                    Math.max(
                      0,
                      remainingGuaranteedForBuyout - (parsedBuyoutAmount || 0)
                    )
                  )}
                </span>
              </div>
              {!buyoutAmountIsValid && (
                <p className="text-[11px] text-red-300">
                  Enter a value between 0 and{' '}
                  {formatCurrencyFull(remainingGuaranteedForBuyout)}.
                </p>
              )}
            </div>
          )}

          {/* === Validation Warnings === */}
          {selectedAction &&
            (validationState.warnings.length > 0 ||
              validationState.errors.length > 0) && (
              <div className="mt-4 space-y-3">
                <div className="rounded border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-100">
                  <div className="font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                    {validationCopy.disclosureTitle}
                  </div>
                  <p className="mt-1 text-cyan-50/85">
                    {validationCopy.disclosureMessage}
                  </p>
                </div>
                <ValidationWarnings
                  warnings={validationState.warnings}
                  errors={validationState.errors}
                  showErrors={showValidationErrors}
                />
              </div>
            )}

          {/* === Advanced Override Section === */}
          {showOverrideOption && (
            <div className="mt-4 border border-red-500/30 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full px-4 py-3 flex items-center justify-between bg-red-500/10 hover:bg-red-500/20 transition-colors"
              >
                <span className="text-sm font-medium text-red-300">
                  ⚠️ Advanced: Override Validation
                </span>
                <span className="text-red-400 text-sm">
                  {showAdvanced ? '▲' : '▼'}
                </span>
              </button>

              {showAdvanced && (
                <div className="p-4 bg-red-900/10 space-y-4">
                  <div className="text-xs text-red-300/80 space-y-2">
                    <p className="font-semibold text-red-300">
                      {validationCopy.overrideTitle}
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      {validationState.reasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                    <p className="pt-2 border-t border-red-500/20 mt-2">
                      {validationCopy.overrideFootnote}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="override-confirm"
                      className="block text-xs font-medium text-red-300"
                    >
                      Type{' '}
                      <span className="font-mono bg-red-500/20 px-1 rounded">
                        OVERRIDE
                      </span>{' '}
                      to confirm:
                    </label>
                    <input
                      id="override-confirm"
                      type="text"
                      value={overrideText}
                      onChange={(e) => setOverrideText(e.target.value)}
                      placeholder="OVERRIDE"
                      className="w-full px-3 py-2 rounded bg-black/50 border border-red-500/30 text-sm text-white placeholder-red-500/40 focus:border-red-500 focus:outline-none"
                    />
                    {isOverrideConfirmed && (
                      <p className="text-xs text-green-400">
                        ✓ Override confirmed - you may now proceed
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {saveError && (
            <div
              role="alert"
              className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            >
              {saveError}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="mt-auto pt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium rounded bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="edit-contract-confirm-action-button"
              onClick={handleConfirm}
              disabled={disableConfirm}
              className={`px-6 py-2 text-sm font-bold rounded shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                validationState.isLegal
                  ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-900/20'
                  : isOverrideConfirmed
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20'
                    : 'bg-gray-600 text-white/50'
              }`}
            >
              {confirmButtonLabel}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

