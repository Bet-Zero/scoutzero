import type {
  GovernedOfferSheetEvidence,
  GovernedOfferSheetProposal,
} from '@/schemas/governedOfferSheet';
import {
  makeRightsEstablishedEvent,
  makeRightsLedger,
} from './rightsHistory';

const SOURCE = {
  provider: 'NBA retained fixture',
  retainedArtifactPath: 'tests/fixtures/architect/offer-sheet-authority.json',
  artifactSha256: `sha256:${'a'.repeat(64)}`,
  artifactBytes: 1_024,
  retrievedAt: '2025-06-30T12:00:00-04:00',
  recordVersion: 1,
  recordStatus: 'current' as const,
};

export function makeGovernedOfferSheetEvidence(
  overrides: Partial<GovernedOfferSheetEvidence> = {}
): GovernedOfferSheetEvidence {
  return {
    evidenceVersion: 1,
    evidenceId: 'rfa-qo-evidence-player123-2026',
    evidenceRecordVersion: 1,
    status: 'known',
    worldId: 'world_test_123',
    homeTeamId: 'BOS',
    playerId: 'player123',
    salaryCapYear: 2026,
    observedAt: '2025-07-01T09:00:00-04:00',
    eligibility: {
      category: 'three-or-fewer-yos',
      yearsOfService: 3,
      firstRoundRookieScaleYearFourCompleted: false,
      qualifyingTwoWayService: false,
      otherPlayerEligible: true,
    },
    qualifyingOffer: {
      offerId: 'qo-player123-2026',
      offerVersion: 1,
      branch: 'standard',
      amount: 5_000_000,
      deliveredAt: '2025-06-29T17:00:00-04:00',
      openThrough: '2025-10-01T23:59:59-04:00',
      withdrawnAt: null,
      withdrawalConsentAt: null,
      contractYears: 1,
      annualRaiseBasisPoints: 0,
      fullyProtected: true,
      requiredTermsPresent: true,
      hasOptionOrEto: false,
      calculation: {
        basis: 'prior-salary',
        certifiedAmount: 5_000_000,
        inputSourceIds: ['qo-calculation-player123-v1'],
        draftSlotAmount: null,
        priorSalary: 4_500_000,
        starterCriteriaAmount: null,
        twoWayQualifyingAmount: null,
      },
      recordStatus: 'current',
      source: SOURCE,
    },
    league: {
      salaryCap: 500_000_000,
      nonTaxpayerMle: 15_000_000,
      maximumSalary: 40_000_000,
      source: { ...SOURCE, retrievedAt: '2025-06-28T12:00:00-04:00' },
    },
    ...overrides,
  };
}

export function makeGovernedOfferSheetProposal(
  overrides: Partial<GovernedOfferSheetProposal> = {}
): GovernedOfferSheetProposal {
  return {
    proposalVersion: 1,
    signedAt: '2025-07-08T09:55:00-04:00',
    receivedAt: '2025-07-08T10:00:00-04:00',
    principalTermsDocumentId: 'principal-terms-player123-v1',
    noticeDocumentId: 'notice-player123-v1',
    salariesByYear: [
      {
        season: '2025-26',
        salaryExcludingIncentive: 10_000_000,
        regularSalary: 10_000_000,
        bonuses: [],
        guaranteedForLackOfSkill: true,
        guaranteedForInjuryOrIllness: true,
        individuallyNegotiatedProtectionConditions: false,
        option: null,
      },
      {
        season: '2026-27',
        salaryExcludingIncentive: 10_500_000,
        regularSalary: 10_500_000,
        bonuses: [],
        guaranteedForLackOfSkill: true,
        guaranteedForInjuryOrIllness: true,
        individuallyNegotiatedProtectionConditions: false,
        option: null,
      },
    ],
    ...overrides,
  };
}

export function makeGovernedOfferSheetRightsLedger() {
  const event = makeRightsEstablishedEvent({
    salaryCapYear: 2026,
    freeAgentStatus: 'RFA',
    rightOfFirstRefusal: 'active',
  });
  return makeRightsLedger({
    ...event,
    worldId: 'world_test_123',
    teamId: 'BOS',
    playerId: 'player123',
    serviceSeasons: event.serviceSeasons.map((season) => ({
      ...season,
      creditedTeamId: season.creditedTeamId === null ? null : 'BOS',
      rightsTeamId: 'BOS',
    })),
  });
}

export function makeGovernedOfferSheetContract(
  proposal = makeGovernedOfferSheetProposal()
) {
  return {
    rfaOfferSheet: true,
    rfaOfferSheetOnly: true,
    rfaOfferSheetStatus: 'PENDING_MATCH',
    contractYears: proposal.salariesByYear.length,
    totalValue: proposal.salariesByYear.reduce(
      (sum, row) => sum + row.regularSalary,
      0
    ),
    salariesByYear: proposal.salariesByYear.map((row) => ({
      season: row.season,
      salary: row.regularSalary,
      capHit: row.regularSalary,
      guaranteed: true,
    })),
  };
}

export function makeGovernedOfferSheetState(
  evidence = makeGovernedOfferSheetEvidence()
) {
  const player = {
    player_id: 'player123',
    id: 'player123',
    name: 'Test Player',
    displayName: 'Test Player',
    teamCode: 'BOS',
    contract: { signingTeam: 'BOS' },
    rfaContext: { governedEvidence: evidence },
  };
  return {
    team: {
      teamCode: 'LAL',
      teamName: 'Los Angeles Lakers',
      players: [],
      roster: [],
      offerSheets: [],
    },
    player,
    teamCode: 'LAL',
    homeTeam: {
      teamCode: 'BOS',
      teamName: 'Boston Celtics',
      players: [player],
      roster: ['player123'],
      incomingOfferSheets: [],
      rightsLedger: makeGovernedOfferSheetRightsLedger(),
    },
  };
}
