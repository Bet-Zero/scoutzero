import { describe, expect, it } from 'vitest';
import { buildDraftPickArchivalPoolView } from '@/features/architect/utils/draftPickArchivalPoolView';
import { buildDraftPickFoundation } from '@/features/architect/utils/draftPickFoundation';
import {
  serializeDraftPickFoundation,
  loadDraftPickRelease,
} from '@/features/architect/utils/draftPickRelease';
import { sha256Digest } from '@/features/architect/utils/contractSource/deterministicDigest';
import {
  archivalSelection,
  syntheticArchivalInput,
} from './fixtures/draftPickArchival';

// Keep corruption probes readable without constraining fixtures to inferred literals.
const fixture = (): any => syntheticArchivalInput();
const map = (input: any) => input.retainedArtifacts[0].content;
const native = (input: any) => input.retainedArtifacts[1].content;
const build = (input: unknown) =>
  buildDraftPickArchivalPoolView(input, archivalSelection);

describe('disconnected archival pool view', () => {
  it('binds twelve aliases to two exact pools without changing rights, lineage or accounting', () => {
    const input = fixture();
    const original = structuredClone(input);
    const result = build(input);
    expect(result.foundation).toEqual(buildDraftPickFoundation(original));
    expect(result.bindings).toHaveLength(12);
    expect(result.foundation.retainedArtifacts).toEqual(
      original.retainedArtifacts
    );
    expect(result.foundation.sourceRights).toEqual(original.sourceRights);
    expect(result.foundation.retained).toEqual(original.retained);
    expect(result.foundation.originalPicks).toHaveLength(6);
    for (const row of result.bindings) {
      expect(row.rawArchivalRecord).toEqual(
        map(original).rows.find((r: any) => r.legacyId === row.legacyId)
          .legacyMeaningPreserved
      );
      expect(row).toMatchObject({
        economicCorrespondence: 'unresolved',
        transferableRightEstablished: false,
        executable: false,
        accountingDelta: 0,
      });
      expect(row.referencedOriginalPicks).toHaveLength(3);
    }
    expect(
      result.bindings.filter((r) => r.nativePoolFamily === 'AAA/BBB/CCC:2030')
    ).toHaveLength(6);
    expect(
      result.foundation.legacyRecords.every(
        (r) => !r.wholeAssetReady && !r.executable
      )
    ).toBe(true);
    expect(result.execution).toBe('disabled');
    expect(input).toEqual(original);
    input.retainedArtifacts[0].content.rows[0].legacyMeaningPreserved.receivesRank[0] = 99;
    expect(result.bindings[0].rawArchivalRecord.receivesRank).toEqual([1]);
    expect(Object.isFrozen(result.bindings[0].rawArchivalRecord)).toBe(true);
  });

  it('rebuilds the same view after the existing retained-release round trip', async () => {
    const view = build(fixture());
    const serialized = serializeDraftPickFoundation(view.foundation);
    const loaded = await loadDraftPickRelease(
      serialized,
      {
        release: view.foundation.release,
        payloadSha256: (await sha256Digest(serialized)).slice(7),
      },
      'retained-baseline'
    );
    const rebuilt = build(
      JSON.parse(serializeDraftPickFoundation(loaded.foundation))
    );
    expect(rebuilt).toEqual(view);
    expect(serialized).not.toContain('archival-to-native-pool-only');
    expect(loaded.execution).toBe('disabled');
  });

  it.each([
    [
      'unknown clause',
      (d: any) => {
        map(d).rows[0].nativePoolClauseIds = ['unknown'];
      },
    ],
    [
      'wrong native pool despite inherited overlap',
      (d: any) => {
        map(d).rows[0].nativePoolClauseIds = ['synthetic-native-1'];
      },
    ],
    [
      'wrong native year',
      (d: any) => {
        native(d).nativeClauses[0].years = [2031];
      },
    ],
    [
      'wrong selection year',
      (d: any) => {
        native(
          d
        ).nativeClauses[0].signature.semantic.children[0].parameters.contextYear =
          2031;
      },
    ],
    [
      'wrong clause round',
      (d: any) => {
        native(d).nativeClauses[0].signature.round = 2;
      },
    ],
    [
      'wrong family',
      (d: any) => {
        map(d).rows[0].nativePoolFamily = 'XXX/YYY/ZZZ:2030';
      },
    ],
    [
      'wrong original year',
      (d: any) => {
        map(d).pools['AAA/BBB/CCC:2030'].referencedOriginalPicks[0] =
          'AAA_2031_1st';
      },
    ],
    [
      'wrong original team',
      (d: any) => {
        map(d).pools['AAA/BBB/CCC:2030'].referencedOriginalPicks[0] =
          'XXX_2030_1st';
      },
    ],
    [
      'duplicate alias',
      (d: any) => {
        map(d).rows[1] = structuredClone(map(d).rows[0]);
      },
    ],
    [
      'missing alias',
      (d: any) => {
        map(d).rows.pop();
      },
    ],
    [
      'duplicate clause',
      (d: any) => {
        native(d).nativeClauses.push(native(d).nativeClauses[0]);
      },
    ],
    [
      'duplicate clause reference',
      (d: any) => {
        map(d).rows[0].nativePoolClauseIds.push('synthetic-native-0');
      },
    ],
    [
      'duplicate raw right',
      (d: any) => {
        native(d).rights.push(native(d).rights[0]);
      },
    ],
    [
      'missing raw right',
      (d: any) => {
        native(d).rights.shift();
      },
    ],
    [
      'fabricated holder',
      (d: any) => {
        map(d).rows[0].legacyMeaningPreserved.holderTeam = 'ZZZ';
      },
    ],
    [
      'fabricated kind',
      (d: any) => {
        map(d).rows[0].legacyMeaningPreserved.kind = 'conveyance_right';
      },
    ],
    [
      'fabricated selector',
      (d: any) => {
        map(d).rows[0].legacyMeaningPreserved.receivesRank = [3];
      },
    ],
    [
      'unknown occurrence',
      (d: any) => {
        map(d).rows[0].occurrenceIds = ['missing'];
      },
    ],
    [
      'wrong occurrence',
      (d: any) => {
        map(d).rows[0].occurrenceIds = map(d).rows[1].occurrenceIds;
      },
    ],
    [
      'wrong dependency family',
      (d: any) => {
        d.retained.dependencies[0].family = 'other';
      },
    ],
    [
      'promoted dependency',
      (d: any) => {
        d.retained.dependencies[0].authorityStatus =
          'supported in stated scope';
      },
    ],
    [
      'promoted meaning',
      (d: any) => {
        map(d).rows[0].economicCorrespondence = 'supported';
      },
    ],
    [
      'transferable right',
      (d: any) => {
        map(d).rows[0].transferableRightEstablished = true;
      },
    ],
    [
      'execution activation',
      (d: any) => {
        map(d).rows[0].executable = true;
      },
    ],
    [
      'accounting change',
      (d: any) => {
        map(d).rows[0].accountingDelta = -1;
      },
    ],
    [
      'unexpected economic foreign key',
      (d: any) => {
        map(d).rows[0].economicRightId = 'invented-right';
      },
    ],
    [
      'duplicate artifact',
      (d: any) => {
        d.retainedArtifacts.push(d.retainedArtifacts[0]);
      },
    ],
  ])('rejects %s', (_name, corrupt) => {
    const input = fixture();
    corrupt(input);
    expect(() => build(input)).toThrow();
  });
});
