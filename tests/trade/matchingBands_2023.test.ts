import { describe, it, expect } from 'vitest';
import {
  calculateAllowableIncoming,
  getTierThresholds,
} from '@/features/architect/utils/tradeHelpers';

const [BAND1, BAND2] = getTierThresholds(2025);

describe('2023 matching bands below first apron', () => {
  const base = {
    currentTeamSalary: 150_000_000,
    secondApronStatus: false,
    firstApronStatus: false,
    yearKey: 2025,
    tpeAmount: 0,
  };

  it('Band A up to BAND1: 200% + 250k', () => {
    const { ceiling } = calculateAllowableIncoming({
      ...base,
      salaryOut: 5_000_000,
    });
    expect(ceiling).toBe(10_250_000);

    const { ceiling: edge } = calculateAllowableIncoming({
      ...base,
      salaryOut: BAND1,
    });
    expect(edge).toBe(BAND1 * 2 + 250_000);
  });

  it('Band B between BAND1 and BAND2: + expanded TPE', () => {
    const { ceiling } = calculateAllowableIncoming({
      ...base,
      salaryOut: 10_000_000,
    });
    expect(ceiling).toBe(19_096_000); // 10M + 9.096M (2026-27 expanded TPE)

    const { ceiling: edge } = calculateAllowableIncoming({
      ...base,
      salaryOut: BAND2,
    });
    expect(edge).toBe(BAND2 + 9_096_000);
  });

  it('Band C above BAND2: 125% + 250k', () => {
    const { ceiling } = calculateAllowableIncoming({
      ...base,
      salaryOut: 40_000_000,
    });
    expect(ceiling).toBe(50_250_000);
  });
});

