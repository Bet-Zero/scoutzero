import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BUNDLED_CONTRACT_SOURCE_RELEASE_PIN,
  branchContractBaselineTeamDocument,
  buildContractBaselineTeamDocuments,
  buildContractSourceRelease,
  canonicalStringify,
  contractSourceReleaseDigestMaterial,
  sha256Digest,
  stableContractIdentity,
  validateContractBaselineDocumentSet,
  verifyContractSourceRelease,
} from '@/features/architect/utils/contractSource';
import {
  ContractFieldEvidenceZ,
  createContractEventLedger,
  decodeContractFieldEvidence,
  projectContractStateAsOf,
} from '@/features/architect/utils/contractHistory';
import type {
  ContractSourceObservation,
  ContractSourceRelease,
} from '@/schemas/contractSourceRelease';

const RELEASE_PATH = path.resolve(
  process.cwd(),
  'public/architect/contract-source-releases/salaryswish-retained-2026-06-05-v1.json'
);

function rawContract(overrides: Record<string, unknown> = {}) {
  return {
    contractType: 'VETERAN CONTRACT',
    isExtension: false,
    isRookieScale: false,
    signedUsing: 'Bird Exception',
    signingTeam: 'LAL',
    signingDate: 'July 1, 2025',
    signingExecutive: null,
    signedByCurrentTeam: true,
    startSeason: '2025-26',
    endSeason: '2026-27',
    contractLength: 2,
    totalValue: 21000000,
    averageAnnualValue: 10500000,
    guaranteedValue: 10000000,
    guaranteedYears: 1,
    salariesByYear: [
      {
        season: '2025-26',
        salary: 10000000,
        capHit: 10000000,
        guaranteed: true,
        guaranteedAmount: 10000000,
        option: null,
        optionUsed: null,
        optionDecisionDate: null,
        tradeBonus: null,
        incentives: { likely: 0, unlikely: 0 },
      },
      {
        season: '2026-27',
        salary: 11000000,
        capHit: 11000000,
        guaranteed: false,
        guaranteedAmount: 0,
        option: 'TO',
        optionUsed: null,
        optionDecisionDate: null,
        tradeBonus: null,
        incentives: { likely: 0, unlikely: 0 },
      },
    ],
    noTradeClause: false,
    tradeKicker: null,
    tradeRestrictions: [],
    birdRights: null,
    freeAgency: null,
    tradeEligibility: null,
    ...overrides,
  };
}

function findDirectNestedArray(value: unknown, path = '$'): string | null {
  if (Array.isArray(value)) {
    const nestedIndex = value.findIndex(Array.isArray);
    if (nestedIndex >= 0) return `${path}[${nestedIndex}]`;
    for (let index = 0; index < value.length; index += 1) {
      const nestedPath = findDirectNestedArray(
        value[index],
        `${path}[${index}]`
      );
      if (nestedPath) return nestedPath;
    }
  } else if (value && typeof value === 'object') {
    for (const [key, nestedValue] of Object.entries(value)) {
      const nestedPath = findDirectNestedArray(nestedValue, `${path}.${key}`);
      if (nestedPath) return nestedPath;
    }
  }
  return null;
}

async function observation(
  playerId: string,
  contract: Record<string, unknown>,
  observedAt = '2026-06-05T12:00:00Z',
  futureContract?: Record<string, unknown>
): Promise<ContractSourceObservation> {
  const artifactContent = JSON.stringify({
    playerId,
    teamCode: 'LAL',
    contract,
    ...(futureContract ? { futureContract } : {}),
    source: {
      provider: 'SalarySwish',
      playerPageUrl: `https://salaryswish.com/players/${playerId}`,
      scrapedAt: observedAt,
    },
    version: '1.0',
  });
  const artifactSha256 = await sha256Digest(artifactContent);
  return {
    observationId: `salaryswish:${playerId}:${artifactSha256.slice(-12)}`,
    artifactPath: `retained/${playerId}.json`,
    artifactSha256,
    sourceProvider: 'SalarySwish',
    sourceRecordVersion: '1.0',
    observedAt,
    playerId,
    teamId: 'LAL',
    artifactContent,
  };
}

async function releaseFor(
  observations: ContractSourceObservation[],
  options: {
    version?: number;
    supersedes?: ContractSourceRelease['supersedes'];
  } = {}
) {
  const releaseVersion = options.version ?? 1;
  const inputWithoutDigest = {
    releaseId: 'fixture-release',
    releaseVersion,
    supersedes: options.supersedes ?? null,
    effectiveAt: '2026-06-05T12:00:00Z',
    salaryCapYear: 2026,
    observations,
  };
  const releaseDigest = await sha256Digest(
    canonicalStringify(contractSourceReleaseDigestMaterial(inputWithoutDigest))
  );
  return buildContractSourceRelease({ ...inputWithoutDigest, releaseDigest });
}

