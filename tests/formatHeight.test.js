import { describe, it, expect } from 'vitest';
import { formatHeight } from '@/utils/formatting/formatHeight.js';

describe('formatHeight', () => {
  it('formats inches into feet and inches', () => {
    expect(formatHeight(76)).toBe('6\'4"');
  });

  it('returns 0\'0" for invalid input', () => {
    expect(formatHeight()).toBe('0\'0"');
  });
});
