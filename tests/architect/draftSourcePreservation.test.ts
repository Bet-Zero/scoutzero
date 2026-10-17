import { describe, expect, it } from 'vitest';
import { readDraftSourceForWorld } from '@/features/architect/utils/entitlements/draftSourceBaseline';
import {
  draftSourceReadRuleAddition,
  verifyDraftSourceReadRuleAddition,
  prepareDraftSourceCommit,
  preserveDraftSourceBaseline,
} from '../../scripts/architect/draftSourcePreservation';
import { resolvePickRuleWithDb } from '@/features/architect/utils/entitlements/pickRulesResolver';
import {
  loadTeamCapSheet,
  getAllTeams,
} from '@/features/architect/utils/firebaseTeamPlanHelpers';
import { readArchitectTeam } from '@/features/architect/utils/architectFirestoreBoundary';
import { createMockTeam, seedMockData } from '../helpers/architectTestHelpers';
import { db } from '@/firebaseConfig';

describe('draft source adoption preserves saved simulations', () => {
  it('keeps absent fields absent, explicit empty arrays empty, and unrelated team fields current', () => {
    for (const before of [
      { roster: ['a'] },
      { roster: ['a'], entitlementIds: [] },
    ]) {
      const prepared = preserveDraftSourceBaseline(
        before,
        { ...before, entitlementIds: ['new'] },
        'team'
      );
      expect(
        readDraftSourceForWorld(prepared.after, 'old-world', 'team')
      ).toEqual(before);
      expect(readDraftSourceForWorld(prepared.after, null, 'team')).toEqual({
        ...before,
        entitlementIds: ['new'],
      });
      expect(
        readDraftSourceForWorld(
          { ...prepared.after, roster: ['later-player'] },
          'old-world',
          'team'
        )?.roster
      ).toEqual(['later-player']);
      expect(prepared.updateMask).toEqual(['draftSourceRevisions']);
    }
  });

  it('keeps legacy fields byte-equivalent and refuses to replace an immutable revision', () => {
    const original = {
      holderTeam: 'AAA',
      description: 'original',
      id: 'stable',
    };
    const desired = { ...original, holderTeam: 'BBB' };
    const first = preserveDraftSourceBaseline(original, desired, 'entitlement');
    expect(first.after.holderTeam).toBe('AAA');
    expect(
      readDraftSourceForWorld(first.after, 'any-world', 'entitlement')
    ).toEqual(original);
    expect(readDraftSourceForWorld(first.after, null, 'entitlement')).toEqual(
      desired
    );
    expect(() =>
      preserveDraftSourceBaseline(
        first.after,
        { ...desired, holderTeam: 'CCC' },
        'entitlement'
      )
    ).toThrow('IMMUTABLE_DRAFT_REVISION_CONFLICT');
    expect(
      preserveDraftSourceBaseline(first.after, desired, 'entitlement').after
    ).toEqual(first.after);
  });

  it('never silently adopts a later revision and rejects mismatched rule identities', () => {
    const source = {
      holderTeam: 'AAA',
      draftSourceRevisions: {
        schemaVersion: 1,
        legacyExists: true,
        versions: {
          '1': { holderTeam: 'BBB' },
          '2': { holderTeam: 'CCC' },
        },
      },
    };
    expect(
      readDraftSourceForWorld(source, null, 'entitlement')?.holderTeam
    ).toBe('BBB');
    expect(
      readDraftSourceForWorld(source, 'saved', 'entitlement')?.holderTeam
    ).toBe('AAA');
    const futureOnly = {
      holderTeam: 'AAA',
      draftSourceRevisions: {
        schemaVersion: 1,
        legacyExists: true,
        versions: { '2': { holderTeam: 'CCC' } },
      },
    };
    expect(readDraftSourceForWorld(futureOnly, null, 'entitlement')).toEqual({
      holderTeam: 'AAA',
    });
    expect(() =>
      preserveDraftSourceBaseline(
        null,
        { pickId: 'AAA_2030_1st', seasonYear: 2031, round: 1 },
        'pickRule'
      )
    ).toThrow();
    const prepared = preserveDraftSourceBaseline(
      null,
      { pickId: 'AAA_2030_1st', seasonYear: 2030, round: 1 },
      'pickRule'
    );
    expect(() =>
      readDraftSourceForWorld(
        { pickId: 'BBB_2030_1st', ...prepared.after },
        null,
        'pickRule'
      )
    ).toThrow();
  });

  it('does not retroactively introduce a newly created pick rule (single reader)', async () => {
    const rule = {
      pickId: 'AAA_2030_1st',
      seasonYear: 2030,
      round: 1,
      protections: [],
      source: 'synthetic',
      updatedAtISO: '2026-01-01T00:00:00Z',
    };
    const prepared = preserveDraftSourceBaseline(null, rule, 'pickRule');
    seedMockData('architect_basePickRules/AAA_2030_1st', prepared.after);
    expect(await resolvePickRuleWithDb(db, rule.pickId)).toEqual(rule);
    expect(await resolvePickRuleWithDb(db, rule.pickId, 'saved')).toBeNull();
  });

  it('rejects identity changes, unrelated fields, malformed baselines and overwriting prior values', () => {
    expect(() =>
      preserveDraftSourceBaseline({ id: 'a' }, { id: 'b' }, 'entitlement')
    ).toThrow();
    expect(() =>
      preserveDraftSourceBaseline({ roster: [] }, { roster: ['b'] }, 'team')
    ).toThrow();
    expect(() =>
      preserveDraftSourceBaseline({ holderTeam: 'A' }, {}, 'entitlement')
    ).toThrow();
    expect(() =>
      readDraftSourceForWorld({ draftSourceRevisions: {} }, null, 'team')
    ).toThrow();
    const first = preserveDraftSourceBaseline(
      { holderTeam: 'A' },
      { holderTeam: 'B' },
      'entitlement'
    );
    expect(() =>
      preserveDraftSourceBaseline(
        first.after,
        { ...first.after, draftSourceRevisions: {} },
        'entitlement'
      )
    ).toThrow();
    expect(() =>
      preserveDraftSourceBaseline(null, { entitlementIds: [] }, 'team')
    ).toThrow();
  });

  it('prepares one atomic body with draft-only masks and exact concurrency guards', () => {
    const timestamp = '2026-01-01T00:00:00.123456Z';
    const body = prepareDraftSourceCommit([
      {
        kind: 'entitlement',
        path: 'architect_baseEntitlements/existing',
        before: { holderTeam: 'AAA', id: 'existing' },
        after: { holderTeam: 'BBB', id: 'existing' },
        updateTime: timestamp,
      },
      {
        kind: 'pickRule',
        path: 'architect_basePickRules/AAA_2030_1st',
        before: null,
        after: {
          pickId: 'AAA_2030_1st',
          seasonYear: 2030,
          round: 1,
          protections: [],
        },
      },
      {
        kind: 'team',
        path: 'architect_baseTeams/BBB',
        before: { roster: ['unchanged'] },
        after: { roster: ['unchanged'], entitlementIds: ['existing'] },
        updateTime: timestamp,
      },
    ]);
    expect(body.writes).toHaveLength(3);
    expect(body.writes.map((w) => w.currentDocument)).toEqual([
      { updateTime: timestamp },
      { exists: false },
      { updateTime: timestamp },
    ]);
    expect(body.writes[2].updateMask?.fieldPaths).toEqual([
      'draftSourceRevisions',
    ]);
    expect(body.writes[2].update.fields).not.toHaveProperty('roster');
    expect(body.writes[0].update.fields).not.toHaveProperty('id');
    expect(body.writes[1]).not.toHaveProperty('updateMask');
  });

  it('rejects unguarded updates, duplicate paths and world writes before producing any body', () => {
    const change = {
      kind: 'team' as const,
      path: 'architect_baseTeams/BBB',
      before: {},
      after: { entitlementIds: [] },
      updateTime: '2026-01-01T00:00:00Z',
    };
    expect(() =>
      prepareDraftSourceCommit([{ ...change, updateTime: undefined }])
    ).toThrow();
    expect(() => prepareDraftSourceCommit([change, change])).toThrow();
    expect(() =>
      prepareDraftSourceCommit([{ ...change, path: 'architect_worlds/BBB' }])
    ).toThrow();
    expect(() =>
      prepareDraftSourceCommit([
        { ...change, path: 'architect_baseTeams/BBB/extra' },
      ])
    ).toThrow();
    expect(() =>
      prepareDraftSourceCommit([{ ...change, after: { roster: ['changed'] } }])
    ).toThrow();
  });

  it('allows only the exact authenticated source-read addition, preserving every existing rule byte', () => {
    const baseline =
      "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    // existing private rules retained\n  }\n}\n";
    const addition = draftSourceReadRuleAddition(
      'synthetic:entitlement',
      'AAA_2030_1st'
    );
    const offset = baseline.indexOf('    // existing');
    const proposed =
      baseline.slice(0, offset) + addition + baseline.slice(offset);
    expect(() =>
      verifyDraftSourceReadRuleAddition(
        baseline,
        proposed,
        'synthetic:entitlement',
        'AAA_2030_1st'
      )
    ).not.toThrow();
    for (const mutated of [
      proposed.replace('request.auth != null', 'true'),
      proposed.replace('allow write: if false', 'allow write: if true'),
      proposed.replace('existing private', 'changed private'),
      proposed + addition,
    ]) {
      expect(() =>
        verifyDraftSourceReadRuleAddition(
          baseline,
          mutated,
          'synthetic:entitlement',
          'AAA_2030_1st'
        )
      ).toThrow();
    }
    expect(() =>
      draftSourceReadRuleAddition("injected' || true", 'AAA_2030_1st')
    ).toThrow();
    expect(() =>
      verifyDraftSourceReadRuleAddition(
        proposed,
        proposed + addition,
        'synthetic:entitlement',
        'AAA_2030_1st'
      )
    ).toThrow();
  });

  it('keeps base-only dashboard readers compatible while exposing the supported revision', async () => {
    const before = createMockTeam({
      teamCode: 'LAL',
      roster: [],
      entitlementIds: [],
    });
    seedMockData('architect_baseTeams/LAL', before);
    const oldTeamList = await getAllTeams();
    const prepared = preserveDraftSourceBaseline(
      before,
      { ...before, entitlementIds: ['synthetic-current'] },
      'team'
    );
    seedMockData('architect_baseTeams/LAL', prepared.after);
    const loaded = await loadTeamCapSheet('LAL');
    expect(loaded).not.toBeNull();
    expect(loaded?.entitlementIds).toEqual(['synthetic-current']);
    expect(loaded?.baseline).not.toHaveProperty('draftSourceRevisions');
    expect(() =>
      readArchitectTeam(loaded, 'synthetic-base-reader', 'LAL')
    ).not.toThrow();
    expect(await getAllTeams()).toEqual(oldTeamList);
    const { draftSourceRevisions: _revisions, ...legacyFields } =
      prepared.after;
    expect(legacyFields).toEqual(before);
  });

  it('leaves unadopted legacy source records unchanged', () => {
    const legacy = { holderTeam: 'AAA', notes: 'legacy' };
    expect(readDraftSourceForWorld(legacy, 'saved', 'entitlement')).toBe(
      legacy
    );
  });
});
