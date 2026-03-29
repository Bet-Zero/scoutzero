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
  useRef,
} from 'react';
import { Dialog, DialogContent } from '@/shared/components/ui/Dialog';
import { formatCurrencyFull, formatCurrency } from '@/shared/utils/formatting';
import { getCapSettings } from '@/features/architect/utils/capHelpers';
import {
  generateExtensionContract,
  getContractYearsForDisplay,
} from '@/features/architect/utils/contractUtils';
import type { CapProjectionOverrides } from '@/features/architect/utils/capRulesProfile';
import type { CapHoldItem, DeadCapItem } from '@/features/architect/types';
import { toSeasonCode } from '@/features/architect/utils/seasonFormat';
import {
  getExtensionProfile,
  buildMinimalRuleContext,
} from '@/features/architect/utils/salaryEngine';
import useCapValidation, {
  buildSigningGuardrails,
} from '@/features/architect/hooks/useCapValidation';
import type {
  ArchitectMutationResult,
  SignAndTradePreflightResult,
  OfferSheetPreflightResult,
} from '@/features/architect/utils/mutationPipeline';
import type { PlayerRulesProfileLeagueContext } from '@/features/architect/types';
import ValidationWarnings from '@/features/architect/shared/ValidationWarnings';
import TeamSelectDropdown from '@/shared/components/TeamSelectDropdown';
import { resolveTeamCode } from '@/features/architect/utils/worldTeamData';

type UseCapValidationParams = Parameters<typeof useCapValidation>[0];
type HookPlayerLike = NonNullable<UseCapValidationParams['player']>;
type HookContractLike = NonNullable<HookPlayerLike['contract']>;
type HookContractSalaryRowLike = NonNullable<
  HookContractLike['salariesByYear']
>[number];
type HookTeamCapSheetLike = NonNullable<
  UseCapValidationParams['teamCapSheet']
>;
type HookContractDataLike = NonNullable<
  UseCapValidationParams['contractData']
>;
type UseCapValidationResult = ReturnType<typeof useCapValidation>;
type ValidationEntryLike = UseCapValidationResult['warnings'][number];
type ValidationSeverity = ValidationEntryLike['severity'];
type SignAndTradePreflightLike = SignAndTradePreflightResult | null;
type OfferSheetPreflightLike = OfferSheetPreflightResult | null;
type ContractYearLike = NonNullable<
  ReturnType<typeof getContractYearsForDisplay>[number]
>;
type ContractActionKey =
  | 'accept'
  | 'decline'
  | 'signNew'
  | 'resign'
  | 'signAndTrade'
  | 'renounce'
  | 'extend'
  | 'waive'
  | 'waiveStretch'
  | 'buyout';
type SelectedContractAction = ContractActionKey | '';

type PlayerBioLike = {
  playerId?: string | null;
  displayName?: string | null;
  age?: number | string | null;
  position?: string | null;
  height?: number | string | null;
  weight?: number | string | null;
  display?: {
    freeAgentType?: string | null;
    freeAgentYear?: number | null;
    teamId?: string | null;
    team?: string | null;
  } | null;
  experience?: unknown;
  draftYear?: unknown;
  draftRound?: unknown;
  draftPick?: unknown;
};

type ContractSalaryRowLike = HookContractSalaryRowLike & {
  season?: string | null;
  year?: string | number | null;
  option?: string | null;
  isExtension?: boolean | null;
};

type ContractLike = HookContractLike & {
  salariesByYear?: ContractSalaryRowLike[] | null;
  isRookieScale?: boolean | null;
  contractType?: string | null;
};

type PlayerLike = HookPlayerLike & {
  id?: string | number | null;
  player_id?: string | number | null;
  playerId?: string | number | null;
  name?: string | null;
  displayName?: string | null;
  yearsOfService?: number | null;
  yearsPro?: unknown;
  bio?: PlayerBioLike | null;
  contract?: ContractLike | null;
  futureContract?: ContractLike | null;
  freeAgentYear?: number | null;
};

type SigningGuardrailsLike = HookContractDataLike['guardrails'] | null;
type CapHoldLike = Partial<CapHoldItem> & {
  active?: boolean | null;
  reason?: string | null;
};
type DeadCapLike = Partial<DeadCapItem> & {
  label?: string | null;
  amountByYear?: DeadCapItem['amountByYear'] | null;
  stretched?: boolean | null;
};

type ExtensionStateLike = {
  years: number;
  contractType: string;
  salaries: number[];
  raisePct?: number;
};

type PlayerRulesProfileLike = UseCapValidationParams['rulesProfile'];

/** Narrowed state for extension max terms (replaces LooseRecord for extMax state) */
type ExtMaxState = {
  maxYears: number | null | undefined;
  maxFirstYearSalary: number | null | undefined;
  minFirstYearSalary: number | null | undefined;
  baseRaisePct: number | null | undefined;
  type?: string | null;
  basedOn?: string | null;
  notes?: string | null;
};

type RulesLeagueContextLike = Pick<
  PlayerRulesProfileLeagueContext,
  'simulationDate' | 'currentYear'
> | null;

type TeamCapSheetLike = HookTeamCapSheetLike & {
  teamCode?: string | null;
  players?: PlayerLike[] | null;
  deadCap?: DeadCapLike[] | null;
  capHolds?: CapHoldLike[] | null;
};

type OverrideMetadataLike = {
  overrideUsed: boolean;
  overrideReasons: string[];
  overrideTimestamp: string;
};

type AuditLogEntryLike = {
  actionType: string;
  timestamp: string;
  reasons: string[];
  overrideUsed: boolean;
  playerId?: string | number | null;
  playerName?: string | null;
};

