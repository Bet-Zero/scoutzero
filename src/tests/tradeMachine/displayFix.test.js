
import { describe, it, expect } from 'vitest'; // Assuming vitest based on previous cues
import { formatSwapInfo, formatPick } from '@/features/architect/utils/tradeHelpers';

describe('Trade Display Fixes', () => {
  it('formats scraper swap data correctly (Best of)', () => {
    const pick = {
      year: 2028,
      round: 1,
      isSwap: true,
      swapDetails: {
        swapWith: ['OKC'],
        favorable: 'most'
      }
    };
    // Expected: Swap (Best of) vs OKC
    expect(formatSwapInfo(pick)).toBe('Swap (Best of) vs OKC');
  });

  it('formats scraper swap data correctly (Worst of)', () => {
    const pick = {
      isSwap: true,
      swapDetails: {
        swapWith: ['NYK'],
        favorable: 'least'
      }
    };
    expect(formatSwapInfo(pick)).toBe('Swap (Worst of) vs NYK');
  });

  it('prioritizes UI props (swapWithTeamId)', () => {
    const pick = {
      isSwap: true,
      swapType: 'best_of',
      swapWithTeamId: 'BKN',
      swapDetails: {
         swapWith: ['OldScrapeData']
      }
    };
    expect(formatSwapInfo(pick)).toBe('Swap (Best of) vs BKN');
  });
  
  it('formats pick string without emojis', () => {
     const pick = {
      year: 2025,
      round: 1,
      isSwap: true,
      swapDetails: { swapWith: ['GSW'] }
    };
    const str = formatPick(pick, { includeNote: false });
    expect(str).toContain('Swap (Best of) vs GSW');
    expect(str).not.toMatch(/[\uD800-\uDBFF][\uDC00-\uDFFF]/); // Emoji regex check
  });
});
