/**
 * Source-derived Phase 3A closure expectations recorded before product runs.
 *
 * These values come only from the pinned accepted Canon or the named retained
 * governed records. Browser output, persisted world documents, receipts,
 * events, and existing test expectations are deliberately not authority.
 */
export const PHASE3A_CLOSURE_EXPECTATIONS = Object.freeze({
  acceptedCanon: {
    candidate: '6cf8aaf358c158a88e630e8a7336f7e9c3febc17',
    sha256:
      '23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76',
  },
  season2026_27: {
    salaryCapYear: 2027,
    salaryCap: 164_961_000,
    minimumTeamSalary: 148_465_000,
    taxLevel: 200_428_000,
    firstApron: 209_015_000,
    secondApron: 221_686_000,
    regularSeasonOpening: '2026-10-20',
    regularSeasonClosing: '2027-04-11',
    zeroYearsOfServiceMinimum: 1_357_763,
    systemLevelRecordIds: [
      'GOV-LVL-0001',
      'GOV-LVL-0002',
      'GOV-LVL-0003',
      'GOV-LVL-0004',
      'GOV-LVL-0005',
    ],
    calendarRecordId: 'GOV-CAL-0002',
  },
  roster: {
    standard: 15,
    twoWay: 3,
    incompleteRosterThreshold: 12,
  },
  waiver: {
    remainingGuaranteedSalary: 31_000_000,
    remainingSeasons: 2,
    stretchSeasons: 5,
    stretchedAnnualAmount: 6_200_000,
    buyoutReduction: 5_000_000,
    postBuyoutGuaranteedSalary: 26_000_000,
    canonLeafIds: ['CBA2-R04.1', 'CBA2-R04.2', 'CBA2-R04.3'],
  },
  freeAgency: {
    otherTeamOfferFirstYear: 4_800_000,
    releasedIncompleteRosterCharge: 1_357_763,
    expectedCapSpaceDecrease: 3_442_237,
  },
  offerSheet: {
    matchingWindowHours: 48,
    canonLeafIds: ['CBA2-L04.3'],
  },
  signAndTrade: {
    minimumNonOptionSeasons: 3,
    firstApronHardCap: 209_015_000,
    canonLeafIds: ['CBA2-A07.1', 'CBA2-A07.2', 'CBA2-A07.4'],
  },
  trade: {
    roomAllowance: 250_000,
    cashAmountCents: 100,
    firstApron: 209_015_000,
    secondApron: 221_686_000,
    canonLeafIds: ['CBA2-A02.9', 'CBA2-A02.10', 'CBA2-A02.12'],
  },
  stepien: {
    canonLeafId: 'CBA2-A12.3',
    evidenceIds: ['EV2-0086', 'EV2-0087'],
    missingGovernedHistory: [
      'governedDraftHistory.ownership',
      'governedDraftHistory.protection',
      'governedDraftHistory.conveyance',
      'governedDraftHistory.freeze',
      'governedDraftHistory.unfreeze',
      'governedDraftHistory.penalty',
    ],
    supportedSecondRound: {
      status: 'PASS',
      evaluated: true,
      passed: true,
    },
  },
  tradeBonusExclusion: {
    releaseId: 'salaryswish-retained-2026-06-05',
    releaseVersion: 1,
    releaseDigest:
      'sha256:46db3137308ff1c05e0066edf09ef08d45b92353bea7a2bcec93fd408adf5950',
    retainedPlayerId: 'austin_reaves',
    retainedTradeKickerPercent: 15,
    missingEvidenceTag: 'missing-bonus-allocation',
    expectedStatus: 'Needs input',
  },
});
