/** Controlled legacy QA records, not current NBA source data. The real current
 * package journeys remain the starting-world acceptance proof. */
import {
  ARCHITECT_WORLDS_COLLECTION,
  ARCHITECT_WORLD_CONTRACT_BASELINES_SUBCOLLECTION,
} from '@/constants/collections';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildContractSourceRelease } from '../../../src/features/architect/utils/contractSource/contractSourceReleaseBuilder';
import {
  buildContractBaselineTeamDocuments,
  contractBaselineMetadata,
} from '../../../src/features/architect/utils/contractSource/contractSourceRelease';
import { getReviewAdminDb } from '../helpers/architectReviewWorld';

export async function seedQaContractBaseline(worldId: string) {
  const observations = await Promise.all(
    ['austin_reaves', 'derrick_white'].map(async (playerId) => {
      const source = JSON.parse(
        await readFile(
          `scripts/emu/review_seed/basePlayers/${playerId}.json`,
          'utf8'
        )
      );
      // This fixture declares old, ordinary no-bonus contracts explicitly.
      // It does not borrow the real players' different retained NBA contracts.
      source.contract = {
        ...source.contract,
        signingTeam: source.teamCode,
        signingDate: '2024-07-06',
        signedUsing: 'Bird Exception',
        // The legacy JSON's headline includes an omitted historical year.
        // This controlled three-row record describes only its stated schedule.
        startSeason: source.contract.salariesByYear[0].season,
        contractLength: source.contract.salariesByYear.length,
        totalValue: source.contract.salariesByYear.reduce(
          (sum: number, row: { salary: number }) => sum + row.salary,
          0
        ),
        salariesByYear: source.contract.salariesByYear.map(
          (row: Record<string, unknown>) => ({
            ...row,
            guaranteedAmount: row.salary,
            incentives: { likely: 0, unlikely: 0 },
          })
        ),
      };
      const artifactContent = JSON.stringify(source);
      return {
        observationId: `qa-controlled:${playerId}`,
        artifactPath: `controlled-fixture/${playerId}.json`,
        artifactSha256: `sha256:${createHash('sha256').update(artifactContent).digest('hex')}`,
        sourceProvider: 'Controlled browser QA fixture',
        sourceRecordVersion: '1',
        observedAt: '2026-07-01T00:00:00-04:00',
        playerId,
        teamId: source.teamCode as string,
        artifactContent,
      };
    })
  );
  const release = buildContractSourceRelease({
    releaseId: 'controlled-qa-contracts',
    releaseVersion: 1,
    releaseDigest: `sha256:${createHash('sha256').update(JSON.stringify(observations)).digest('hex')}`,
    supersedes: null,
    effectiveAt: '2026-07-01T00:00:00-04:00',
    salaryCapYear: 2027,
    observations,
    sourceDescription: {
      retainedCorpus: 'Controlled legacy QA fixture; never production inputs.',
      limitations: [
        'Synthetic software verification only; real NBA current-world proof runs separately.',
      ],
    },
  });
  release.source.provider = 'Controlled browser QA fixture';
  const root = getReviewAdminDb().doc(
    `${ARCHITECT_WORLDS_COLLECTION}/${worldId}`
  );
  const batch = getReviewAdminDb().batch();
  batch.update(root, contractBaselineMetadata(release));
  for (const document of buildContractBaselineTeamDocuments(release, worldId))
    batch.set(
      root
        .collection(ARCHITECT_WORLD_CONTRACT_BASELINES_SUBCOLLECTION)
        .doc(document.shardId),
      document
    );
  await batch.commit();
}