describe('BZE-274 deterministic retained-source release', () => {
  it('rebuilds identical normalized content, identities, and digests', async () => {
    const source = await observation('player_one', rawContract());
    const first = await releaseFor([source]);
    const second = await releaseFor([source]);

    expect(canonicalStringify(second)).toBe(canonicalStringify(first));
    expect(second.records[0].contractId).toBe(
      stableContractIdentity('player_one', rawContract())
    );
    expect(second.records[0].resultingState.stateDigest).toBe(
      first.records[0].resultingState.stateDigest
    );
    await expect(
      verifyContractSourceRelease(second, {
        releaseId: second.releaseId,
        releaseVersion: second.releaseVersion,
        releaseDigest: second.releaseDigest,
      })
    ).resolves.toMatchObject({ releaseDigest: second.releaseDigest });
  });

  it('requires changed content to become a new immutable release', async () => {
    const first = await releaseFor([
      await observation('player_one', rawContract()),
    ]);
    const changed = await observation(
      'player_one',
      rawContract({ totalValue: 22000000 })
    );
    const tampered = {
      ...first,
      observations: [changed],
    };
    await expect(
      verifyContractSourceRelease(tampered, {
        releaseId: first.releaseId,
        releaseVersion: first.releaseVersion,
        releaseDigest: first.releaseDigest,
      })
    ).rejects.toThrow('release digest mismatch');

    const second = await releaseFor([changed], {
      version: 2,
      supersedes: {
        releaseId: first.releaseId,
        releaseVersion: first.releaseVersion,
        releaseDigest: first.releaseDigest,
      },
    });
    expect(second.releaseVersion).toBe(2);
    expect(second.releaseDigest).not.toBe(first.releaseDigest);
    await expect(
      verifyContractSourceRelease(second, {
        releaseId: second.releaseId,
        releaseVersion: 2,
        releaseDigest: second.releaseDigest,
      })
    ).resolves.toBeDefined();
  });

  it('blocks malformed manifests, invalid digests, broken chains, and duplicate identities', async () => {
    const source = await observation('player_one', rawContract());
    const release = await releaseFor([source]);
    await expect(
      verifyContractSourceRelease({ ...release, releaseId: '' })
    ).rejects.toThrow('Invalid contract-source release');
    await expect(
      verifyContractSourceRelease(
        { ...release, releaseDigest: `sha256:${'0'.repeat(64)}` },
        {
          releaseId: release.releaseId,
          releaseVersion: 1,
          releaseDigest: `sha256:${'0'.repeat(64)}`,
        }
      )
    ).rejects.toThrow('release digest mismatch');
    const broken = { ...release, releaseVersion: 2 };
    await expect(
      verifyContractSourceRelease(broken, {
        releaseId: release.releaseId,
        releaseVersion: 2,
        releaseDigest: release.releaseDigest,
      })
    ).rejects.toThrow('supersession chain');

    await expect(
      releaseFor([
        await observation(
          'player_dup',
          rawContract(),
          '2026-06-05T12:00:00Z',
          rawContract()
        ),
      ])
    ).rejects.toThrow('duplicate stable identities');
  });

  it('requires zoned source instants and selects the latest parsed instant', async () => {
    await expect(
      releaseFor([
        await observation(
          'unzoned_player',
          rawContract(),
          '2026-06-05T12:00:00'
        ),
      ])
    ).rejects.toThrow();

    const earlier = await observation(
      'offset_player',
      rawContract({ totalValue: 10_000_000 }),
      '2026-06-05T13:00:00Z'
    );
    const later = await observation(
      'offset_player',
      rawContract({ totalValue: 20_000_000 }),
      '2026-06-05T12:00:00-04:00'
    );
    const release = await releaseFor([earlier, later]);
    expect(release.records[0].sourceObservationId).toBe(later.observationId);
  });

  it('keeps canonical digests distinct and rejects non-plain values', () => {
    expect(() => canonicalStringify({ value: undefined })).toThrow(
      'cannot contain undefined'
    );
    expect(() => canonicalStringify(new Date('2026-06-05T12:00:00Z'))).toThrow(
      'plain objects'
    );
    expect(canonicalStringify({ value: null })).toBe('{"value":null}');
  });

  it('rejects truncated evidence receipts before reading limitations', () => {
    expect(() =>
      decodeContractFieldEvidence('terms.salary|known|source|retain')
    ).toThrow('too few components');
    expect(
      ContractFieldEvidenceZ.safeParse('terms.salary|known|source|retain')
        .success
    ).toBe(false);
  });

  it('keeps record incompleteness local and exposes exact later-route blockers', async () => {
    const complete = await observation('complete_player', rawContract());
    const incomplete = await observation(
      'needs_input_player',
      rawContract({ signingDate: null, salariesByYear: [] })
    );
    const release = await releaseFor([complete, incomplete]);

    expect(release.coverage.completeRecordIds).toHaveLength(1);
    expect(release.coverage.needsInputRecordIds).toHaveLength(1);
    expect(
      release.coverage.missingByCategory.map((entry) => entry.category)
    ).toEqual(
      expect.arrayContaining([
        'Missing a replayable salary schedule.',
        'Missing a source-supported signing date.',
      ])
    );
    expect(release.coverage.laterRouteReadiness.option.readyRecordIds).toEqual(
      []
    );
    expect(
      release.coverage.laterRouteReadiness.option.blockedRecordIds
    ).toHaveLength(1);
    expect(release.records[0].resultingState.terms.signingDate.precision).toBe(
      'date'
    );
  });

  it('retains malformed salary facts as explicit unknowns instead of staging fallbacks', async () => {
    const malformedRows = rawContract().salariesByYear.map((row, index) =>
      index === 0 ? { ...row, season: null } : row
    );
    const release = await releaseFor([
      await observation(
        'missing_season_player',
        rawContract({ salariesByYear: malformedRows })
      ),
    ]);

    expect(
      release.records[0].resultingState.terms.salaries[0].season
    ).toBeNull();
    expect(release.records[0].resultingState.completeness).toMatchObject({
      status: 'needs-input',
      reasons: ['A salary row is malformed or lacks Salary/Cap Hit evidence.'],
    });
  });
});

