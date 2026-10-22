import { describe, expect, it } from 'vitest';
import {
  collectDraftSourceInventory,
  draftSourceReadPaths,
  inspectDraftSourceInventory,
  reconcileDraftSourceInventory,
} from '../../scripts/architect/draftSourceInventory';

// A deliberately small, synthetic retained inventory. No NBA evidence is public.
function fixture() {
  return {
    data: {
      inventorySha256: 'a'.repeat(64),
      records: [
        { entitlementId: 'original:one', role: 'original' },
        { entitlementId: 'alias:two', role: 'generated-alias' },
      ],
      unresolved: [
        { dependencyId: 'unresolved:one', entitlementIds: ['alias:two'] },
      ],
    },
    release: {
      foundation: {
        retained: {
          entitlements: [
            {
              entitlementId: 'original:one',
              baselineUnderlyingAssetIdsUnchanged: ['AAA_2030_1st'],
            },
            {
              entitlementId: 'alias:two',
              baselineUnderlyingAssetIdsUnchanged: ['AAA_2030_1st'],
            },
          ],
        },
      },
    },
  } as unknown as Parameters<typeof draftSourceReadPaths>[0];
}
const present = (url: string, fields: Record<string, unknown> = {}) => ({
  name: decodeURIComponent(
    url.replace('https://firestore.googleapis.com/v1/', '')
  ),
  updateTime: '2030-01-01T00:00:00Z',
  fields,
});

describe('source inventory reconciliation before adoption', () => {
  it('reads exact source paths, deduplicates shared underlying picks and preserves aliases and unresolved membership', async () => {
    const loaded = fixture();
    const calls: string[] = [];
    const snapshot = await collectDraftSourceInventory(
      loaded,
      async (url, limit, absent) => {
        calls.push(url);
        expect(limit).toBeLessThanOrEqual(1500000);
        expect(absent).toBe(true);
        if (url.includes('/architect_baseEntitlements/')) return null;
        return present(
          url,
          url.endsWith('/PHI')
            ? {
                entitlementIds: {
                  arrayValue: {
                    values: [{ stringValue: 'unrelated-existing-id' }],
                  },
                },
                roster: {
                  arrayValue: { values: [{ stringValue: 'existing-player' }] },
                },
              }
            : {}
        );
      }
    );
    const before = JSON.stringify(snapshot);
    const result = reconcileDraftSourceInventory(loaded, snapshot);
    expect(calls).toHaveLength(33); // 30 teams + 2 definitions + 1 shared pick.
    expect(
      calls.every((url) =>
        /^https:\/\/firestore\.googleapis\.com\/v1\/projects\/scoutzero-bf1ae\/databases\/\(default\)\/documents\/architect_base(?:Teams|Entitlements|PickRules)\//.test(
          url
        )
      )
    ).toBe(true);
    expect(calls.some((url) => url.includes('original%3Aone'))).toBe(true);
    expect(
      result.entitlements.map((row) => [row.entitlementId, row.definition])
    ).toEqual([
      ['original:one', 'absent'],
      ['alias:two', 'absent'],
    ]);
    expect(result.entitlements[1].unresolvedDependencyIds).toEqual([
      'unresolved:one',
    ]);
    expect(result.entitlements[1].role).toBe('generated-alias');
    expect(
      result.memberships.find((row) => row.team === 'PHI')?.entitlementIds
    ).toEqual(['unrelated-existing-id']);
    expect(result.unresolved).toEqual(loaded.data.unresolved);
    expect(result.writesPerformed).toBe(0);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('reconciles the supported membership revision without changing the raw legacy snapshot', async () => {
    const loaded = fixture();
    const snapshot = await collectDraftSourceInventory(loaded, async (url) =>
      present(url)
    );
    const team = snapshot.documents['architect_baseTeams/PHI']!;
    team.fields.draftSourceRevisions = {
      mapValue: {
        fields: {
          schemaVersion: { integerValue: '1' },
          legacyExists: { booleanValue: true },
          versions: {
            mapValue: {
              fields: {
                '1': {
                  mapValue: {
                    fields: {
                      entitlementIds: {
                        arrayValue: {
                          values: [{ stringValue: 'original:one' }],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const before = JSON.stringify(snapshot);
    const result = reconcileDraftSourceInventory(loaded, snapshot);
    expect(
      result.memberships.find((row) => row.team === 'PHI')?.entitlementIds
    ).toEqual(['original:one']);
    expect(
      result.entitlements.find((row) => row.entitlementId === 'original:one')
        ?.linkedTeams
    ).toEqual(['PHI']);
    expect(team.fields).not.toHaveProperty('entitlementIds');
    expect(JSON.stringify(snapshot)).toBe(before);
    team.fields.draftSourceRevisions = { mapValue: { fields: {} } };
    expect(() => reconcileDraftSourceInventory(loaded, snapshot)).toThrow(
      'SOURCE_TEAM_MEMBERSHIP_INVALID'
    );
  });

  it('does not produce a snapshot when any read is denied; denial is never absence', async () => {
    await expect(
      collectDraftSourceInventory(fixture(), async () => {
        throw new Error('HTTP_403');
      })
    ).rejects.toThrow('HTTP_403');
    await expect(
      collectDraftSourceInventory(fixture(), async () => ({
        error: { code: 403 },
      }))
    ).rejects.toThrow('SOURCE_DOCUMENT_SHAPE_REJECTED');
  });

  it('rejects wrong document identity and missing version needed for a guarded patch', async () => {
    for (const bad of [
      { name: 'another-database', updateTime: '2030-01-01', fields: {} },
      { fields: {} },
    ]) {
      await expect(
        collectDraftSourceInventory(fixture(), async () => bad)
      ).rejects.toThrow('SOURCE_DOCUMENT_SHAPE_REJECTED');
    }
  });

  it('requires every source read and every team, preserving malformed membership as a blocker', async () => {
    const loaded = fixture();
    const snapshot = await collectDraftSourceInventory(loaded, async (url) =>
      present(url)
    );
    const path = 'architect_baseTeams/PHI';
    delete snapshot.documents[path];
    expect(() => reconcileDraftSourceInventory(loaded, snapshot)).toThrow(
      'SOURCE_SNAPSHOT_INCOMPLETE'
    );
    snapshot.documents[path] = null;
    expect(() => reconcileDraftSourceInventory(loaded, snapshot)).toThrow(
      'SOURCE_TEAM_MISSING'
    );
    snapshot.documents[path] = present(
      'https://firestore.googleapis.com/v1/projects/scoutzero-bf1ae/databases/(default)/documents/' +
        path,
      {
        entitlementIds: { stringValue: 'not-an-array' },
      }
    );
    expect(() => reconcileDraftSourceInventory(loaded, snapshot)).toThrow(
      'SOURCE_TEAM_MEMBERSHIP_INVALID'
    );
  });

  it('cannot fetch unverified bytes, duplicate IDs or path traversal', async () => {
    let called = false;
    await expect(
      inspectDraftSourceInventory(Buffer.from('untrusted'), async () => {
        called = true;
      })
    ).rejects.toThrow('Unrecognized release');
    expect(called).toBe(false);
    const loaded = fixture();
    loaded.release.foundation.retained.entitlements[0].entitlementId =
      '../architect_worlds';
    expect(() => draftSourceReadPaths(loaded)).toThrow(
      'SOURCE_DOCUMENT_ID_REJECTED'
    );
    loaded.release.foundation.retained.entitlements[0].entitlementId =
      'alias:two';
    expect(() => draftSourceReadPaths(loaded)).toThrow('SOURCE_DUPLICATE_ID');
  });
});
