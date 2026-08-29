import { isValidationCurrent } from './computeTradeDraftKey';

type PreviewAuthorityCandidate = {
  source?: unknown;
  legal?: unknown;
  reason?: unknown;
  error?: unknown;
  violations?: unknown;
  warnings?: unknown;
};

type TradeValidationCurrentnessInput = {
  currentDraftKey: string;
  validatedDraftKey: string | null;
  snapshotValidationDetails: unknown | null;
  previewAuthority: PreviewAuthorityCandidate | null;
};

const PREVIEW_AUTHORITY_CONSTRUCTION_FAILURE_CODES = new Set([
  'APPLY_PREVIEW_ERROR',
  'TRADE_CONTEXT_VALIDATION_FAILURE',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const hasUsableTradePreviewAuthority = (
  authority: PreviewAuthorityCandidate | null
) => {
  if (
    !authority ||
    authority.source !== 'apply-preview' ||
    typeof authority.legal !== 'boolean' ||
    typeof authority.reason !== 'string' ||
    !Array.isArray(authority.violations) ||
    !Array.isArray(authority.warnings) ||
    !(authority.error === null || typeof authority.error === 'string')
  ) {
    return false;
  }

  return !authority.violations.some((issue) => {
    if (!isRecord(issue)) return false;
    return PREVIEW_AUTHORITY_CONSTRUCTION_FAILURE_CODES.has(
      String(issue.code ?? '').trim().toUpperCase()
    );
  });
};

export const hasCurrentTradeValidation = ({
  currentDraftKey,
  validatedDraftKey,
  snapshotValidationDetails,
  previewAuthority,
}: TradeValidationCurrentnessInput) =>
  snapshotValidationDetails !== null &&
  hasUsableTradePreviewAuthority(previewAuthority) &&
  isValidationCurrent(currentDraftKey, validatedDraftKey);
