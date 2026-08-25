import { z } from 'zod';
import { JsonValueZ, SeasonCodeZ } from './common';

const NonEmptyStringZ = z.string().trim().min(1);
const TeamCodeZ = z
  .string()
  .trim()
  .min(2)
  .max(5)
  .regex(/^[A-Z0-9]{2,5}$/, 'must be a canonical uppercase Team code');
const ExactMoneyZ = z.number().int().nonnegative();
const StateDigestZ = z.string().regex(/^fnv1a64:[0-9a-f]{16}$/);
const ZonedInstantZ = z
  .string()
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value
      ) && Number.isFinite(Date.parse(value)),
    { message: 'must be an ISO-8601 instant with an explicit UTC offset' }
  );

export const GovernedSignAndTradePhysicalExamZ = z.discriminatedUnion(
  'status',
  [
    z
      .object({
        status: z.literal('not-required'),
      })
      .strict(),
    z
      .object({
        status: z.literal('passed'),
        examRecordId: NonEmptyStringZ,
        examRecordVersion: z.number().int().positive(),
        examinedAt: ZonedInstantZ,
        physicianId: NonEmptyStringZ,
        designatedByTeam: TeamCodeZ,
        nbaProcedureVersion: NonEmptyStringZ,
        result: z.literal('PASS'),
      })
      .strict(),
  ]
);

/**
 * Transaction facts the user must affirm because they are not derivable from
 * salary rows. They are never trusted by themselves: the live Apply loader
 * binds them to the current actor, world date, assignee, and saved evidence.
 */
export const GovernedSignAndTradeProposalZ = z
  .object({
    proposalVersion: z.literal(1),
    transactionAt: ZonedInstantZ,
    playerConsentConfirmed: z.literal(true),
    higherMaxStatus: z.literal('not-relied-upon'),
    firstSeasonUnlikelyBonuses: ExactMoneyZ,
    exhibit6Present: z.literal(false),
    physicalExam: GovernedSignAndTradePhysicalExamZ,
  })
  .strict();

const DocumentSnapshotReceiptZ = z
  .object({
    exists: z.boolean(),
    digest: StateDigestZ.nullable(),
  })
  .strict()
  .superRefine((receipt, context) => {
    if (receipt.exists !== (receipt.digest !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['digest'],
        message: 'snapshot existence and digest must agree',
      });
    }
  });

const GovernedSignAndTradeContractRowZ = z
  .object({
    season: SeasonCodeZ,
    salary: ExactMoneyZ,
    capHit: ExactMoneyZ,
    guaranteed: z.boolean(),
    guaranteedAmount: ExactMoneyZ,
    option: z.enum(['PO', 'TO', 'ETO']).nullable(),
    likelyBonuses: ExactMoneyZ,
    unlikelyBonuses: ExactMoneyZ,
  })
  .strict();

const GovernedSignAndTradeCanonProofZ = z
  .object({
    canonCandidateCommit: z.literal('6cf8aaf358c158a88e630e8a7336f7e9c3febc17'),
    canonSha256: z.literal(
      '23fe883f6f1aec7799fc3396bef404c250fd26beefa705582a5307766ad7ff76'
    ),
  })
  .strict();

