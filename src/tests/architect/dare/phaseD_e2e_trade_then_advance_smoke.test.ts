/**
 * BZE-289 exact authority boundary for the former trade-to-advance DARE smoke.
 * Draft Trade Call ownership, Stepien, freeze, conveyance, and swap verdicts
 * are explicitly outside this Season Advance tranche.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSeasonAdvanceAuthority } from '@/features/architect/utils/seasonManager.authority';

const UTILS_ROOT = resolve(__dirname, '../../../features/architect/utils');

function readUtility(fileName: string): string {
  return readFileSync(resolve(UTILS_ROOT, fileName), 'utf8');
}

describe('BZE-289 trade / entitlement boundary at Season Advance', () => {
  it('publishes the exact preserve-or-fail-closed authority boundary', () => {
    const result = resolveSeasonAdvanceAuthority({
      worldId: 'world-bze-289-boundary',
      worldSeason: '2025-26',
      worldAsOfDate: '2026-04-12',
    });

    expect(result.status).toBe('complete');
    if (result.status !== 'complete') return;

    expect(result.authority.entitlementBoundary).toEqual({
      mode: 'preserve-or-fail-closed',
      authenticatedCanonLeafIds: ['CBA2-A12.3'],
      governingCanonLeafIds: [
        'CBA2-A12.3',
        'CBA2-L08.1',
        'CBA2-L09.2',
      ],
      missingGovernedInputs: [
        'governedDraftHistory.ownership',
        'governedDraftHistory.protection',
        'governedDraftHistory.conveyance',
        'governedDraftHistory.freeze',
        'governedDraftHistory.unfreeze',
        'governedDraftHistory.penalty',
        'governedDraftHistory.requiredTransition',
      ],
      excludedVerdicts: [
        'draft-ownership',
        'stepien',
        'second-apron-freeze',
        'conveyance',
        'swap',
      ],
    });
  });

  it('carries the boundary into the immutable transition manifest', () => {
    const manager = readUtility('seasonManager.ts');
    const authority = readUtility('seasonManager.authority.ts');

    expect(manager).toContain(
      'entitlementBoundary: authority.entitlementBoundary'
    );
    expect(manager).not.toContain('resolveAllDraftAssets');
    expect(authority).not.toContain("unavailableCanonLeafId: 'CBA2-A12.3'");
    expect(authority).toContain("'governedDraftHistory.requiredTransition'");
    expect(authority).toContain("'CBA2-A12.3'");
    expect(authority).toContain("'CBA2-L08.1'");
    expect(authority).toContain("'CBA2-L09.2'");
  });

  it('does not recalculate Stepien or entitlement ownership on the governed path', () => {
    const manager = readUtility('seasonManager.ts');
    const transition = readUtility('seasonManager.teamTransition.ts');

    expect(manager).toContain('preserveDraftEntitlements: true');
    expect(transition).toContain(
      'if (!resolutionContext.preserveDraftEntitlements) {'
    );
    expect(transition).toContain('updateDraftPicksWithStepien(');
    expect(transition).toContain('resolveEntitlementsForTeam(');
  });
});
