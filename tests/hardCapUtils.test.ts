import { describe, expect, it } from 'vitest';
import {
  applyHardCapTrigger,
  checkIfActionTriggersHardCap,
  getFirstApronHardCapReason,
  getHardCapLimit,
  isHardCappedAtFirstApron,
  isHardCappedAtSecondApron,
  wouldExceedHardCap,
} from '@/features/architect/utils/hardCapUtils';

describe('hardCapUtils', () => {
  const capSettings = {
    firstApron: 178_000_000,
    secondApron: 190_000_000,
  };

  it('identifies the existing hard-cap trigger set', () => {
    expect(checkIfActionTriggersHardCap('NonTaxMLE')).toBe('FirstApron');
    expect(checkIfActionTriggersHardCap('BAE')).toBe('FirstApron');
    expect(checkIfActionTriggersHardCap('SignAndTrade')).toBe('FirstApron');
    expect(checkIfActionTriggersHardCap('MinimumSigning')).toBeNull();
  });

  it('applies a first-apron trigger to an uncapped sheet', () => {
    expect(applyHardCapTrigger({}, 'BAE', 2026)).toEqual({
      hardCapTriggered: 'FirstApron',
      hardCapYear: 2026,
    });
  });

  it('replaces a weaker legacy trigger token when appropriate', () => {
    expect(
      applyHardCapTrigger({ hardCapTriggered: 'None', note: 'keep' }, 'BAE', 2026)
    ).toEqual({
      hardCapTriggered: 'FirstApron',
      hardCapYear: 2026,
      note: 'keep',
    });
  });

  it('detects hard-cap overages using either hardCapFirstApron or hardCapTriggered', () => {
    expect(
      wouldExceedHardCap(
        { hardCapFirstApron: { active: true } },
        178_000_001,
        capSettings
      )
    ).toBe(true);
    expect(
      wouldExceedHardCap(
        { hardCapTriggered: 'SecondApron' },
        190_000_001,
        capSettings
      )
    ).toBe(true);
    expect(wouldExceedHardCap({}, 999_999_999, capSettings)).toBe(false);
  });

  it('returns the active hard-cap limit when present', () => {
    expect(
      getHardCapLimit({ hardCapTriggered: 'FirstApron' }, capSettings)
    ).toBe(178_000_000);
    expect(
      getHardCapLimit({ hardCapTriggered: 'SecondApron' }, capSettings)
    ).toBe(190_000_000);
    expect(getHardCapLimit({}, capSettings)).toBeNull();
  });

  it('preserves current first-apron hard-cap detection sources', () => {
    expect(
      isHardCappedAtFirstApron(
        { hardCapFirstApron: { active: true, season: '2024-25' } },
        2025
      )
    ).toBe(true);
    expect(
      isHardCappedAtFirstApron({
        faExceptionBuckets: [{ type: 'NTMLE', used: 1, remaining: 9, amount: 10 }],
      })
    ).toBe(true);
    expect(isHardCappedAtFirstApron({ mle: { used: 1 } })).toBe(true);
    expect(isHardCappedAtFirstApron({ hardCapped: 1 })).toBe(true);
    expect(isHardCappedAtFirstApron({ hardCapTriggered: true })).toBe(true);
    expect(isHardCappedAtFirstApron({})).toBe(false);
  });

  it('preserves current second-apron hard-cap detection sources', () => {
    expect(isHardCappedAtSecondApron({ hardCapped: 2 })).toBe(true);
    expect(
      isHardCappedAtSecondApron({ hardCapTriggered: 'SecondApron' })
    ).toBe(true);
    expect(isHardCappedAtSecondApron({ hardCapTriggered: 'FirstApron' })).toBe(
      false
    );
  });

  it('returns exact first-apron hard-cap reason strings', () => {
    expect(getFirstApronHardCapReason({ mle: { used: 1 }, bae: { used: 1 } })).toBe(
      'Usage of Non-Taxpayer MLE & BAE'
    );
    expect(getFirstApronHardCapReason({ mle: { used: 1 } })).toBe(
      'Usage of Non-Taxpayer MLE'
    );
    expect(
      getFirstApronHardCapReason({
        faExceptionBuckets: [{ type: 'BAE', used: 1, remaining: 0, amount: 4 }],
      })
    ).toBe('Usage of BAE');
    expect(
      getFirstApronHardCapReason({ hardCapTriggered: 'SignAndTrade' })
    ).toBe('Acquired player via Sign & Trade');
    expect(getFirstApronHardCapReason({ hardCapped: 1 })).toBe(
      'Roster moves (Sign & Trade, MLE, or BAE usage)'
    );
    expect(getFirstApronHardCapReason({})).toBe('Roster moves');
  });
});
