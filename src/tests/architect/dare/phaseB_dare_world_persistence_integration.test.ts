/**
 * BZE-289 boundary regression: the governed 30-team Season Advance must not
 * silently become a DARE consumer while CBA2-A12.3 is unavailable through the
 * mandatory Canon lookup. Standalone DARE behavior remains covered by its own
 * suites; this file fences the Season Advance handoff only.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const UTILS_ROOT = resolve(__dirname, '../../../features/architect/utils');

function readUtility(fileName: string): string {
  return readFileSync(resolve(UTILS_ROOT, fileName), 'utf8');
}

describe('BZE-289 governed Season Advance / DARE boundary', () => {
  it('does not call DARE or claim an entitlement-transition verdict', () => {
    const source = readUtility('seasonManager.ts');

    expect(source).not.toContain('resolveAllDraftAssets');
    expect(source).not.toContain('applyGatedDraftPicksTransition');
    expect(source).toContain('preserveDraftEntitlements: true');
    expect(source).toContain(
      'draftResolutionInfo: { draftYear, hadPositions: false }'
    );
  });

  it('fails before league loading or any write when saved draft positions require a transition', () => {
    const source = readUtility('seasonManager.ts');
    const positionsRead = source.indexOf(
      'const positionsMap = await getDraftPositionsMap(worldId, draftYear);'
    );
    const entitlementFailure = source.indexOf(
      'Required entitlement transition for draft year'
    );
    const leagueRead = source.indexOf('const teams = await getLeague(worldId);');
    const transaction = source.indexOf('await runTransaction(db');

    expect(positionsRead).toBeGreaterThan(-1);
    expect(entitlementFailure).toBeGreaterThan(positionsRead);
    expect(leagueRead).toBeGreaterThan(entitlementFailure);
    expect(transaction).toBeGreaterThan(leagueRead);
  });

  it('guards every legacy entitlement mutation behind the non-preserving path', () => {
    const source = readUtility('seasonManager.teamTransition.ts');

    expect(source).toContain('!resolutionContext.preserveDraftEntitlements');
    expect(source).toContain('resolveEntitlementsForTeam(');
    expect(source).toContain('updateDraftPicksWithStepien(');
    expect(source).toMatch(
      /if \(!resolutionContext\.preserveDraftEntitlements\) \{[\s\S]*updateDraftPicksWithStepien\(/
    );
  });
});