type MutationWritesSummaryLike = Partial<
  NonNullable<ArchitectMutationResult['writesSummary']>
>;

type ContractActionResultLike = Pick<
  ArchitectMutationResult,
  'success' | 'error' | 'appliedToLocalState' | 'persistedToWorld'
> & {
  message?: string | null;
  writesSummary?: MutationWritesSummaryLike | null;
};

type ActionResultLike =
  | ContractActionResultLike
  | boolean
  | null
  | undefined;

type SigningPayloadLike = {
  years: number;
  contractType: string;
  salaries: number[];
  raisePct?: number;
  contractYears: number;
  salariesByYear: Array<{
    season: string;
    salary: number;
    capHit: number;
    guaranteed: boolean;
    option: string | null;
    optionType: string | null;
    optionUsed: boolean | null;
  }>;
  base: number;
  totalValue: number;
  averageAnnualValue: number;
  firstYearGuaranteed: boolean;
  exceptionType: string;
  signedUsing: string | null;
  guardrails: SigningGuardrailsLike;
  signAndTrade?: boolean;
  rfaOfferSheet?: boolean;
  rfaOfferSheetOnly?: boolean;
  rfaOfferSheetStatus?: string;
} & Partial<OverrideMetadataLike>;

type ExtensionPayloadLike = ReturnType<typeof generateExtensionContract> &
  Partial<OverrideMetadataLike>;

type WaivePayloadLike = {
  stretch: boolean;
  buyout: boolean;
  buyoutAmount?: number;
} & Partial<OverrideMetadataLike>;

type SigningActionCallback = (
  player: PlayerLike,
  payload: SigningPayloadLike,
) => Promise<ActionResultLike | undefined> | ActionResultLike | undefined;

type OptionDecisionCallback = (
  player: PlayerLike,
  accept: boolean,
  overrideMetadata?: OverrideMetadataLike | null,
) => Promise<ActionResultLike | undefined> | ActionResultLike | undefined;

type SignAndTradeCallback = (
  player: PlayerLike,
  payload: SigningPayloadLike,
  destTeamCode: string,
) => Promise<ActionResultLike | undefined> | ActionResultLike | undefined;

type SignAndTradePreflightCallback = (
  player: PlayerLike,
  payload: SigningPayloadLike,
  destTeamCode: string,
) =>
  | Promise<SignAndTradePreflightResult | null | undefined>
  | SignAndTradePreflightResult
  | null
  | undefined;

type GetOfferSheetPreflightCallback = (
  player: PlayerLike,
  payload: SigningPayloadLike,
) =>
  | Promise<OfferSheetPreflightResult | null | undefined>
  | OfferSheetPreflightResult
  | null
  | undefined;

type ExtendCallback = (
  player: PlayerLike,
  payload: ExtensionPayloadLike,
) => Promise<ActionResultLike | undefined> | ActionResultLike | undefined;

type WaiveCallback = (
  player: PlayerLike,
  payload: WaivePayloadLike,
) => Promise<ActionResultLike | undefined> | ActionResultLike | undefined;

type SimpleActionCallback = (
  player: PlayerLike,
  overrideMetadata?: OverrideMetadataLike | null,
) => Promise<ActionResultLike | undefined> | ActionResultLike | undefined;

type AuditLogCallback = (entry: AuditLogEntryLike) => void;
type ActionSetKey = 'option' | 'freeAgent' | 'underContract';

type EditContractModalProps = {
  player?: PlayerLike | null;
  isOpen?: boolean;
  onClose: () => void;
  onSave?: SigningActionCallback | null;
  onSignFreeAgent?: SigningActionCallback | null;
  onResign?: SigningActionCallback | null;
  onWaive?: WaiveCallback | null;
  onOptionDecision?: OptionDecisionCallback | null;
  onExtend?: ExtendCallback | null;
  onSignAndTrade?: SignAndTradeCallback | null;
  getSignAndTradePreflight?: SignAndTradePreflightCallback | null;
  getOfferSheetPreflight?: GetOfferSheetPreflightCallback | null;
  onRenounce?: SimpleActionCallback | null;
  onStoreOfferSheet?: SigningActionCallback | null;
  initialAction?: string | null;
  targetYear?: number | null;
  actionContext?: ActionSetKey | null;
  teamCapSheet?: TeamCapSheetLike;
  currentYear?: number | null;
  playerRulesProfile?: PlayerRulesProfileLike;
  rulesLeagueContext?: RulesLeagueContextLike;
  actionsOverride?: string[] | null;
  actionLabelsOverride?: Partial<Record<ContractActionKey, string>>;
  onAuditLog?: AuditLogCallback | null;
  capProjections?: CapProjectionOverrides | null;
  playersMap?: Record<string, PlayerLike> | null;
};

type ValidationAuthority = 'advisory-modal' | 'authoritative-preflight';
type AuthoritativePreflightKind = 'sign-and-trade' | 'offer-sheet';

type ValidationStateLike = {
  authority: ValidationAuthority;
  isLegal: boolean;
  incomplete: boolean;
  reasons: string[];
  severity: ValidationSeverity;
  warnings: ValidationEntryLike[];
  errors: ValidationEntryLike[];
};

type NormalizedContractActionResult = {
  success: boolean;
  message: string;
};

const DEFAULT_VALIDATION_STATE: ValidationStateLike = {
  authority: 'advisory-modal',
  isLegal: true,
  incomplete: false,
  reasons: [],
  severity: 'info',
  warnings: [],
  errors: [],
};

const ADVISORY_MODAL_INCOMPLETE_MESSAGE =
  'Modal guardrails incomplete — some UI checks could not be evaluated.';

