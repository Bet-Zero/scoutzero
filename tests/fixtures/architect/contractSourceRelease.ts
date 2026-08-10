/** Small governed source release used by ordinary Architect unit tests. */

import { buildContractSourceRelease } from '@/features/architect/utils/contractSource/contractSourceReleaseBuilder';
import type { ContractSourceRelease } from '@/schemas/contractSourceRelease';

const ARTIFACT_CONTENT = JSON.stringify({
  playerId: 'test_baseline_player',
  displayName: 'Test Baseline Player',
  teamCode: 'LAL',
  contract: {
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
    totalValue: 20000000,
    averageAnnualValue: 10000000,
    guaranteedValue: 20000000,
    guaranteedYears: 2,
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
    ],
    noTradeClause: false,
    tradeKicker: null,
    tradeRestrictions: [],
    birdRights: null,
    freeAgency: null,
    tradeEligibility: null,
  },
  source: {
    provider: 'SalarySwish',
    playerPageUrl: 'https://salaryswish.com/players/test-baseline-player',
    scrapedAt: '2026-06-05T12:19:56.526Z',
  },
  lastUpdated: '2026-06-05T12:19:56.526Z',
  version: '1.0',
});

export function makeTestContractSourceRelease(): ContractSourceRelease {
  return buildContractSourceRelease({
    releaseId: 'test-contract-source-release',
    releaseVersion: 1,
    releaseDigest: `sha256:${'1'.repeat(64)}`,
    supersedes: null,
    effectiveAt: '2026-06-05T12:19:56.526Z',
    salaryCapYear: 2026,
    observations: [
      {
        observationId: 'salaryswish:test_baseline_player:test',
        artifactPath: 'test/test_baseline_player.json',
        artifactSha256: `sha256:${'2'.repeat(64)}`,
        sourceProvider: 'SalarySwish',
        sourceRecordVersion: '1.0',
        observedAt: '2026-06-05T12:19:56.526Z',
        playerId: 'test_baseline_player',
        teamId: 'LAL',
        artifactContent: ARTIFACT_CONTENT,
      },
    ],
  });
}