export const GovernedSignAndTradeAuthorityZ = z
  .object({
    authorityVersion: z.literal(1),
    status: z.literal('ready'),
    worldId: NonEmptyStringZ,
    sourceTeamId: TeamCodeZ,
    destinationTeamId: TeamCodeZ,
    playerId: NonEmptyStringZ,
    playerName: NonEmptyStringZ,
    salaryCapYear: z.number().int(),
    seasonKey: SeasonCodeZ,
    transactionAt: ZonedInstantZ,
    proposal: GovernedSignAndTradeProposalZ,
    seasonEvidence: z
      .object({
        priorSeason: SeasonCodeZ,
        currentSeason: SeasonCodeZ,
        historyId: NonEmptyStringZ,
        historyDigest: StateDigestZ,
        transitionId: NonEmptyStringZ,
        transitionManifestDigest: StateDigestZ,
        finalRosterDigest: StateDigestZ,
        finalRosterPlayerDigest: StateDigestZ,
        seasonCloseApronMeasurementDigest: StateDigestZ,
      })
      .strict(),
    rightsEvidence: z
      .object({
        ledgerId: NonEmptyStringZ,
        ledgerVersion: z.number().int().positive(),
        ledgerDigest: StateDigestZ,
        stateId: NonEmptyStringZ,
        stateVersion: z.number().int().positive(),
        birdType: z.enum(['Full Bird', 'Early Bird', 'Non-Bird']),
        signingBirdType: z.enum(['Full Bird', 'Early Bird', 'Non-Bird']),
        freeAgentStatus: z.enum(['UFA', 'RFA']),
        rightOfFirstRefusal: z.enum(['active', 'inactive', 'not-applicable']),
        consumedEventIds: z.array(NonEmptyStringZ).min(1),
      })
      .strict(),
    contract: z
      .object({
        contractDigest: StateDigestZ,
        contractYears: z.number().int().min(3).max(4),
        nonOptionYears: z.number().int().min(3).max(4),
        firstSeasonFullyProtected: z.literal(true),
        signedUsing: z.enum(['FULL_BIRD', 'EARLY_BIRD', 'NON_BIRD']),
        rows: z.array(GovernedSignAndTradeContractRowZ).min(3).max(4),
        firstSeasonSalary: ExactMoneyZ,
        firstSeasonLikelyBonuses: ExactMoneyZ,
        firstSeasonUnlikelyBonuses: ExactMoneyZ,
      })
      .strict(),
    salaryTreatment: z
      .object({
        salaryCap: ExactMoneyZ,
        priorContractFinalSalary: ExactMoneyZ,
        applicableMinimumSalary: ExactMoneyZ,
        applicableMaximumSalary: ExactMoneyZ,
        qualifyingOfferTotal: ExactMoneyZ,
        nonQualifyingVeteranFirstYearCeiling: ExactMoneyZ,
        firstSeasonSalaryPlusUnlikely: ExactMoneyZ,
        postSigningSourceTeamSalary: ExactMoneyZ,
        bycTriggered: z.boolean(),
        poisonPillTriggered: z.literal(false),
        assignorSalary: ExactMoneyZ,
        assigneeSalary: ExactMoneyZ,
        assigneeRoomAmount: ExactMoneyZ,
      })
      .strict(),
    snapshots: z
      .object({
        worldMetadata: DocumentSnapshotReceiptZ,
        sourceTeam: DocumentSnapshotReceiptZ,
        destinationTeam: DocumentSnapshotReceiptZ,
        sourcePlayer: DocumentSnapshotReceiptZ,
        destinationPlayer: DocumentSnapshotReceiptZ,
        seasonHistory: DocumentSnapshotReceiptZ,
        seasonHistorySet: z
          .array(
            z
              .object({
                historyId: NonEmptyStringZ,
                teamId: TeamCodeZ,
                digest: StateDigestZ,
              })
              .strict()
          )
          .length(30),
        transitionManifest: DocumentSnapshotReceiptZ,
      })
      .strict(),
    seasonInputManifest: JsonValueZ,
    authoringIdentity: NonEmptyStringZ,
    operationId: NonEmptyStringZ,
    recordedAt: ZonedInstantZ,
    canonLeafIds: z.array(NonEmptyStringZ).min(1),
    proof: GovernedSignAndTradeCanonProofZ,
  })
  .strict()
  .superRefine((authority, context) => {
    if (authority.sourceTeamId === authority.destinationTeamId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destinationTeamId'],
        message: 'source and destination Teams must differ',
      });
    }
    if (
      authority.proposal.physicalExam.status === 'passed' &&
      authority.proposal.physicalExam.designatedByTeam !==
        authority.destinationTeamId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['proposal', 'physicalExam', 'designatedByTeam'],
        message: 'the assignee Team must designate the examining physician',
      });
    }
    if (
      authority.contract.rows.length !== authority.contract.contractYears ||
      authority.contract.nonOptionYears !==
        authority.contract.rows.filter((row) => row.option === null).length
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contract', 'rows'],
        message: 'contract length and non-option-year count must reconcile',
      });
    }
    if (
      authority.contract.firstSeasonUnlikelyBonuses !==
      authority.proposal.firstSeasonUnlikelyBonuses
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contract', 'firstSeasonUnlikelyBonuses'],
        message: 'proposal and authored Contract bonuses must agree',
      });
    }
    const firstRow = authority.contract.rows[0];
    if (
      !firstRow ||
      authority.contract.firstSeasonSalary !== firstRow.salary ||
      authority.contract.firstSeasonLikelyBonuses !== firstRow.likelyBonuses ||
      authority.contract.firstSeasonUnlikelyBonuses !==
        firstRow.unlikelyBonuses
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contract', 'rows', 0],
        message:
          'first-Season Contract summary amounts must match the first annual row',
      });
    }
    if (
      authority.contract.rows[0]?.guaranteedAmount !==
      authority.contract.rows[0]?.salary
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contract', 'rows', 0, 'guaranteedAmount'],
        message:
          'the first Season must be fully protected for its exact Base Compensation',
      });
    }
  });

export const GovernedSignAndTradeReceiptZ = z
  .object({
    receiptVersion: z.literal(1),
    receiptId: NonEmptyStringZ,
    transactionId: NonEmptyStringZ,
    worldId: NonEmptyStringZ,
    sourceTeamId: TeamCodeZ,
    destinationTeamId: TeamCodeZ,
    playerId: NonEmptyStringZ,
    salaryCapYear: z.number().int(),
    transactionAt: ZonedInstantZ,
    committedAt: ZonedInstantZ,
    authorityDigest: StateDigestZ,
    contractId: NonEmptyStringZ,
    contractEventId: NonEmptyStringZ,
    contractLedgerId: NonEmptyStringZ,
    contractLedgerVersion: z.number().int().positive(),
    hardCapEntryId: NonEmptyStringZ,
    salaryBooks: z
      .array(
        z
          .object({
            teamId: TeamCodeZ,
            teamSalary: ExactMoneyZ,
            apronTeamSalary: ExactMoneyZ,
            taxSalary: ExactMoneyZ,
          })
          .strict()
      )
      .length(2),
    tradeReceipt: JsonValueZ,
    verificationStatus: z.literal('complete'),
    canonLeafIds: z.array(NonEmptyStringZ).min(1),
  })
  .strict();

export type GovernedSignAndTradeProposal = z.infer<
  typeof GovernedSignAndTradeProposalZ
>;
export type GovernedSignAndTradeAuthority = z.infer<
  typeof GovernedSignAndTradeAuthorityZ
>;
export type GovernedSignAndTradeReceipt = z.infer<
  typeof GovernedSignAndTradeReceiptZ
>;