describe('BZE-274 checked-in source release', () => {
  it('verifies the exact corpus and produces safe replayable world documents', async () => {
    const release = await verifyContractSourceRelease(
      JSON.parse(await readFile(RELEASE_PATH, 'utf8'))
    );

    expect(release).toMatchObject(BUNDLED_CONTRACT_SOURCE_RELEASE_PIN);
    expect(release.coverage).toMatchObject({
      sourceObservationCount: 827,
      uniquePlayerCount: 698,
      totalSourceContracts: 774,
    });
    expect(release.coverage.completeRecordIds).toHaveLength(772);
    expect(release.coverage.needsInputRecordIds).toHaveLength(2);
    expect(release.coverage.excludedCorruptRecordIds).toEqual([]);
    expect(
      release.coverage.laterRouteReadiness.option.blockedRecordIds
    ).toHaveLength(243);
    expect(
      release.coverage.laterRouteReadiness.extension.blockedRecordIds
    ).toHaveLength(774);

    const documents = buildContractBaselineTeamDocuments(
      release,
      'world-real-release'
    );
    expect(new Set(documents.map((document) => document.teamId)).size).toBe(31);
    expect(documents.length + 1).toBeLessThan(500);
    expect(
      documents.reduce((sum, document) => sum + document.ledgers.length, 0)
    ).toBe(774);
    expect(
      Math.max(
        ...documents.map(
          (document) =>
            new TextEncoder().encode(JSON.stringify(document)).length
        )
      )
    ).toBeLessThan(1_000_000);
    expect(findDirectNestedArray(documents)).toBeNull();
    expect(validateContractBaselineDocumentSet(documents, 774)).toEqual(
      documents
    );
    await expect(
      Promise.resolve().then(() =>
        validateContractBaselineDocumentSet(documents.slice(1), 774)
      )
    ).rejects.toThrow('baseline is incomplete');

    const emptyLedgerDocument = {
      ...documents[0],
      ledgers: [{ ...documents[0].ledgers[0], events: [] }],
    };
    expect(() =>
      branchContractBaselineTeamDocument(emptyLedgerDocument, 'child-world')
    ).toThrow('cannot branch an empty ledger');

    const needsInputLedger = documents
      .flatMap((document) => document.ledgers)
      .find(
        (ledger) =>
          ledger.events[0]?.resultingState.completeness.status === 'needs-input'
      );
    expect(needsInputLedger).toBeDefined();
    const ledger = createContractEventLedger({
      ledgerId: needsInputLedger!.ledgerId,
      ledgerVersion: needsInputLedger!.ledgerVersion,
      events: needsInputLedger!.events,
    });
    const projection = projectContractStateAsOf({
      ledger,
      worldId: 'world-real-release',
      contractId: ledger.events[0].contractId,
      asOfDate: release.effectiveAt,
      salaryCapYear: release.salaryCapYear,
    });
    expect(projection.state).toBe('projected');
    expect(projection.evidenceStatus).toBe('needs-input');
    expect(projection.needsInputReasons).toEqual(
      expect.arrayContaining([
        'Missing a replayable salary schedule.',
        'Missing a source-supported signing date.',
      ])
    );
  });
});