const buildAdvisoryModalValidationState = ({
  isValid,
  errors,
  warnings,
  isExtendEligible,
  selectedAction,
  incomplete,
}: {
  isValid: boolean;
  errors: ValidationEntryLike[];
  warnings: ValidationEntryLike[];
  isExtendEligible: boolean;
  selectedAction: SelectedContractAction;
  incomplete?: boolean;
}): ValidationStateLike => {
  const reasons: string[] = [];
  let maxSeverity: ValidationSeverity = 'info';
  const normalizedWarnings = incomplete
    ? [
        ...warnings.filter(
          (entry) =>
            entry.message !==
            'Extension validation skipped: rulesProfile not provided'
        ),
        {
          severity: 'warning' as const,
          message: ADVISORY_MODAL_INCOMPLETE_MESSAGE,
        },
      ]
    : warnings;

  errors.forEach((e) => {
    reasons.push(e.message || '');
    if (e.severity === 'error') maxSeverity = 'error';
    else if (e.severity === 'warning' && maxSeverity !== 'error')
      maxSeverity = 'warning';
  });

  if (selectedAction === 'extend' && !isExtendEligible) {
    reasons.push('Player is not extension eligible');
    maxSeverity = 'error';
  }

  if (incomplete) {
    reasons.push(ADVISORY_MODAL_INCOMPLETE_MESSAGE);
    if (maxSeverity !== 'error') maxSeverity = 'warning';
  }

  normalizedWarnings.forEach((w) => {
    if (w.severity === 'warning') {
      reasons.push(w.message || '');
      if (maxSeverity !== 'error') maxSeverity = 'warning';
    }
  });

  const isLegal =
    isValid && !incomplete && (selectedAction !== 'extend' || isExtendEligible);

  return {
    authority: 'advisory-modal',
    isLegal,
    incomplete: !!incomplete,
    reasons,
    severity: maxSeverity,
    warnings: normalizedWarnings,
    errors,
  };
};

const getAuthoritativePreflightUnavailableMessage = (
  kind: AuthoritativePreflightKind
) =>
  kind === 'sign-and-trade'
    ? 'Authoritative sign-and-trade preflight is unavailable.'
    : 'Authoritative offer sheet preflight is unavailable.';

const buildAuthoritativePreflightState = ({
  kind,
  preflight,
}: {
  kind: AuthoritativePreflightKind;
  preflight: SignAndTradePreflightLike | OfferSheetPreflightLike;
}): ValidationStateLike => {
  const warnings: ValidationEntryLike[] = [];
  const errors: ValidationEntryLike[] = [];
  const reasons: string[] = [];
  const normalizedPreflight = preflight;

  if (!normalizedPreflight) {
    const message = getAuthoritativePreflightUnavailableMessage(kind);
    warnings.push({
      severity: 'warning',
      message,
    });

    return {
      authority: 'authoritative-preflight',
      isLegal: false,
      incomplete: true,
      reasons: [message],
      severity: 'warning',
      warnings,
      errors,
    };
  }

  normalizedPreflight.warnings.forEach((message) => {
    warnings.push({
      severity: 'warning',
      message,
    });
  });

  if (normalizedPreflight.status === 'blocked') {
    normalizedPreflight.reasons.forEach((message) => {
      errors.push({
        severity: 'error',
        message,
      });
      reasons.push(message);
    });

    return {
      authority: 'authoritative-preflight',
      isLegal: false,
      incomplete: false,
      reasons,
      severity: 'error',
      warnings,
      errors,
    };
  }

  if (normalizedPreflight.status === 'incomplete') {
    normalizedPreflight.reasons.forEach((message) => {
      warnings.push({
        severity: 'warning',
        message,
      });
      reasons.push(message);
    });

    return {
      authority: 'authoritative-preflight',
      isLegal: false,
      incomplete: true,
      reasons,
      severity: 'warning',
      warnings,
      errors,
    };
  }

  return {
    authority: 'authoritative-preflight',
    isLegal: true,
    incomplete: false,
    reasons: [],
    severity: warnings.length > 0 ? 'warning' : 'info',
    warnings,
    errors,
  };
};

const buildValidationCopy = (
  authority: ValidationAuthority
): {
  disclosureTitle: string;
  disclosureMessage: string;
  overrideTitle: string;
  overrideFootnote: string;
  blockedButtonLabel: string;
  incompleteButtonLabel: string;
} =>
  authority === 'authoritative-preflight'
    ? {
        disclosureTitle: 'Authoritative preflight',
        disclosureMessage:
          'This action is using authoritative preflight from the action and mutation layer before confirm.',
        overrideTitle: 'Authoritative preflight blocked this action:',
        overrideFootnote:
          'The modal is deferring to authoritative preflight truth for this action.',
        blockedButtonLabel: 'Preflight Blocked',
        incompleteButtonLabel: 'Authoritative Preflight Pending',
      }
    : {
        disclosureTitle: 'Modal guardrails',
        disclosureMessage:
          'These checks are advisory UI guardrails only. Final cap-state truth is still enforced later by the action and mutation layer.',
        overrideTitle: 'This action failed modal guardrails:',
        overrideFootnote:
          'Proceeding bypasses modal guardrails only. The action and mutation layer still owns final cap-state truth, and the override will be logged.',
        blockedButtonLabel: 'Action Blocked',
        incompleteButtonLabel: 'Modal Guardrails Incomplete',
      };

