import { describe, expect, it } from 'vitest';
import {
  checkSimulationTpes,
  readHardCapLabel,
  resolveSimulationHardCap,
} from '@/features/architect/utils/simulationHardCap';
import { getHardCapStatus } from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';

const signing = (signedUsing: string, salary: number, season = '2025-26') => ({
  playerId: 'p',
  contract: { signedUsing, salariesByYear: [{ season, salary }] },
});

const resolve = (
  sourceLabel: unknown,
  releaseDocs = {},
  apronTeamSalary = 190_000_000,
  correction?: Parameters<typeof resolveSimulationHardCap>[0]['correction']
) =>
  resolveSimulationHardCap({
    teamCode: 'TST',
    season: '2025-26',
    sourceLabel,
    releaseDocs,
    apronTeamSalary,
    correction,
  });

describe('SIMULATION hard caps (A3)', () => {
  it('reads the snapshot labels and rejects unknown ones', () => {
    expect(readHardCapLabel('1st Apron')).toBe('firstApron');
    expect(readHardCapLabel('secondApron')).toBe('secondApron');
    expect(readHardCapLabel('No')).toBe('none');
    expect(readHardCapLabel(null)).toBe('none');
    expect(() => readHardCapLabel('hard')).toThrow('Unrecognised');
  });

  it('labels a hard-capped team so the trade machine enforces it', () => {
    const cap = resolve('firstApron');
    expect(cap).toMatchObject({ level: 'firstApron', corrected: false });
    expect(cap.triggeredBy).toContain('SIMULATION');
    const status = getHardCapStatus({
      hardCapLevel: cap.level,
      hardCapReason: cap.reason,
      hardCapTriggeredBy: cap.triggeredBy,
      hardCapped: true,
    } as never);
    expect(status).toMatchObject({
      isHardCapped: true,
      hardCapType: 'FIRST_APRON',
    });
  });

  it('raises a label from retained evidence but never lowers one', () => {
    expect(
      resolve('none', {}, 193_613_510, {
        level: 'firstApron',
        evidence: 'retained report',
      })
    ).toMatchObject({
      level: 'firstApron',
      corrected: true,
      triggeredBy: 'SIMULATION: retained report',
    });
    expect(() =>
      resolve('secondApron', {}, 1, { level: 'none', evidence: 'x' })
    ).toThrow('may not lower');
  });

  it('refuses a "No" label contradicted by this cap year’s signings', () => {
    expect(() => resolve('none', { a: signing('Mle', 14_104_000) })).toThrow(
      'Non-Taxpayer MLE'
    );
    expect(() =>
      resolve('none', { a: signing('Biannual Exception', 3_809_524) })
    ).toThrow('Bi-annual');
    // Taxpayer-sized MLE use, Room MLE and earlier signings do not hard-cap.
    expect(
      resolve('none', {
        a: signing('Mle', 3_415_000),
        b: signing('Room Mle', 8_781_000),
        c: signing('Mle', 14_104_000, '2024-25'),
        d: signing('Taxpayer Mle', 5_685_000),
      }).level
    ).toBe('none');
  });

  it('refuses a hard-capped team above its ceiling', () => {
    expect(() => resolve('firstApron', {}, 195_945_001)).toThrow('exceeds');
    expect(resolve('secondApron', {}, 207_824_000).level).toBe('secondApron');
  });
});

describe('SIMULATION Traded Player Exceptions (A3)', () => {
  const tpe = (over: Record<string, unknown> = {}) => ({
    id: 'TPE-1',
    totalAmount: 8_200_000,
    usedAmount: 1_000_000,
    remainingAmount: 7_200_000,
    expiresOn: 'Aug 6, 2026',
    ...over,
  });
  it('sums open, coherent exceptions', () => {
    expect(
      checkSimulationTpes(
        'TST',
        [tpe(), tpe({ id: 'TPE-2' })],
        '2026-06-05T12:19:56Z'
      )
    ).toBe(14_400_000);
    expect(checkSimulationTpes('TST', undefined, '2026-06-05')).toBe(0);
  });
  it('rejects broken balances and exceptions closed by the start date', () => {
    expect(() =>
      checkSimulationTpes(
        'TST',
        [tpe({ remainingAmount: 7_000_000 })],
        '2026-06-05'
      )
    ).toThrow('incoherent');
    expect(() =>
      checkSimulationTpes(
        'TST',
        [tpe({ expiresOn: 'Jun 1, 2026' })],
        '2026-06-05'
      )
    ).toThrow('closed');
    expect(() =>
      checkSimulationTpes(
        'TST',
        [tpe({ usedAmount: 8_200_000, remainingAmount: 0 })],
        '2026-06-05'
      )
    ).toThrow('closed');
  });
});
