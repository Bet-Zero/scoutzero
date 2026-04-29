import { describe, expect, it } from 'vitest';
import type { ArchitectMutationTeamRecord } from '@/features/architect/utils/mutationPipeline';
import type {
  PostTradeSnapshot,
  TeamUpdate,
  ValidatedTradeContext,
} from '@/features/architect/utils/tradeContext/types';
import {
  assertPostTradeSnapshot,
  assertTradeComputeInputs,
  assertValidatedTradeContext,
} from '@/features/architect/utils/tradeContext/assertions';

describe('tradeContext assertion contracts', () => {
  it('assertPostTradeSnapshot throws the exact null/undefined message', () => {
    expect(() =>
      assertPostTradeSnapshot(null, 'snapshotContract')
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
        } as unknown as PostTradeSnapshot,
        'snapshotContract'
      )
    ).toThrowError(
      '[Phase 58 invariant violated at snapshotContract] PostTradeSnapshot.teamUpdates must be an array. Got: object'
    );
  });

  it('assertValidatedTradeContext throws the exact null/undefined message', () => {
    expect(() =>
      assertValidatedTradeContext(undefined, 'validatedContract')
    ).toThrowError(
      '[Phase 58 invariant violated at validatedContract] ValidatedTradeContext is null/undefined. Use validatePostTradeSnapshotForContext() to create a context before calling this function.'
    );
  });

  it('assertValidatedTradeContext throws the exact sentinel message', () => {
    expect(() =>
      assertValidatedTradeContext(
        {
          legal: true,
          reason: '',
          error: null,
          violations: [],
          warnings: [],
          teamResults: [],
          validationTeams: [],
        } as unknown as ValidatedTradeContext,
        'validatedContract'
      )
    ).toThrowError(
      '[Phase 58 invariant violated at validatedContract] ValidatedTradeContext._isValidatedTradeContext must be true. This context was not created by validatePostTradeSnapshotForContext(). Ensure you are passing the correct object.'
    );
  });

  it('accepts valid snapshot/context shapes through the combined assertion', () => {
    const team: ArchitectMutationTeamRecord = { roster: [] };
    const teamUpdate: TeamUpdate = { teamCode: 'BOS', team };
    const snapshot: PostTradeSnapshot = {
      teamUpdates: [teamUpdate],
      validationTeams: [],
      payloadTeams: [],
      _isPostTradeSnapshot: true,
    };
    const validatedContext: ValidatedTradeContext = {
      legal: true,
      reason: '',
      error: null,
      violations: [],
      warnings: [],
      teamResults: [],
      validationTeams: [],
      _isValidatedTradeContext: true,
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
