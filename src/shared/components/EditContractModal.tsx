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
 *  - 2026-05-31: Added full-width player card header (ContractCardHeader) for player-info card layout.
 *
 * LINKS:
 *  - Plan: plans/_archive/player-rules-architect/plan.md
 *  - Latest Chunk: plans/_archive/player-rules-architect/chunks/chunk_02.md
 *
 * TODO: Track consolidation progress in ARCHITECT_PHASE5_HARDENING.md Step 6
 *
 * REVISIT (2026-05-31): This modal's layout/visual design is NOT up to standard
 *   and needs a proper redesign pass. Known rough edges: the header + summary +
 *   action columns are fitted to height by hand (tight spacing, no scroll) and
 *   can still feel cramped on short viewports for long contracts; the overall
 *   look is functional but not polished. Treat the current header as interim,
 *   not the final design. Revisit holistically rather than with spot tweaks.
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
import { ContractCardHeader } from './EditContractModal.PlayerCardHeader';
import { ContractActionSelector } from './EditContractModal.ActionSelector';
import { ContractActionContext } from './EditContractModal.ActionContext';
import { ContractDetailsForm } from './EditContractModal.DetailsForm';
import {
  calculateCapHold,
  type CapHoldPlayerInput,
} from '@/features/architect/utils/capHolds';
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
  actionDescriptionsOverride = {},
  actionContextCopy = null,
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
  const actionSeasonLabel = `${ACTION_YEAR - 1}-${String(ACTION_YEAR % 100).padStart(
    2,
    '0'
  )}`;

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
  const extensionStartYear = useMemo(() => {
    const latestContractEndYear = contractYears.reduce(
      (latestYear, yearEntry) => Math.max(latestYear, yearEntry.year),
      Number.NEGATIVE_INFINITY
    );
    const nextYearAfterContract = Number.isFinite(latestContractEndYear)
      ? latestContractEndYear + 1
      : CURRENT_YEAR + 1;

    return Math.max(nextYearAfterContract, CURRENT_YEAR + 1);
  }, [CURRENT_YEAR, contractYears]);

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

  // Seed the selected action from initialAction (e.g. a clicked cap-table cell or
  // a sign-and-trade hand-off) so the modal opens straight on that action's form
  // instead of the action picker. Resets to the picker when no initialAction is
  // given or the player changes. (Restored after the form-hook extraction dropped
  // this from the shared reset effect.)
  useEffect(() => {
    if (!player) return;
    setSelectedAction(
      initialAction && isContractActionKey(initialAction) ? initialAction : ''
    );
  }, [player, initialAction]);

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
  const playerDisplayName =
    player?.displayName ||
    player?.name ||
    player?.bio?.displayName ||
    'Selected player';
  const selectedActionLabel = selectedAction
    ? actionLabelsOverride[selectedAction] || ACTION_LABELS[selectedAction]
    : null;
  const actionContextTitle = selectedActionLabel || 'Choose contract action';
  const actionContextStageLabel = selectedActionLabel
    ? 'Editing terms'
    : 'Choosing action';
  const extensionEligibility = playerRulesProfile?.extensionEligibility;
  const isExtendEligible =
    extensionEligibility?.isEligible ?? extReason === 'Eligible';

  // Free-agency rows for the year-by-year summary: the season the player hits
  // free agency, carrying the qualifying offer (RFA) and/or the cap hold — shown
  // inline in that season's row, the way a salary would be, just tagged.
  const freeAgencyYears = useMemo(() => {
    if (!player) return [];
    const rfa = playerRulesProfile?.restrictedFreeAgency;
    // freeAgencyYear lives on the full rules profile's contractSummary (present
    // at runtime; the modal's prop type is narrowed), with player.freeAgentYear
    // as a fallback.
    const faStartRaw =
      (
        playerRulesProfile as unknown as {
          contractSummary?: { freeAgencyYear?: number | null };
        } | null
      )?.contractSummary?.freeAgencyYear ?? player.freeAgentYear;
    const faStartYear = faStartRaw == null ? null : Number(faStartRaw);
    if (faStartYear == null || !Number.isFinite(faStartYear)) return [];
    const capHold = calculateCapHold(player as unknown as CapHoldPlayerInput);
    const qualifyingOffer =
      rfa?.qualifyingOfferAmount != null && rfa.qualifyingOfferAmount > 0
        ? rfa.qualifyingOfferAmount
        : null;
    const capHoldAmount =
      capHold?.active && capHold.amount > 0 ? capHold.amount : null;
    if (qualifyingOffer == null && capHoldAmount == null) return [];
    const endYear = faStartYear + 1;
    return [
      {
        year: endYear,
        season: `${faStartYear}-${String(endYear % 100).padStart(2, '0')}`,
        qualifyingOffer,
        capHold: capHoldAmount,
        isRFA: rfa?.isRFA ?? qualifyingOffer != null,
      },
    ];
  }, [player, playerRulesProfile]);

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

  // Plain-language "why is Confirm unavailable" line shown next to the button so
  // the disabled state is never a mystery. Presentational only — mirrors the
  // disableConfirm predicate above, it does not gate the action itself.
  const confirmDisabledReason = isSubmitting
    ? null
    : !selectedAction
      ? 'Select an action to continue'
      : selectedAction === 'signAndTrade' && !resolvedDestinationTeamCode
        ? 'Choose a destination team'
        : !buyoutAmountIsValid
          ? 'Enter a valid buyout amount'
          : validationState.incomplete
            ? 'Finish the contract details to continue'
            : !validationState.isLegal && !isOverrideConfirmed
              ? 'Resolve the blocking issues above to continue'
              : null;

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
            const contract = generateExtensionContract({
              firstYearSalary: extension.salaries[0] || 0,
              years: extension.years,
              raisePct: extension.raisePct ?? extMax?.baseRaisePct ?? 0.08,
              startYear: extensionStartYear,
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
        className="max-w-6xl w-[95vw] bg-[#0f0f0f] border-2 border-white/20 rounded-xl shadow-2xl shadow-black/50 p-0 overflow-hidden flex flex-col min-h-[500px] max-h-[85vh]"
      >
        {/* === TOP: Player identity banner (spans both columns) === */}
        <ContractCardHeader
          player={player}
          teamCode={teamCapSheet?.teamCode ?? null}
        />

        <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
          <ContractSummaryPanel
            summary={summary}
            contractYears={contractYears}
            currentYear={CURRENT_YEAR}
            freeAgencyYears={freeAgencyYears}
          />

          {/* === RIGHT PANEL: Actions === */}
          {/* Footer stays pinned below the scrollable action content so
              Cancel/Confirm never leave the viewport at short (720p) heights. */}
          <div className="w-full lg:w-[65%] bg-[#0f0f0f] flex min-h-0 flex-col">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-8 pb-2">
          <h2 className="text-xl font-bold text-white mb-4">
            Available Actions
          </h2>

          <ContractActionContext
            title={actionContextTitle}
            stageLabel={actionContextStageLabel}
            playerName={playerDisplayName}
            seasonLabel={actionSeasonLabel}
          />

          <ContractActionSelector
            playerName={playerDisplayName}
            hasOption={hasOption}
            actionSet={actionSet}
            isExpiring={isExpiring}
            optionType={optionType}
            optionYear={optionYear}
            optionTimingError={optionTimingError}
            actions={actions}
            isExtendEligible={isExtendEligible}
            signAndTradeActionDisabledReason={signAndTradeActionDisabledReason}
            isOptionActionable={isOptionActionable}
            selectedAction={selectedAction}
            onSelectAction={setSelectedAction}
            actionLabelsOverride={actionLabelsOverride}
            actionDescriptionsOverride={actionDescriptionsOverride}
            actionContextCopy={actionContextCopy}
            extensionEligibilityReason={playerRulesProfile?.extensionEligibility?.reason}
          />

          <ContractDetailsForm
            selectedAction={selectedAction}
            isSigningAction={isSigningAction}
            extension={extension}
            setExtension={setExtension}
            salaryInputs={salaryInputs}
            setSalaryInputs={setSalaryInputs}
            selectedException={selectedException}
            setSelectedException={setSelectedException}
            isOfferSheet={isOfferSheet}
            setIsOfferSheet={setIsOfferSheet}
            destinationTeamId={destinationTeamId}
            setDestinationTeamId={setDestinationTeamId}
            buyoutAmountInput={buyoutAmountInput}
            setBuyoutAmountInput={setBuyoutAmountInput}
            extMax={extMax}
            extReason={extReason}
            isExtendEligible={isExtendEligible}
            availableSigningExceptions={availableSigningExceptions}
            signingGuardrails={signingGuardrails}
            remainingGuaranteedForBuyout={remainingGuaranteedForBuyout}
            parsedBuyoutAmount={parsedBuyoutAmount}
            buyoutAmountIsValid={buyoutAmountIsValid}
            CURRENT_YEAR={CURRENT_YEAR}
            extensionStartYear={extensionStartYear}
            resolvedShowOfferSheetToggle={resolvedShowOfferSheetToggle}
            playerRulesProfile={playerRulesProfile}
            clampFirstYearToGuardrails={clampFirstYearToGuardrails}
            buildSalarySeries={buildSalarySeries}
            toSalaryInputs={toSalaryInputs}
          />

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

          </div>

          {/* Footer Buttons */}
          <div className="flex shrink-0 items-center gap-3 px-8 py-4">
            {disableConfirm && confirmDisabledReason && (
              <span
                data-testid="edit-contract-confirm-disabled-reason"
                className="mr-auto text-xs text-amber-300/80"
              >
                {confirmDisabledReason}
              </span>
            )}
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="ml-auto px-4 py-2 text-sm font-medium rounded bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              Cancel
            </button>
            <button
              data-testid="edit-contract-confirm-action-button"
              onClick={handleConfirm}
              disabled={disableConfirm}
              aria-disabled={disableConfirm}
              title={disableConfirm ? confirmDisabledReason ?? undefined : undefined}
              className={`px-6 py-2 text-sm font-bold rounded shadow-lg transition-all ${
                disableConfirm
                  ? 'cursor-not-allowed bg-white/[0.06] text-white/35 shadow-none ring-1 ring-inset ring-white/10'
                  : isOverrideConfirmed
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/20'
                    : 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-900/20'
              }`}
            >
              {confirmButtonLabel}
            </button>
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
