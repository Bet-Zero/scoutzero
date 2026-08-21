import type {
  ValidationEntryLike,
  ValidationStateLike,
  ValidationSeverity,
  AuthoritativePreflightKind,
  ValidationAuthority,
  SignAndTradePreflightLike,
  OfferSheetPreflightLike,
  NormalizedContractActionResult,
  ActionResultLike,
  ContractActionKey,
  ActionSetKey,
  SigningExceptionOption,
} from './EditContractModal.types';
import type {
  SignAndTradePreflightResult,
  OfferSheetPreflightResult,
} from '@/features/architect/utils/mutationPipeline';

export const DEFAULT_VALIDATION_STATE: ValidationStateLike = {
  authority: 'advisory-modal',
  isLegal: true,
  incomplete: false,
  reasons: [],
  severity: 'info',
  warnings: [],
  errors: [],
};

export const hasNumberContractYear = <T extends { year: unknown }>(
  year: T
): year is T & { year: number } =>
  typeof year.year === 'number' && Number.isFinite(year.year);

export const ADVISORY_MODAL_INCOMPLETE_MESSAGE =
  'Modal guardrails incomplete — some UI checks could not be evaluated.';

export const buildAdvisoryModalValidationState = ({
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
  selectedAction: string;
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

export const buildAuthoritativePreflightState = ({
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
    warnings.push({ severity: 'warning', message });
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
    warnings.push({ severity: 'warning', message });
  });

  if (normalizedPreflight.status === 'blocked') {
    normalizedPreflight.reasons.forEach((message) => {
      errors.push({ severity: 'error', message });
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
      warnings.push({ severity: 'warning', message });
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

export const buildValidationCopy = (
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

export const buildSignAndTradePreflightResult = (
  status: SignAndTradePreflightResult['status'],
  reasons: string[],
  warnings: string[] = []
): SignAndTradePreflightResult => ({
  status,
  reasons: reasons.map((r) => String(r || '').trim()).filter(Boolean),
  warnings: warnings.map((w) => String(w || '').trim()).filter(Boolean),
  source: 'authoritative-preflight',
});

export const normalizeSignAndTradePreflightResult = (
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

export const buildOfferSheetPreflightResult = (
  status: OfferSheetPreflightResult['status'],
  reasons: string[],
  warnings: string[] = []
): OfferSheetPreflightResult => ({
  status,
  reasons: reasons.map((r) => String(r || '').trim()).filter(Boolean),
  warnings: warnings.map((w) => String(w || '').trim()).filter(Boolean),
  source: 'authoritative-preflight',
});

export const normalizeOfferSheetPreflightResult = (
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

export const ACTION_SETS: Record<ActionSetKey, ContractActionKey[]> = {
  option: ['accept', 'decline', 'signNew'],
  freeAgent: ['resign', 'renounce'],
  underContract: ['extend', 'waive', 'waiveStretch', 'buyout'],
};

export const ACTION_LABELS: Record<ContractActionKey, string> = {
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

export const ACTION_DESCRIPTIONS: Record<ContractActionKey, string> = {
  accept: 'Player remains under contract for the option year.',
  decline: 'Player becomes a Free Agent immediately.',
  signNew: 'Negotiate a new contract, replacing the option.',
  resign: 'Sign player to a new multi-year deal.',
  signAndTrade: 'Sign player and immediately trade them.',
  renounce: 'Release cap hold and rights to this player.',
  extend: 'Add years to the current contract.',
  waive:
    'Record an irrevocable League waiver request and its exact 48-hour period.',
  waiveStretch:
    'Record the waiver plus a written election to re-attribute Team Salary.',
  buyout:
    'Record a signed reduction of protected Base Compensation, then waive.',
};

export const ACTION_TEST_IDS: Partial<Record<ContractActionKey, string>> = {
  resign: 'contract-action-resign',
  signAndTrade: 'contract-action-sign-and-trade',
  renounce: 'contract-action-renounce-rights',
  extend: 'contract-action-extend',
  waive: 'contract-action-waive',
  waiveStretch: 'contract-action-waive-stretch',
  buyout: 'contract-action-buyout',
};

export const CONTRACT_ACTION_KEYS = Object.freeze(
  Object.keys(ACTION_LABELS)
) as readonly ContractActionKey[];

export const SIGNING_EXCEPTION_OPTIONS: readonly SigningExceptionOption[] = [
  { value: 'None', label: 'Cap Space / Rights' },
  { value: 'Full MLE', label: 'Full MLE' },
  { value: 'Taxpayer MLE', label: 'Taxpayer MLE' },
  { value: 'Room MLE', label: 'Room MLE' },
  { value: 'BAE', label: 'Bi-Annual' },
  { value: 'Minimum', label: 'Minimum' },
] as const;

export const isContractActionKey = (value: string): value is ContractActionKey =>
  CONTRACT_ACTION_KEYS.includes(value as ContractActionKey);
