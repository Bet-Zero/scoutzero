import type {
  GovernedOfferSheetEvidence,
  GovernedOfferSheetLifecycle,
  GovernedOfferSheetProposal,
} from '@/schemas/governedOfferSheet';
import { makeRightsEstablishedEvent, makeRightsLedger } from './rightsHistory';

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
      extensionDocumentId: null,
      withdrawnAt: null,
      withdrawalConsentAt: null,
      withdrawalConsentDocumentId: null,
      contractYears: 1,
      annualRaiseBasisPoints: 0,
      annualBaseSchedule: [5_000_000],
      fullyProtected: true,
      requiredTermsPresent: true,
      hasOptionOrEto: false,
      requiredOfferSheetGuaranteedSeasons: 2,
      calculation: {
        basis: 'prior-salary',
        certifiedAmount: 5_000_000,
        inputSourceIds: ['qo-calculation-player123-v1'],
        calculationYear: 2026,
        draftSlot: null,
        draftSlotAmount: null,
        priorSalary: 4_500_000,
        officialStarts: null,
        officialMinutes: null,
        starterStartsThreshold: null,
        starterMinutesThreshold: null,
        starterCriteriaAmount: null,
        twoWayQualifyingAmount: null,
      },
      recordStatus: 'current',
      source: SOURCE,
    },
    homeTeamMatchingAuthority: {
      authorityId: 'matching-authority-player123-2026',
      authorityVersion: 1,
      kind: 'exception',
      amount: 50_000_000,
      effectiveFrom: '2025-07-01T00:00:00-04:00',
      effectiveThrough: '2026-03-01T23:59:59-05:00',
      recordStatus: 'current',
      source: SOURCE,
    },
    league: {
      salaryCap: 500_000_000,
      nonTaxpayerMle: 15_000_000,
      maximumSalary: 40_000_000,
      maximumSalaryBySeason: [
        { season: '2025-26', amount: 40_000_000 },
        { season: '2026-27', amount: 40_000_000 },
        { season: '2027-28', amount: 40_000_000 },
        { season: '2028-29', amount: 41_800_000 },
      ],
      arenasYearOneMaximum: 15_000_000,
      arenasYearTwoMaximum: 15_750_000,
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

export function makeGovernedOfferSheetRightsLedger(
  overrides: {
    worldId?: string;
    homeTeamId?: string;
    playerId?: string;
    salaryCapYear?: number;
  } = {}
) {
  const worldId = overrides.worldId ?? 'world_test_123';
  const homeTeamId = overrides.homeTeamId ?? 'BOS';
  const playerId = overrides.playerId ?? 'player123';
  const salaryCapYear = overrides.salaryCapYear ?? 2026;
  const event = makeRightsEstablishedEvent({
    salaryCapYear,
    freeAgentStatus: 'RFA',
    rightOfFirstRefusal: 'active',
  });
  return makeRightsLedger({
    ...event,
    worldId,
    teamId: homeTeamId,
    playerId,
    serviceSeasons: event.serviceSeasons.map((season) => ({
      ...season,
      creditedTeamId: season.creditedTeamId === null ? null : homeTeamId,
      rightsTeamId: homeTeamId,
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
      guaranteed:
        row.guaranteedForLackOfSkill &&
        row.guaranteedForInjuryOrIllness &&
        !row.individuallyNegotiatedProtectionConditions,
      option: row.option,
      ...(row.bonuses.length > 0
        ? {
            incentives: {
              likely: row.bonuses
                .filter((bonus) => bonus.classification === 'likely')
                .reduce((sum, bonus) => sum + bonus.amount, 0),
              unlikely: row.bonuses
                .filter((bonus) => bonus.classification === 'unlikely')
                .reduce((sum, bonus) => sum + bonus.amount, 0),
            },
          }
        : {}),
    })),
  };
}

export function makePendingGovernedOfferSheetLifecycle(): GovernedOfferSheetLifecycle {
  const evidence = makeGovernedOfferSheetEvidence();
  const proposal = makeGovernedOfferSheetProposal();
  return {
    payloadVersion: 1,
    ledgerId: 'offer-sheet-ledger:world_test_123:os-governed-1',
    ledgerVersion: 1,
    worldId: evidence.worldId,
    playerId: evidence.playerId,
    homeTeamId: evidence.homeTeamId,
    offeringTeamId: 'LAL',
    salaryCapYear: evidence.salaryCapYear,
    status: 'pending-match',
    evidenceReference: {
      evidenceId: evidence.evidenceId,
      evidenceRecordVersion: evidence.evidenceRecordVersion,
    },
    evidenceSnapshot: evidence,
    rightsReference: {
      ledgerId: 'rights-ledger:world_test_123:BOS:player123',
      ledgerVersion: 1,
      stateId: 'rights-state:world_test_123:BOS:player123:2026',
      stateVersion: 1,
    },
    reservations: {
      offeringTeam: proposal.salariesByYear.map((row) => ({
        season: row.season,
        amount: row.regularSalary,
      })),
      offeringTeamSalaryReference: {
        ledgerKind: 'team-salary',
        asOfDate: proposal.signedAt,
        salaryCap: evidence.league.salaryCap,
        totalBeforeOfferSheet: 0,
        teamStateReference: 'world_test_123:LAL:fixture-digest',
        canonLeafIds: ['CBA2-L04.3'],
      },
      homeTeamAuthority: evidence.homeTeamMatchingAuthority.kind,
      arenasApplies: false,
      offeringTeamAccounting: 'stated-schedule',
      homeTeamAccounting: 'stated-schedule',
    },
    events: [
      {
        eventKind: 'offer-sheet-signed',
        eventId: 'os-governed-1:signed:v1',
        eventVersion: 1,
        executedAt: proposal.signedAt,
        recordedAt: '2025-07-08T14:00:01.000Z',
        qualifyingOfferId: evidence.qualifyingOffer.offerId,
        qualifyingOfferVersion: evidence.qualifyingOffer.offerVersion,
        exerciseNoticeDeadline: '2025-07-09T23:59:59-04:00',
        proposal,
      },
    ],
  };
}

type GovernedOfferSheetFixtureSalaryRow = {
  season: string;
  salary: number;
  capHit?: number;
};

/**
 * Adapts older persistence-boundary fixtures to the governed Offer Sheet
 * contract without weakening production fail-closed behavior.
 */
export function makeGovernedOfferSheetFixture({
  worldId,
  playerId,
  homeTeamId,
  offeringTeamId,
  offerSheetId = 'os-governed-fixture',
  salariesByYear,
}: {
  worldId: string;
  playerId: string;
  homeTeamId: string;
  offeringTeamId: string;
  offerSheetId?: string;
  salariesByYear: readonly GovernedOfferSheetFixtureSalaryRow[];
}) {
  const proposal = makeGovernedOfferSheetProposal({
    salariesByYear: salariesByYear.map((row) => ({
      season: row.season,
      salaryExcludingIncentive: row.salary,
      regularSalary: row.salary,
      bonuses: [],
      guaranteedForLackOfSkill: true,
      guaranteedForInjuryOrIllness: true,
      individuallyNegotiatedProtectionConditions: false,
      option: null,
    })),
  });
  const baseEvidence = makeGovernedOfferSheetEvidence();
  const evidence = makeGovernedOfferSheetEvidence({
    evidenceId: `rfa-qo-evidence-${playerId}-2026`,
    worldId,
    homeTeamId,
    playerId,
    qualifyingOffer: {
      ...baseEvidence.qualifyingOffer,
      offerId: `qo-${playerId}-2026`,
    },
    homeTeamMatchingAuthority: {
      ...baseEvidence.homeTeamMatchingAuthority,
      authorityId: `matching-authority-${playerId}-2026`,
    },
    league: {
      ...baseEvidence.league,
      // These compatibility fixtures exercise persistence boundaries rather
      // than Arenas accounting. Keep their historical schedules on the
      // ordinary stated-schedule branch.
      nonTaxpayerMle: 100_000_000,
      arenasYearOneMaximum: 100_000_000,
      arenasYearTwoMaximum: 105_000_000,
    },
  });
  const contract = makeGovernedOfferSheetContract(proposal);
  const rightsLedger = makeGovernedOfferSheetRightsLedger({
    worldId,
    homeTeamId,
    playerId,
  });
  const lifecycle: GovernedOfferSheetLifecycle = {
    payloadVersion: 1,
    ledgerId: `offer-sheet-ledger:${worldId}:${offerSheetId}`,
    ledgerVersion: 1,
    worldId,
    playerId,
    homeTeamId,
    offeringTeamId,
    salaryCapYear: 2026,
    status: 'pending-match',
    evidenceReference: {
      evidenceId: evidence.evidenceId,
      evidenceRecordVersion: evidence.evidenceRecordVersion,
    },
    evidenceSnapshot: evidence,
    rightsReference: {
      ledgerId: `rights-ledger:${worldId}:${homeTeamId}:${playerId}`,
      ledgerVersion: 1,
      stateId: `rights-state:${worldId}:${homeTeamId}:${playerId}:2026`,
      stateVersion: 1,
    },
    reservations: {
      offeringTeam: salariesByYear.map((row) => ({
        season: row.season,
        amount: row.capHit ?? row.salary,
      })),
      offeringTeamSalaryReference: {
        ledgerKind: 'team-salary',
        asOfDate: proposal.signedAt,
        salaryCap: evidence.league.salaryCap,
        totalBeforeOfferSheet: 0,
        teamStateReference: `${worldId}:${offeringTeamId}:fixture-digest`,
        canonLeafIds: ['CBA2-L04.3'],
      },
      homeTeamAuthority: evidence.homeTeamMatchingAuthority.kind,
      arenasApplies: false,
      offeringTeamAccounting: 'stated-schedule',
      homeTeamAccounting: 'stated-schedule',
    },
    events: [
      {
        eventKind: 'offer-sheet-signed',
        eventId: `${offerSheetId}:signed:v1`,
        eventVersion: 1,
        executedAt: proposal.signedAt,
        recordedAt: '2025-07-08T14:00:01.000Z',
        qualifyingOfferId: evidence.qualifyingOffer.offerId,
        qualifyingOfferVersion: evidence.qualifyingOffer.offerVersion,
        exerciseNoticeDeadline: '2025-07-09T23:59:59-04:00',
        proposal,
      },
    ],
  };

  return {
    asOfDate: '2025-07-08',
    resolutionAt: proposal.receivedAt,
    evidence,
    proposal,
    contract,
    rightsLedger,
    lifecycle,
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
