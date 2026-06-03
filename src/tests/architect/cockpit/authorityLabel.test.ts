/**
 * FILE: src/tests/architect/cockpit/authorityLabel.test.ts
 * PURPOSE: Unit coverage for the shared authority-label vocabulary helper
 *          (interconnectivity Slice 1). Asserts every row of master spec §4.1
 *          maps to the correct user-facing label/tone and that internal mode
 *          words never leak.
 * OWNERSHIP: Feature: architect/cockpit
 */
import { describe, expect, it } from 'vitest';
import {
  getAuthorityLabel,
  AUTHORITY_TONE_BADGE_CLASSES,
  type AuthorityTone,
} from '@/features/architect/cockpit/authorityLabel';

describe('getAuthorityLabel — master spec §4.1 vocabulary', () => {
  it('maps committed-world kind to Committed', () => {
    expect(getAuthorityLabel({ kind: 'committed-world' })).toEqual({
      label: 'Committed',
      tone: 'committed',
    });
  });

  it('maps a committed receipt authority to Committed', () => {
    expect(getAuthorityLabel({ receiptAuthority: 'committed-world' })).toEqual({
      label: 'Committed',
      tone: 'committed',
    });
  });

  it('maps a world/history event to World event', () => {
    expect(getAuthorityLabel({ isWorldEvent: true })).toEqual({
      label: 'World event',
      tone: 'committed',
    });
  });

  it('maps sandbox to Sandbox', () => {
    expect(getAuthorityLabel({ kind: 'sandbox' })).toEqual({
      label: 'Sandbox',
      tone: 'sandbox',
    });
  });

  it('maps local-only-preview (trade draft / FA target) to Local draft', () => {
    expect(getAuthorityLabel({ kind: 'local-only-preview' })).toEqual({
      label: 'Local draft',
      tone: 'local',
    });
  });

  it('maps pending-world-preview to Pending', () => {
    expect(getAuthorityLabel({ kind: 'pending-world-preview' })).toEqual({
      label: 'Pending',
      tone: 'pending',
    });
  });

  it('maps failed-world-preview to Failed', () => {
    expect(getAuthorityLabel({ kind: 'failed-world-preview' })).toEqual({
      label: 'Failed',
      tone: 'failed',
    });
  });

  it('maps dev-only-preview to DEV preview', () => {
    expect(getAuthorityLabel({ kind: 'dev-only-preview' })).toEqual({
      label: 'DEV preview',
      tone: 'dev',
    });
  });

  it('maps unavailable to Unavailable', () => {
    expect(getAuthorityLabel({ kind: 'unavailable' })).toEqual({
      label: 'Unavailable',
      tone: 'unavailable',
    });
  });

  it('maps the not-modeled-yet flag to Deferred', () => {
    expect(getAuthorityLabel({ deferred: true })).toEqual({
      label: 'Deferred',
      tone: 'unavailable',
    });
  });

  it('maps a multi-season boundary to Multi-season', () => {
    expect(getAuthorityLabel({ multiSeason: true })).toEqual({
      label: 'Multi-season',
      tone: 'warn',
    });
  });

  it('maps a viewing/world season divergence to Season mismatch', () => {
    expect(getAuthorityLabel({ seasonMismatch: true })).toEqual({
      label: 'Season mismatch',
      tone: 'warn',
    });
  });

  it('falls back to Unavailable for an empty input', () => {
    expect(getAuthorityLabel()).toEqual({
      label: 'Unavailable',
      tone: 'unavailable',
    });
  });

  it('lets season modifiers win over the underlying committed kind', () => {
    expect(
      getAuthorityLabel({ kind: 'committed-world', seasonMismatch: true })
    ).toEqual({ label: 'Season mismatch', tone: 'warn' });
  });

  it('never surfaces internal mode words as labels', () => {
    const internalWords = ['vacuum', 'baseLocalValidated', 'worldOptimisticPreview'];
    const kinds = [
      'committed-world',
      'sandbox',
      'local-only-preview',
      'pending-world-preview',
      'failed-world-preview',
      'dev-only-preview',
      'loading',
      'unavailable',
      'error',
    ] as const;
    for (const kind of kinds) {
      const { label } = getAuthorityLabel({ kind });
      for (const word of internalWords) {
        expect(label).not.toContain(word);
      }
    }
  });
});

describe('AUTHORITY_TONE_BADGE_CLASSES', () => {
  it('defines a class string for every tone', () => {
    const tones: AuthorityTone[] = [
      'committed',
      'local',
      'pending',
      'failed',
      'dev',
      'sandbox',
      'unavailable',
      'warn',
    ];
    for (const tone of tones) {
      expect(typeof AUTHORITY_TONE_BADGE_CLASSES[tone]).toBe('string');
      expect(AUTHORITY_TONE_BADGE_CLASSES[tone].length).toBeGreaterThan(0);
    }
  });
});
