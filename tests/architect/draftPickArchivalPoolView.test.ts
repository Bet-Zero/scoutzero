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
      /Invalid input: expected object, received undefined/,
    ],
    [
      'wrong native pool despite inherited overlap',
      (d: any) => {
        map(d).rows[0].nativePoolClauseIds = ['synthetic-native-1'];
      },
      /Native clause pool or year mismatch/,
    ],
    [
      'wrong native year',
      (d: any) => {
        native(d).nativeClauses[0].years = [2031];
      },
      /Native clause pool or year mismatch/,
    ],
    [
      'wrong selection year',
      (d: any) => {
        native(
          d
        ).nativeClauses[0].signature.semantic.children[0].parameters.contextYear =
          2031;
      },
      /Native clause pool or year mismatch/,
    ],
    [
      'wrong clause round',
      (d: any) => {
        native(d).nativeClauses[0].signature.round = 2;
      },
      /"round"[\s\S]*Invalid input: expected 1/,
    ],
    [
      'wrong family',
      (d: any) => {
        map(d).rows[0].nativePoolFamily = 'XXX/YYY/ZZZ:2030';
      },
      /Archival pool membership mismatch/,
    ],
    [
      'wrong original year',
      (d: any) => {
        map(d).pools['AAA/BBB/CCC:2030'].referencedOriginalPicks[0] =
          'AAA_2031_1st';
      },
      /Archival original-pick year mismatch/,
    ],
    [
      'wrong original team',
      (d: any) => {
        map(d).pools['AAA/BBB/CCC:2030'].referencedOriginalPicks[0] =
          'XXX_2030_1st';
      },
      /Archival pool family mismatch/,
    ],
    [
      'consistent artifacts naming a pool absent from the foundation',
      (d: any) => {
        const sidecar = map(d);
        const pool = sidecar.pools['AAA/BBB/CCC:2030'];
        delete sidecar.pools['AAA/BBB/CCC:2030'];
        pool.referencedOriginalPicks = ['XXX_2030_1st', 'YYY_2030_1st', 'ZZZ_2030_1st'];
        sidecar.pools['XXX/YYY/ZZZ:2030'] = pool;
        for (const row of sidecar.rows.slice(0, 6))
          row.nativePoolFamily = 'XXX/YYY/ZZZ:2030';
        native(d).nativeClauses[0].signature.semantic.children[0].parameters.members =
          ['XXX', 'YYY', 'ZZZ'];
      },
      /Archival original pick absent from foundation/,
    ],
    [
      'duplicate alias',
      (d: any) => {
        map(d).rows[1] = structuredClone(map(d).rows[0]);
      },
      /Duplicate archival identity/,
    ],
    [
      'missing alias',
      (d: any) => {
        map(d).rows.pop();
      },
      /"rows"[\s\S]*Too small: expected array to have >=12 items/,
    ],
    [
      'duplicate clause',
      (d: any) => {
        native(d).nativeClauses.push(native(d).nativeClauses[0]);
      },
      /Duplicate archival identity/,
    ],
    [
      'duplicate clause reference',
      (d: any) => {
        map(d).rows[0].nativePoolClauseIds.push('synthetic-native-0');
      },
      /Duplicate archival reference/,
    ],
    [
      'duplicate raw right',
      (d: any) => {
        native(d).rights.push(native(d).rights[0]);
      },
      /Duplicate archival identity/,
    ],
    [
      'missing raw right',
      (d: any) => {
        native(d).rights.shift();
      },
      /Unknown archival pool, legacy record or dependency/,
    ],
    [
      'fabricated holder',
      (d: any) => {
        map(d).rows[0].legacyMeaningPreserved.holderTeam = 'ZZZ';
      },
      /Archival raw fields changed/,
    ],
    [
      'fabricated kind',
      (d: any) => {
        map(d).rows[0].legacyMeaningPreserved.kind = 'conveyance_right';
      },
      /Archival raw fields changed/,
    ],
    [
      'fabricated selector',
      (d: any) => {
        map(d).rows[0].legacyMeaningPreserved.receivesRank = [3];
      },
      /Archival raw fields changed/,
    ],
    [
      'unknown occurrence',
      (d: any) => {
        map(d).rows[0].occurrenceIds = ['missing'];
      },
      /Archival correspondence or occurrence lineage changed/,
    ],
    [
      'wrong occurrence',
      (d: any) => {
        map(d).rows[0].occurrenceIds = map(d).rows[1].occurrenceIds;
      },
      /Archival correspondence or occurrence lineage changed/,
    ],
    [
      'wrong dependency family',
      (d: any) => {
        d.retained.dependencies[0].family = 'other';
      },
      /Archival correspondence or occurrence lineage changed/,
    ],
    [
      'promoted dependency',
      (d: any) => {
        d.retained.dependencies[0].authorityStatus =
          'supported in stated scope';
      },
      /Archival correspondence or occurrence lineage changed/,
    ],
    [
      'promoted meaning',
      (d: any) => {
        map(d).rows[0].economicCorrespondence = 'supported';
      },
      /"economicCorrespondence"[\s\S]*Invalid input: expected .*unresolved/,
    ],
    [
      'transferable right',
      (d: any) => {
        map(d).rows[0].transferableRightEstablished = true;
      },
      /"transferableRightEstablished"[\s\S]*Invalid input: expected false/,
    ],
    [
      'execution activation',
      (d: any) => {
        map(d).rows[0].executable = true;
      },
      /"executable"[\s\S]*Invalid input: expected false/,
    ],
    [
      'accounting change',
      (d: any) => {
        map(d).rows[0].accountingDelta = -1;
      },
      /"accountingDelta"[\s\S]*Invalid input: expected 0/,
    ],
    [
      'unexpected economic foreign key',
      (d: any) => {
        map(d).rows[0].economicRightId = 'invented-right';
      },
      /Unrecognized key.*economicRightId/,
    ],
    [
      'duplicate artifact',
      (d: any) => {
        d.retainedArtifacts.push(d.retainedArtifacts[0]);
      },
      /Duplicate archival identity/,
    ],
  ])('rejects %s', (_name, corrupt, expected) => {
    const input = fixture();
    corrupt(input);
    expect(() => build(input)).toThrow(expected);
  });
});
