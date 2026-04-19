/**
 * FILE: src/tests/videoExamples.undefined.test.ts
 * PURPOSE: Test that video examples never include undefined field values
 * OWNERSHIP: Testing (hotfix validation)
 *
 * HISTORY:
 *  - 2026-01-22: Created for hotfix validation - undefined field prevention
 *
 * LINKS:
 *  - Hotfix: docs/return_packages/scouting/SCOUTING_PLAYER_PROFILE_HOTFIX_UNDEFINED_RP.md
 */

import { describe, it, expect } from 'vitest';
import {
  buildVideoExample,
  normalizeVideoExamples,
} from '@/shared/utils/videoExamples';

describe('Video Examples - Undefined Field Prevention', () => {
  describe('buildVideoExample', () => {
    it('should not include undefined label when label is empty', () => {
      const result = buildVideoExample('https://youtube.com/watch?v=test', '');
      expect(result).toBeDefined();
      expect(result.url).toBe('https://youtube.com/watch?v=test');
      expect(result.createdAt).toBeDefined();
      expect('label' in result).toBe(false); // Should not have label key at all
    });

    it('should include label when provided', () => {
      const result = buildVideoExample(
        'https://youtube.com/watch?v=test',
        'Test Label'
      );
      expect(result).toBeDefined();
      expect(result.url).toBe('https://youtube.com/watch?v=test');
      expect(result.label).toBe('Test Label');
      expect(result.createdAt).toBeDefined();
    });

    it('should not include undefined label when label is whitespace', () => {
      const result = buildVideoExample(
        'https://youtube.com/watch?v=test',
        '   '
      );
      expect(result).toBeDefined();
      expect('label' in result).toBe(false);
    });

    it('should always include createdAt timestamp', () => {
      const result = buildVideoExample('https://youtube.com/watch?v=test', '');
      expect(result.createdAt).toBeDefined();
      expect(typeof result.createdAt).toBe('number');
    });
  });

  describe('normalizeVideoExamples', () => {
    it('should not propagate undefined values in nested structures', () => {
      const input = {
        overall: [
          { url: 'https://youtube.com/watch?v=test1', label: undefined },
          { url: 'https://youtube.com/watch?v=test2', label: 'Valid Label' },
        ],
      };

      const result = normalizeVideoExamples(input);
      expect(result.overall).toHaveLength(2);

      // First video should not have label key
      expect('label' in result.overall[0]).toBe(false);
      expect(result.overall[0].url).toBe('https://youtube.com/watch?v=test1');

      // Second video should have label
      expect(result.overall[1].label).toBe('Valid Label');
      expect(result.overall[1].url).toBe('https://youtube.com/watch?v=test2');
    });

    it('should handle empty string labels by omitting them', () => {
      const input = {
        overall: [{ url: 'https://youtube.com/watch?v=test', label: '' }],
      };

      const result = normalizeVideoExamples(input);
      expect(result.overall).toHaveLength(1);
      expect('label' in result.overall[0]).toBe(false);
    });
  });
});
