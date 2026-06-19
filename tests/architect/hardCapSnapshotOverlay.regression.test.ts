/**
 * Hard-cap overlay regression — a team is hard-capped ONLY after a triggering
 * transaction, never merely because its salary sits in an apron band.
 *
 * Reproduces the real 2025-26 Lakers shape that falsely reported
 * "hard-capped at the first apron": hardCapLevel 'firstApron' (a band label
 * from SalarySwish) with NO trigger and both apron-triggered flags false.
 *
 * @file tests/architect/hardCapSnapshotOverlay.regression.test.ts
 */

import { describe, it, expect } from 'vitest';
import { resolveHardCapSnapshotOverlay } from '@/features/architect/utils/capTotals/hardCapSnapshotOverlay';

const lakersTotals = {
  totalCapAllocations: 211399497,
  firstApron: 195945000,
  secondApron: 207824000,
};

describe('resolveHardCapSnapshotOverlay — band label is not a hard cap', () => {
  it('does NOT hard-cap the Lakers from a "firstApron" band descriptor alone', () => {
    const teamCapSheet = {
      hardCapLevel: 'firstApron', // SalarySwish band label
      totals: {
        hardCapLevel: 'firstApron',
        hardCapDetail: '1st Apron',
        firstApronTriggered: false,
        secondApronTriggered: false,
        // no isHardCapped, no hardCapped, no hardCapTriggeredBy
      },
    };

    const result = resolveHardCapSnapshotOverlay(teamCapSheet, lakersTotals);

    expect(result.isHardCapped).toBe(false);
    expect(result.hardCapLevel).toBeNull();
  });

  it('DOES hard-cap once a triggering transaction is recorded (NT-MLE)', () => {
    const teamCapSheet = {
      hardCapLevel: 'firstApron',
      hardCapped: 1,
      hardCapTriggeredBy: 'Non-Taxpayer MLE',
      totals: { hardCapLevel: 'firstApron' },
    };

    const result = resolveHardCapSnapshotOverlay(teamCapSheet, lakersTotals);

    expect(result.isHardCapped).toBe(true);
    expect(result.hardCapLevel).toBe('firstApron');
  });

  it('respects an explicit canonical isHardCapped flag', () => {
    const teamCapSheet = {
      totals: { isHardCapped: true, hardCapLevel: 'secondApron' },
    };

    const result = resolveHardCapSnapshotOverlay(teamCapSheet, lakersTotals);

    expect(result.isHardCapped).toBe(true);
    expect(result.hardCapLevel).toBe('secondApron');
  });
});