export const normalizeContractActionResult = (
  result: ActionResultLike
): NormalizedContractActionResult => {
  if (result && typeof result === 'object' && 'success' in result) {
    const writesSummary = result.writesSummary;
    const hasPersistSummary =
      writesSummary?.eventsWritten !== undefined ||
      writesSummary?.worldMetadataPatched !== undefined ||
      writesSummary?.teamsPatched !== undefined;
    const hasPersistedWrites =
      !hasPersistSummary ||
      (Number(writesSummary?.eventsWritten ?? 1) > 0 &&
        Number(writesSummary?.worldMetadataPatched ?? 1) > 0 &&
        Number(writesSummary?.teamsPatched ?? 1) > 0);
    const success =
      result.success === true &&
      result.appliedToLocalState !== false &&
      result.persistedToWorld !== false &&
      hasPersistedWrites;
    return {
      success,
      message: String(
        result.message ||
          result.error ||
          (success ? '' : 'Action did not complete required save writes.')
      ),
    };
  }
  if (result === false) {
    return {
      success: false,
      message: 'Action canceled. No changes were saved.',
    };
  }
  return {
    success: false,
    message: 'Action did not complete. Please try again.',
  };
};

const buildSignAndTradePreflightResult = (
  status: SignAndTradePreflightResult['status'],
  reasons: string[],
  warnings: string[] = []
): SignAndTradePreflightResult => ({
  status,
  reasons: reasons
    .map((reason) => String(reason || '').trim())
    .filter(Boolean),
  warnings: warnings
    .map((warning) => String(warning || '').trim())
    .filter(Boolean),
  source: 'authoritative-preflight',
});

const normalizeSignAndTradePreflightResult = (
  result: SignAndTradePreflightResult | null | undefined
): SignAndTradePreflightResult => {
  if (!result) {
    return buildSignAndTradePreflightResult('incomplete', [
      'Authoritative sign-and-trade preflight did not return a result.',
    ]);
  }

  const status =
    result.status === 'legal' ||
    result.status === 'blocked' ||
    result.status === 'incomplete'
      ? result.status
      : 'incomplete';
  const reasons = Array.isArray(result.reasons) ? result.reasons : [];
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];

  return buildSignAndTradePreflightResult(
    status,
    reasons.length > 0
      ? reasons
      : status === 'legal'
        ? []
        : ['Authoritative sign-and-trade preflight returned no reasons.'],
    warnings
  );
};

const buildOfferSheetPreflightResult = (
  status: OfferSheetPreflightResult['status'],
  reasons: string[],
  warnings: string[] = []
): OfferSheetPreflightResult => ({
  status,
  reasons: reasons
    .map((reason) => String(reason || '').trim())
    .filter(Boolean),
  warnings: warnings
    .map((warning) => String(warning || '').trim())
    .filter(Boolean),
  source: 'authoritative-preflight',
});

const normalizeOfferSheetPreflightResult = (
  result: OfferSheetPreflightResult | null | undefined
): OfferSheetPreflightResult => {
  if (!result) {
    return buildOfferSheetPreflightResult('incomplete', [
      'Authoritative offer sheet preflight did not return a result.',
    ]);
  }

  const status =
    result.status === 'legal' ||
    result.status === 'blocked' ||
    result.status === 'incomplete'
      ? result.status
      : 'incomplete';
  const reasons = Array.isArray(result.reasons) ? result.reasons : [];
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];

  return buildOfferSheetPreflightResult(
    status,
    reasons.length > 0
      ? reasons
      : status === 'legal'
        ? []
        : ['Authoritative offer sheet preflight returned no reasons.'],
    warnings
  );
};

const ACTION_SETS: Record<ActionSetKey, ContractActionKey[]> = {
  option: ['accept', 'decline', 'signNew'],
  freeAgent: ['resign', 'signAndTrade', 'renounce'],
  underContract: ['extend', 'waive', 'waiveStretch', 'buyout'],
};

const ACTION_LABELS: Record<ContractActionKey, string> = {
  accept: 'Accept Option',
  decline: 'Decline Option',
  signNew: 'Sign New Contract',
  resign: 'Re-sign Player',
  signAndTrade: 'Sign & Trade',
  renounce: 'Renounce Rights',
  extend: 'Extend Contract',
  waive: 'Waive Player',
  waiveStretch: 'Waive & Stretch',
  buyout: 'Buyout Contract',
};

const ACTION_DESCRIPTIONS: Record<ContractActionKey, string> = {
  accept: 'Player remains under contract for the option year.',
  decline: 'Player becomes a Free Agent immediately.',
  signNew: 'Negotiate a new contract, replacing the option.',
  resign: 'Sign player to a new multi-year deal.',
  signAndTrade: 'Sign player and immediately trade them.',
  renounce: 'Release cap hold and rights to this player.',
  extend: 'Add years to the current contract.',
  waive: 'Release player. Salary remains on cap unless claimed.',
  waiveStretch: 'Release player and stretch salary over 2x + 1 years.',
  buyout: 'Negotiate a reduced amount to release player.',
};

const ACTION_TEST_IDS: Partial<Record<ContractActionKey, string>> = {
  resign: 'contract-action-resign',
  signAndTrade: 'contract-action-sign-and-trade',
  renounce: 'contract-action-renounce-rights',
  extend: 'contract-action-extend',
  waive: 'contract-action-waive',
  waiveStretch: 'contract-action-waive-stretch',
  buyout: 'contract-action-buyout',
};

const CONTRACT_ACTION_KEYS = Object.freeze(
  Object.keys(ACTION_LABELS)
) as readonly ContractActionKey[];

const isContractActionKey = (value: string): value is ContractActionKey =>
  CONTRACT_ACTION_KEYS.includes(value as ContractActionKey);

