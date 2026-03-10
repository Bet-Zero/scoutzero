import { describe, expect, it } from 'vitest';
import {
  assertPostTradeSnapshot,
  assertTradeComputeInputs,
  assertValidatedTradeContext,
} from '@/features/architect/utils/tradeContext';

describe('tradeContext assertion contracts', () => {
  it('assertPostTradeSnapshot throws the exact null/undefined message', () => {
    expect(() =>
      assertPostTradeSnapshot(null as any, 'snapshotContract')
    ).toThrowError(
      '[Phase 58 invariant violated at snapshotContract] PostTradeSnapshot is null/undefined. Use buildPostTradeTeamsSnapshot() to create a snapshot before calling this function.'
    );
  });

  it('assertPostTradeSnapshot throws the exact teamUpdates shape message', () => {
    expect(() =>
      assertPostTradeSnapshot(
        {
          teamUpdates: {},
          validationTeams: [],
        } as any,
        'snapshotContract'
      )
    ).toThrowError(
      '[Phase 58 invariant violated at snapshotContract] PostTradeSnapshot.teamUpdates must be an array. Got: object'
    );
  });

  it('assertValidatedTradeContext throws the exact null/undefined message', () => {
    expect(() =>
      assertValidatedTradeContext(undefined as any, 'validatedContract')
    ).toThrowError(
      '[Phase 58 invariant violated at validatedContract] ValidatedTradeContext is null/undefined. Use validatePostTradeSnapshotForContext() to create a context before calling this function.'
    );
  });

  it('assertValidatedTradeContext throws the exact sentinel message', () => {
    expect(() =>
      assertValidatedTradeContext(
        {
          legal: true,
          teamResults: [],
          validationTeams: [],
        } as any,
        'validatedContract'
      )
    ).toThrowError(
      '[Phase 58 invariant violated at validatedContract] ValidatedTradeContext._isValidatedTradeContext must be true. This context was not created by validatePostTradeSnapshotForContext(). Ensure you are passing the correct object.'
    );
  });

  it('accepts valid snapshot/context shapes through the combined assertion', () => {
    const snapshot = {
      teamUpdates: [{ teamCode: 'BOS', team: { roster: [] } }],
      validationTeams: [],
      payloadTeams: [],
      _isPostTradeSnapshot: true,
    };
    const validatedContext = {
      legal: true,
      valid: true,
      reason: null,
      error: null,
      violations: [],
      warnings: [],
      teamResults: [],
      summaryByTeamIndex: [],
      capSettings: null,
      capSettingsSource: null,
      capSettingsWarnings: [],
      dataWarnings: [],
      hasDataIssues: false,
      tradeReceipt: null,
      validationTeams: [],
      _isValidatedTradeContext: true as const,
    };

    expect(() =>
      assertTradeComputeInputs({
        postTradeSnapshot: snapshot,
        validatedContext,
        callSite: 'computeTradeResult',
      })
    ).not.toThrow();
  });
});
