import { describe, expect, it } from 'vitest';
import {
  hasCurrentTradeValidation,
  hasUsableTradePreviewAuthority,
} from '@/features/architect/tradeMachine/utils/tradeValidationCurrentness';

const completeAuthority = {
  source: 'apply-preview',
  legal: false,
  reason: 'Trade is blocked.',
  error: 'VALIDATION_BLOCKED',
  violations: [{ message: 'Trade is blocked.', code: 'VALIDATION_BLOCKED' }],
  warnings: [],
} as const;

describe('Trade validation currentness', () => {
  it('accepts exact-draft top-level authority when per-Team results are empty', () => {
    expect(
      hasCurrentTradeValidation({
        currentDraftKey: 'draft-a',
        validatedDraftKey: 'draft-a',
        snapshotValidationDetails: { teamResults: [] },
        previewAuthority: completeAuthority,
      })
    ).toBe(true);
  });

  it('preserves the normal completed per-Team validation path', () => {
    expect(
      hasCurrentTradeValidation({
        currentDraftKey: 'draft-a',
        validatedDraftKey: 'draft-a',
        snapshotValidationDetails: { teamResults: [{ teamId: 'LAL' }] },
        previewAuthority: { ...completeAuthority, legal: true, error: null },
      })
    ).toBe(true);
  });

  it('rejects missing, incomplete, and authority-construction-failure results', () => {
    expect(
      hasCurrentTradeValidation({
        currentDraftKey: 'draft-a',
        validatedDraftKey: 'draft-a',
        snapshotValidationDetails: null,
        previewAuthority: completeAuthority,
      })
    ).toBe(false);
    expect(
      hasUsableTradePreviewAuthority({
        source: 'apply-preview',
        reason: 'Incomplete result',
        error: null,
        violations: [],
        warnings: [],
      })
    ).toBe(false);

    for (const code of [
      'APPLY_PREVIEW_ERROR',
      'TRADE_CONTEXT_VALIDATION_FAILURE',
    ]) {
      expect(
        hasUsableTradePreviewAuthority({
          ...completeAuthority,
          violations: [{ message: 'Construction failed', code }],
        })
      ).toBe(false);
    }
  });

  it('rejects a complete authority after any draft-key change', () => {
    expect(
      hasCurrentTradeValidation({
        currentDraftKey: 'draft-b',
        validatedDraftKey: 'draft-a',
        snapshotValidationDetails: { teamResults: [] },
        previewAuthority: completeAuthority,
      })
    ).toBe(false);
  });
});
