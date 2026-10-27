import { describe, expect, it } from 'vitest';
import {
  normalizeCurrentStatePlayerContract,
  normalizeCurrentStatePlayerFutureContract,
} from '@/features/architect/utils/mutationPipeline.helpers.playerNorm.contract';

describe('trade to season contract continuity', () => {
  it('preserves each existing contract identity through repeated mutation normalization', () => {
    const contract = {
      contractId: 'existing-contract-17',
      salariesByYear: [{ season: '2026-27', salary: 2000000 }],
    };
    const current = normalizeCurrentStatePlayerContract(contract);
    expect(current?.contractId).toBe('existing-contract-17');
    expect(normalizeCurrentStatePlayerContract(current)?.contractId).toBe(
      'existing-contract-17'
    );
    expect(
      normalizeCurrentStatePlayerFutureContract(contract)?.contractId
    ).toBe('existing-contract-17');
  });
  it('does not manufacture missing contract history authority', () => {
    expect(
      normalizeCurrentStatePlayerContract({ contractType: 'STANDARD CONTRACT' })
        ?.contractId
    ).toBeUndefined();
  });
});