const EditContractModal = ({
  player,
  isOpen,
  onClose,
  onSave,
  onSignFreeAgent,
  onResign,
  onWaive,
  onOptionDecision,
  onExtend,
  onSignAndTrade,
  getSignAndTradePreflight = null,
  getOfferSheetPreflight = null,
  onRenounce,
  onStoreOfferSheet = null, // Phase 16
  initialAction = null,
  targetYear = null,
  actionContext = null, // 'option' | 'freeAgent' | null - from clicked cell
  teamCapSheet = null,
  currentYear: currentYearProp = null,
  playerRulesProfile = null,
  rulesLeagueContext = null,
  actionsOverride = null,
  actionLabelsOverride = {},
  onAuditLog = null, // Callback to record override audit entries
}: EditContractModalProps) => {
  const [selectedAction, setSelectedAction] =
    useState<SelectedContractAction>('');
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [extension, setExtension] = useState<ExtensionStateLike>({
    years: 1,
    contractType: 'Standard',
    salaries: [0],
  });
  const [salaryInputs, setSalaryInputs] = useState<string[]>(['']);
  const [selectedException, setSelectedException] = useState('None');
  const [isOfferSheet, setIsOfferSheet] = useState(false); // Phase 16
  const [destinationTeamId, setDestinationTeamId] = useState<string | null>(
    null
  ); // Phase 23
  const [buyoutAmountInput, setBuyoutAmountInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [signAndTradePreflight, setSignAndTradePreflight] =
    useState<SignAndTradePreflightLike>(null);
  const latestSignAndTradePreflightRequestId = useRef(0);
  const [offerSheetPreflight, setOfferSheetPreflight] =
    useState<OfferSheetPreflightLike>(null);
  const latestOfferSheetPreflightRequestId = useRef(0);

  // Override state management
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [overrideText, setOverrideText] = useState('');
  const isOverrideConfirmed = overrideText === 'OVERRIDE';

  const [extReason, setExtReason] = useState('');
  const [extMax, setExtMax] = useState<ExtMaxState | null>(null);
  const normalizedTargetYear =
    typeof targetYear === 'number' ? targetYear : null;
  const normalizedActionContext: ActionSetKey | null =
    actionContext === 'option' ||
    actionContext === 'freeAgent' ||
    actionContext === 'underContract'
      ? actionContext
      : null;

  const today = new Date();
  // CURRENT_YEAR = the END year of the current NBA season
  // e.g., in Dec 2025 we're in the 2025-26 season, so CURRENT_YEAR = 2026
  // After June, we're in the next season (e.g., July 2025 = 2025-26 season = 2026)
  const simulationDate = rulesLeagueContext?.simulationDate;
  const simDate = simulationDate instanceof Date ? simulationDate : today;
  const CURRENT_YEAR =
    currentYearProp ||
    rulesLeagueContext?.currentYear ||
    simDate.getFullYear() + (simDate.getMonth() >= 6 ? 1 : 0);

  const capSettings = useMemo(
    () => getCapSettings(CURRENT_YEAR),
    [CURRENT_YEAR]
  );

  const isSigningAction =
    selectedAction === 'signNew' || selectedAction === 'resign';

  const signingGuardrails = useMemo(() => {
    if (!isSigningAction) return null;
    return buildSigningGuardrails(
      playerRulesProfile,
      capSettings ?? undefined,
      selectedException
    );
  }, [isSigningAction, playerRulesProfile, capSettings, selectedException]);

  const contractYears = useMemo<ContractYearLike[]>(
    () => getContractYearsForDisplay(player),
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

  const isFreeAgent =
    player?.freeAgentYear && player.freeAgentYear <= CURRENT_YEAR;

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

  const contractDataForValidation = useMemo<HookContractDataLike>(
    () => ({
      ...extension,
      salaries: (extension.salaries || []).slice(
        0,
        extension.years || extension.salaries.length || 0
      ),
      guardrails: signingGuardrails,
      exceptionType: selectedException,
    }),
    [extension, signingGuardrails, selectedException]
  );
  const signAndTradeActionDisabledReason =
    !onSignAndTrade || !getSignAndTradePreflight
      ? 'Sign-and-trade requires an active world to commit.'
      : null;
  const buildCanonicalSigningPayload = useCallback(
    (overrides: Partial<SigningPayloadLike> = {}): SigningPayloadLike => {
      const years = extension.years || extension.salaries?.length || 0;
      const salaries = (extension.salaries || []).slice(0, years);
      const totalValue = salaries.reduce(
        (sum, value) => sum + Math.round(Number(value) || 0),
        0
      );
      const salariesByYear = salaries.map((value, index) => {
        const amount = Math.round(Number(value) || 0);
        return {
          season: toSeasonCode(CURRENT_YEAR + index),
          salary: amount,
          capHit: amount,
          guaranteed: true,
          option: null,
          optionType: null,
          optionUsed: null,
        };
      });

      const signedUsing =
        selectedException && selectedException !== 'None'
          ? selectedException
          : null;

      return {
        ...extension,
        years,
        contractYears: years,
        salaries,
        salariesByYear,
        base: salaries[0] || 0,
        totalValue,
        averageAnnualValue: years > 0 ? Math.round(totalValue / years) : 0,
        firstYearGuaranteed: salariesByYear[0]?.guaranteed !== false,
        exceptionType: selectedException,
        signedUsing,
        guardrails: signingGuardrails,
        raisePct: extension.raisePct ?? signingGuardrails?.raisePct ?? 0.05,
        ...overrides,
      };
    },
    [CURRENT_YEAR, extension, selectedException, signingGuardrails]
  );
  const signAndTradePreflightPayload = useMemo(
    () =>
      ({
        ...contractDataForValidation,
        signAndTrade: true,
        contractType: 'Sign & Trade',
      }) as SigningPayloadLike,
    [contractDataForValidation]
  );
  const offerSheetPreflightPayload = useMemo(
    () =>
      buildCanonicalSigningPayload({
        rfaOfferSheet: true,
        rfaOfferSheetOnly: true,
        rfaOfferSheetStatus: 'PENDING_MATCH',
        contractType: 'Offer Sheet',
      }),
    [buildCanonicalSigningPayload]
  );
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
    currentYear: CURRENT_YEAR,
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
  const resolvedDestinationTeamCode =
    selectedAction === 'signAndTrade' && destinationTeamId
      ? resolveTeamCode(String(destinationTeamId)) || String(destinationTeamId)
      : null;

  useEffect(() => {
    latestSignAndTradePreflightRequestId.current += 1;
    const requestId = latestSignAndTradePreflightRequestId.current;

    if (!isOpen || selectedAction !== 'signAndTrade') {
      setSignAndTradePreflight(null);
      return;
    }

    if (!player) {
      setSignAndTradePreflight(
        buildSignAndTradePreflightResult('incomplete', [
          'Authoritative sign-and-trade preflight is missing player context.',
        ])
      );
      return;
    }

    if (signAndTradeActionDisabledReason) {
      setSignAndTradePreflight(
        buildSignAndTradePreflightResult('blocked', [
          signAndTradeActionDisabledReason,
        ])
      );
      return;
    }

    if (!resolvedDestinationTeamCode) {
      setSignAndTradePreflight(
        buildSignAndTradePreflightResult('blocked', [
          'Destination team is required for sign-and-trade.',
        ])
      );
      return;
    }

    setSignAndTradePreflight(
      buildSignAndTradePreflightResult('incomplete', [
        'Checking authoritative sign-and-trade legality...',
      ])
    );

    void Promise.resolve(
      getSignAndTradePreflight?.(
        player,
        signAndTradePreflightPayload,
        resolvedDestinationTeamCode
      )
    )
      .then((result) => {
        if (latestSignAndTradePreflightRequestId.current !== requestId) {
          return;
        }

        setSignAndTradePreflight(normalizeSignAndTradePreflightResult(result));
      })
      .catch((error) => {
        if (latestSignAndTradePreflightRequestId.current !== requestId) {
          return;
        }

        setSignAndTradePreflight(
          buildSignAndTradePreflightResult('incomplete', [
            error instanceof Error
              ? error.message
              : 'Authoritative sign-and-trade preflight failed before legality could be determined.',
          ])
        );
      });
  }, [
    getSignAndTradePreflight,
    isOpen,
    player,
    resolvedDestinationTeamCode,
    selectedAction,
    signAndTradeActionDisabledReason,
    signAndTradePreflightPayload,
  ]);

  useEffect(() => {
    latestOfferSheetPreflightRequestId.current += 1;
    const requestId = latestOfferSheetPreflightRequestId.current;

    if (!isOpen || selectedAction !== 'signNew' || !isOfferSheet) {
      setOfferSheetPreflight(null);
      return;
    }

    if (!player) {
      setOfferSheetPreflight(
        buildOfferSheetPreflightResult('incomplete', [
          'Authoritative offer sheet preflight is missing player context.',
        ])
      );
      return;
    }

    if (!getOfferSheetPreflight) {
      setOfferSheetPreflight(
        buildOfferSheetPreflightResult('blocked', [
          'Offer sheet preflight unavailable (no world context).',
        ])
      );
      return;
    }

    setOfferSheetPreflight(
      buildOfferSheetPreflightResult('incomplete', [
        'Checking authoritative offer sheet legality...',
      ])
    );

    void Promise.resolve(
      getOfferSheetPreflight(player, offerSheetPreflightPayload)
    )
      .then((result) => {
        if (latestOfferSheetPreflightRequestId.current !== requestId) {
          return;
        }

        setOfferSheetPreflight(normalizeOfferSheetPreflightResult(result));
      })
      .catch((error) => {
        if (latestOfferSheetPreflightRequestId.current !== requestId) {
          return;
        }

        setOfferSheetPreflight(
          buildOfferSheetPreflightResult('incomplete', [
            error instanceof Error
              ? error.message
              : 'Authoritative offer sheet preflight failed before legality could be determined.',
          ])
        );
      });
  }, [
    getOfferSheetPreflight,
    isOpen,
    isOfferSheet,
    offerSheetPreflightPayload,
    player,
    selectedAction,
  ]);

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
    setIsOfferSheet(false);
    setDestinationTeamId(null);
    setSignAndTradePreflight(null);
    setOfferSheetPreflight(null);
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

  // Rebuild signing defaults when guardrails context changes; intentionally
  // exclude extension deps to avoid clobbering user edits mid-entry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!player) return;

    // Default pre-fill with last salary for all years
    const defaultYears = 3; // Default to 3 years for new contracts
    const baseSalary = lastSalaryForPrefill || 0;
    setExtension({
      years: defaultYears,
      contractType: 'Standard',
      salaries: Array(5).fill(baseSalary), // Pre-fill all 5 possible years with last salary
      raisePct: 0.05,
    });
    setSalaryInputs(
      Array(5)
        .fill(baseSalary)
        .map((s) => (s ? formatCurrencyFull(s) : ''))
    );
    // Use initialAction if provided, otherwise reset
    setSelectedAction(
      initialAction && isContractActionKey(initialAction) ? initialAction : ''
    );
    setSelectedException('None');

    const eligibility = playerRulesProfile?.extensionEligibility;
    const terms = playerRulesProfile?.extensionTerms;
    if (eligibility) {
      setExtReason(
        eligibility.isEligible
          ? 'Eligible'
          : eligibility.reason || 'Not eligible'
      );
      setExtMax(
        terms
          ? {
              maxYears: terms.maxYears,
              maxFirstYearSalary: terms.maxFirstYearSalary,
              minFirstYearSalary: terms.minFirstYearSalary,
              baseRaisePct: terms.raisePercentage ?? null,
              type: terms.extensionType,
              basedOn: terms.basedOn ?? null,
              notes: terms.notes ?? null,
            }
          : null
      );
      return;
    }

    // Fallback to salaryEngine for extension eligibility when playerRulesProfile is not available
    try {
      // Build a RuleContext for the extension evaluation
      const seasonId = toSeasonCode(CURRENT_YEAR);
      const ruleCtx = buildMinimalRuleContext(seasonId, 'VETERAN_EXTENSION');

      // Override with actual player data
      const playerCtx = {
        ...ruleCtx,
        player: {
          ...ruleCtx.player,
          playerId: String(player.id || player.player_id || 'unknown'),
          displayName: player.displayName || player.name || 'Unknown',
          yearsOfServiceAtOperation:
            Number(player.yearsOfService || player.bio?.experience || 0),
          priorSeasonSalary: lastSalaryForPrefill || null,
          currentSeasonSalary: lastSalaryForPrefill || null,
          isRookieScale:
            player.contract?.isRookieScale ||
            player.contract?.contractType === 'Rookie Scale',
          draftInfo: player.bio?.draftYear
            ? {
                year: Number(player.bio.draftYear),
                round: Number(player.bio.draftRound || 0),
                pick: Number(player.bio.draftPick || 0),
              }
            : null,
        },
      };

      const extProfile = getExtensionProfile(playerCtx);

      if (!extProfile?.eligibility?.isEligible) {
        setExtReason(extProfile?.eligibility?.reason || 'Not eligible');
        setExtMax(null);
        return;
      }

      setExtReason('Eligible');
      const terms = extProfile.terms;
      setExtMax(
        terms
          ? {
              maxYears: terms.maxYears || 4,
              maxFirstYearSalary: terms.maxFirstYearSalary || 0,
              minFirstYearSalary:
                terms.minFirstYearSalary || terms.maxFirstYearSalary || 0,
              baseRaisePct: terms.raisePercentage || 0.08,
              type: terms.extensionType || 'Standard',
              basedOn: terms.basedOn || '',
              notes: terms.notes || '',
            }
          : null
      );
    } catch (err) {
      console.warn('Extension eligibility check failed:', err);
      setExtReason('Unable to determine eligibility');
      setExtMax(null);
    }
  }, [
    CURRENT_YEAR,
    initialAction,
    lastSalaryForPrefill,
    player,
    playerRulesProfile,
  ]);

  useEffect(() => {
    if (selectedAction !== 'extend') return;
    if (!extMax) {
      setExtension((prev) => ({
        ...prev,
        years: prev.years || 1,
        salaries: prev.salaries || [0],
      }));
      setSalaryInputs((prev) => (prev.length ? prev : ['']));
      return;
    }

    const firstYearSalary = (() => {
      const min = extMax.minFirstYearSalary ?? 0;
      const max = extMax.maxFirstYearSalary ?? min;
      const target = extMax.maxFirstYearSalary ?? min;
      const clamped = Math.max(min, Math.min(target, max || target));
      return clamped;
    })();
    setExtension((prev) => {
      const years = extMax.maxYears || prev.years || 1;
      const salaries = Array(years).fill(firstYearSalary);
      setSalaryInputs(
        Array(years)
          .fill(firstYearSalary)
          .map((s) => (s ? formatCurrencyFull(s) : ''))
      );
      return {
        years,
        contractType: 'Standard',
        salaries,
      };
    });
  }, [extMax, selectedAction]);

  const clampFirstYearToGuardrails = useCallback(
    (value: number | null | undefined): number => {
      if (!signingGuardrails) return value || 0;
      const min = signingGuardrails.minFirstYear || 0;
      const max = signingGuardrails.maxFirstYear;
      let next = Math.max(min, value || 0);
      if (max != null) next = Math.min(next, max);
      return next;
    },
    [signingGuardrails]
  );

  const buildSalarySeries = useCallback(
    (
      firstYear: number,
      years: number,
      raisePct: number | null | undefined
    ): number[] => {
      const totalYears = Math.min(Math.max(years, 1), 5);
      const series: number[] = [];
      for (let i = 0; i < totalYears; i += 1) {
        if (i === 0) {
          series.push(Math.round(firstYear));
        } else {
          series.push(Math.round(series[i - 1] * (1 + (raisePct || 0))));
        }
      }
      return series;
    },
    []
  );

  const toSalaryInputs = useCallback(
    (series: number[], years: number): string[] =>
      Array.from({ length: 5 }, (_, idx) =>
        idx < years && series[idx] ? formatCurrencyFull(series[idx]) : ''
      ),
    []
  );

  useEffect(() => {
    if (!signingGuardrails || !isSigningAction) return;

    setExtension((prev) => {
      const maxYears =
        signingGuardrails.maxYears && signingGuardrails.maxYears > 0
          ? Math.min(signingGuardrails.maxYears, 5)
          : Math.min(prev.years || 3, 5);

      const baseFirstYear = clampFirstYearToGuardrails(
        (selectedException !== 'None' && signingGuardrails.maxFirstYear != null
          ? signingGuardrails.maxFirstYear
          : prev.salaries?.[0]) ??
          signingGuardrails.maxFirstYear ??
          lastSalaryForPrefill ??
          signingGuardrails.minFirstYear ??
          0
      );

      const raisePct = signingGuardrails.raisePct ?? prev.raisePct ?? 0.05;
      const series = buildSalarySeries(baseFirstYear, maxYears, raisePct);
      setSalaryInputs(toSalaryInputs(series, maxYears));

      return {
        ...prev,
        years: maxYears,
        salaries: series,
        raisePct,
      };
    });
  }, [
    isSigningAction,
    signingGuardrails,
    lastSalaryForPrefill,
    selectedException,
    clampFirstYearToGuardrails,
    buildSalarySeries,
    toSalaryInputs,
  ]);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setSaveError('');

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

      // Phase 16: MVP Offer Sheet toggle Logic
      if (isOfferSheet && selectedAction === 'signNew') {
        actionResult = await onStoreOfferSheet?.(
          player,
          buildCanonicalSigningPayload({
            contractType: 'Offer Sheet',
            rfaOfferSheet: true,
            rfaOfferSheetOnly: true,
            rfaOfferSheetStatus: 'PENDING_MATCH',
            ...(overrideMetadata || {}),
          })
        );
      } else {
        switch (selectedAction) {
          case 'accept':
            actionResult = await onOptionDecision?.(
              player,
              true,
              overrideMetadata
            );
            break;
          case 'decline':
            actionResult = await onOptionDecision?.(
              player,
              false,
              overrideMetadata
            );
            break;
          case 'signNew':
            actionResult = await (
              onSignFreeAgent ||
              onSave
            )?.(
              player,
              buildCanonicalSigningPayload({
                ...(overrideMetadata || {}),
              })
            );
            break;
          case 'resign':
            actionResult = await (onResign || onSave)?.(
              player,
              buildCanonicalSigningPayload({
                ...(overrideMetadata || {}),
              })
            );
            break;
          case 'signAndTrade':
            if (!resolvedDestinationTeamCode) {
              actionResult = {
                success: false,
                message: 'Destination team is required for sign-and-trade.',
              };
              break;
            }
            actionResult = await onSignAndTrade?.(
              player,
              buildCanonicalSigningPayload({
                signAndTrade: true,
                contractType: 'Sign & Trade',
                ...(overrideMetadata || {}),
              }),
              resolvedDestinationTeamCode
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
        {/* === LEFT PANEL: Contract Summary === */}
        <div className="w-full lg:w-[35%] bg-[#161616] border-r border-white/10 p-8 flex flex-col">
          {/* Header Total */}
          <div className="text-center mb-6">
            <div className="text-2xl font-bold text-white tracking-tight">
              {formatCurrency(summary.totalValue)}{' '}
              <span className="text-white/40 mx-1">-</span> {summary.totalYears}{' '}
              yrs
            </div>
            <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mt-1">
              Total Contract
            </div>
          </div>

          {/* Years List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-2">
            {contractYears
              .filter((y) => {
                // When extensions exist, only show from current year onward
                if (summary.extensionYears > 0) {
                  return y.year >= CURRENT_YEAR;
                }
                return true;
              })
              .map((y) => {
                // CURRENT_YEAR is the end year of the current season (e.g., 2026 for 2025-26 season)
                // Only years strictly greater than CURRENT_YEAR are future years
                const isFuture = y.year > CURRENT_YEAR;
                const isCurrent = y.year === CURRENT_YEAR;
                const isOption = !!y.option;
                const isExtension = y.isExtension;
                return (
                  <div
                    key={y.season}
                    className={`flex items-center justify-between py-3 border-b border-white/5 ${
                      isFuture || isCurrent ? 'opacity-100' : 'opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/60">
                        {y.season}
                      </span>
                      {isExtension && (
                        <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                          EXT
                        </span>
                      )}
                      {isOption && (
                        <span
                          className={`text-[10px] font-bold uppercase ${
                            y.option === 'TO' || y.option === 'Team Option'
                              ? 'text-orange-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {y.option}
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono text-sm ${
                        isOption
                          ? y.option === 'TO' || y.option === 'Team Option'
                            ? 'text-orange-400 font-bold'
                            : 'text-emerald-400 font-bold'
                          : isExtension
                            ? 'text-cyan-300 font-bold'
                            : isFuture || isCurrent
                              ? 'text-white font-medium'
                              : 'text-white/60'
                      }`}
                    >
                      {formatCurrencyFull(y.salary)}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Footer Remaining + Extension */}
          <div className="text-center mt-6 pt-6 border-t border-white/5">
            <div className="text-xl font-bold text-white tracking-tight">
              {formatCurrency(summary.remainingValue)}{' '}
              <span className="text-white/40 mx-1">-</span>{' '}
              {summary.remainingYears} yrs
            </div>
            <div className="text-xs uppercase tracking-wider text-white/40 font-semibold mt-1">
              Remaining
            </div>

            {/* Extension Summary */}
            {summary.extensionYears > 0 && (
              <div className="mt-4 pt-4 border-t border-cyan-500/20">
                <div className="text-lg font-bold text-cyan-100 tracking-tight">
                  {formatCurrency(summary.extensionValue)}{' '}
                  <span className="text-cyan-400/40 mx-1">-</span>{' '}
                  {summary.extensionYears} yrs
                </div>
                <div className="text-xs uppercase tracking-wider text-cyan-400/60 font-semibold mt-1">
                  Extension
                </div>
              </div>
            )}
          </div>
        </div>

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
                      <option value="None">Cap Space / Rights</option>
                      <option value="Full MLE">Full MLE</option>
                      <option value="Taxpayer MLE">Taxpayer MLE</option>
                      <option value="Room MLE">Room MLE</option>
                      <option value="BAE">Bi-Annual</option>
                      <option value="Minimum">Minimum</option>
                    </select>
                  )}

                  {/* Phase 16: Offer Sheet Toggle */}
                  {['signNew'].includes(selectedAction) &&
                    onStoreOfferSheet && (
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

export default EditContractModal;
