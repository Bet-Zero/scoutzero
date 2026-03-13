/**
 * FILE: src/tests/architect/consentUtils.compatibility.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E80 consentUtils TS authority + JS shim split.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-13: E80 - Added compatibility and behavior-preservation guardrails for consentUtils.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  birdRightsVetoApplies,
  collectConsentViolations,
  destinationRequiresLimitedNTCConsent,
  hasConsent,
  hasFullNTC,
  requiresBirdOneYearConsent,
  requiresConsent,
  requiresFullNTCConsent,
  requiresLimitedNTCConsent,
  requiresOneYearBirdVetoConsent,
} from '@/features/architect/utils/consentUtils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcRoot = path.resolve(__dirname, '../../features/architect');
const consentUtilsShimPath = path.join(srcRoot, 'utils/consentUtils.js');

describe('E80 consentUtils compatibility guardrails', () => {
  it('consentUtils.js remains a pure compatibility shim', () => {
    const source = fs.readFileSync(consentUtilsShimPath, 'utf-8');

    expect(source).toContain("export * from './consentUtils.ts';");
    expect(source).not.toContain('export function requiresConsent');
    expect(source).not.toContain('export function collectConsentViolations');
    expect(source).not.toContain('Player NTC — consent required');
  });

  it('explicit .js import exposes the same named API as extensionless imports', async () => {
    const explicitJsModule = await import(
      '../../features/architect/utils/consentUtils.js'
    );

    expect(Object.keys(explicitJsModule).sort()).toEqual([
      'birdRightsVetoApplies',
      'collectConsentViolations',
      'destinationRequiresLimitedNTCConsent',
      'hasConsent',
      'hasFullNTC',
      'requiresBirdOneYearConsent',
      'requiresConsent',
      'requiresFullNTCConsent',
      'requiresLimitedNTCConsent',
      'requiresOneYearBirdVetoConsent',
    ]);
    expect('default' in explicitJsModule).toBe(false);
    expect(explicitJsModule.requiresConsent).toBe(requiresConsent);
    expect(explicitJsModule.hasConsent).toBe(hasConsent);
    expect(explicitJsModule.birdRightsVetoApplies).toBe(birdRightsVetoApplies);
    expect(explicitJsModule.hasFullNTC).toBe(hasFullNTC);
    expect(explicitJsModule.destinationRequiresLimitedNTCConsent).toBe(
      destinationRequiresLimitedNTCConsent
    );
    expect(explicitJsModule.requiresBirdOneYearConsent).toBe(
      requiresBirdOneYearConsent
    );
    expect(explicitJsModule.collectConsentViolations).toBe(
      collectConsentViolations
    );
    expect(explicitJsModule.requiresFullNTCConsent).toBe(
      requiresFullNTCConsent
    );
    expect(explicitJsModule.requiresLimitedNTCConsent).toBe(
      requiresLimitedNTCConsent
    );
    expect(explicitJsModule.requiresOneYearBirdVetoConsent).toBe(
      requiresOneYearBirdVetoConsent
    );
  });

  it('accepts the exact consent alias matrix', () => {
    const aliasCases = [
      { player: { consentGranted: true } },
      { player: { consent: true } },
      { player: { consents: { full: true } } },
      { player: { consents: { limited: true } } },
      { player: { consents: { birdOneYear: true } } },
      { player: { hasConsented: true } },
      { player: { hasTradeConsent: true } },
    ];

    aliasCases.forEach(({ player }) => {
      expect(hasConsent(player)).toBe(true);
    });
    expect(hasConsent({ consentGranted: false, hasTradeConsent: false })).toBe(
      false
    );
  });

  it('preserves the current divergent limited-NTC semantics between helper entrypoints', () => {
    const player = { limitedNTCTeams: ['LAL'] };

    expect(requiresConsent(player, 'LAL')).toBe(true);
    expect(destinationRequiresLimitedNTCConsent(player, 'LAL')).toBe(false);
    expect(requiresConsent(player, 'BOS')).toBe(false);
    expect(destinationRequiresLimitedNTCConsent(player, 'BOS')).toBe(true);
  });

  it('preserves full NTC aliases and Bird veto detection behavior', () => {
    expect(hasFullNTC({ hasFullNTC: true })).toBe(true);
    expect(requiresFullNTCConsent({ contract: { fullNTC: true } })).toBe(true);
    expect(
      birdRightsVetoApplies(
        { onOneYearBirdDeal: true, currentTeamId: 'ATL' },
        'BOS'
      )
    ).toBe(true);
    expect(
      birdRightsVetoApplies(
        { onOneYearBirdDeal: true, currentTeamId: 'ATL' },
        'ATL'
      )
    ).toBe(false);
  });

  it('preserves direct and derived one-year Bird consent behavior', () => {
    expect(requiresBirdOneYearConsent({ oneYearBirdVeto: true })).toBe(true);
    expect(requiresOneYearBirdVetoConsent({ onOneYearBirdDeal: true })).toBe(
      true
    );
    expect(
      requiresBirdOneYearConsent({
        contract: { yearsRemaining: 1 },
        rights: { bird: true },
      })
    ).toBe(true);
    expect(
      requiresBirdOneYearConsent({
        contract: { yearsRemaining: 2 },
        rights: { bird: true },
      })
    ).toBe(false);
  });

  it('preserves collectConsentViolations ordering, notifier side effects, and no-op fallback behavior', () => {
    const rejects: string[] = [];
    const player = {
      hasFullNTC: true,
      oneYearBirdVeto: true,
    };

    const messages = collectConsentViolations(player, 'BOS', {}, {
      reject: (message) => rejects.push(message),
    });

    expect(messages).toEqual([
      'Player NTC — consent required',
      '1-yr Bird veto — consent required',
    ]);
    expect(rejects).toEqual([
      'Player NTC — consent required',
      '1-yr Bird veto — consent required',
    ]);
    expect(collectConsentViolations({ hasFullNTC: true }, 'BOS')).toEqual([
      'Player NTC — consent required',
    ]);
  });

  it('preserves the current violation collection quirks without dedupe or normalization', () => {
    expect(
      collectConsentViolations(
        {
          hasFullNTC: true,
          limitedNTCTeams: ['ATL'],
        },
        'BOS'
      )
    ).toEqual(['Player NTC — consent required']);

    expect(
      collectConsentViolations(
        {
          hasFullNTC: true,
          oneYearBirdVeto: true,
        },
        'BOS',
        { bird: true }
      )
    ).toEqual([]);
  });
});
