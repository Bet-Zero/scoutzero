/** Canonical persisted contract for the governed ordinary-waiver lifecycle. */

import { z } from 'zod';

const NonEmptyStringZ = z.string().refine((value) => value.trim().length > 0, {
  message: 'must contain at least one non-whitespace character',
});
const MoneyZ = z.number().finite().nonnegative();
const ZONED_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function parseStrictZonedInstant(value: string): number | null {
  if (!ZONED_INSTANT_PATTERN.test(value)) return null;
  const offsetMatch = /([+-])(\d{2}):(\d{2})$/.exec(value);
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [
    value.slice(0, 4),
    value.slice(5, 7),
    value.slice(8, 10),
    value.slice(11, 13),
    value.slice(14, 16),
    value[16] === ':' ? value.slice(17, 19) : '0',
    offsetMatch?.[2] ?? '0',
    offsetMatch?.[3] ?? '0',
  ].map(Number);
  const local = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() !== month - 1 ||
    local.getUTCDate() !== day ||
    local.getUTCHours() !== hour ||
    local.getUTCMinutes() !== minute ||
    local.getUTCSeconds() !== second ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? instant : null;
}

const ZonedInstantZ = NonEmptyStringZ.refine(
  (value) => parseStrictZonedInstant(value) !== null,
  { message: 'must be an exact valid zoned instant' }
);

export const GovernedWaiverPathZ = z.enum([
  'standard',
  'waive-and-stretch',
  'buyout',
]);

export const GovernedWaiverProposalZ = z.strictObject({
  proposalVersion: z.literal(1),
  contractId: NonEmptyStringZ,
  path: GovernedWaiverPathZ,
  /** Exact League receipt instant; this is never derived from the runtime clock. */
  leagueReceivedAt: ZonedInstantZ,
  /** Written Team Salary election represented by the action, if applicable. */
  writtenStretchElection: z.boolean(),
  /** Reduction of protected Base Compensation, not the resulting obligation. */
  buyoutReduction: MoneyZ,
  writtenBuyoutAgreement: z.boolean(),
  playerSignatureRecorded: z.boolean(),
  teamSignatureRecorded: z.boolean(),
});

export const GovernedWaiverAllocationZ = z.strictObject({
  season: NonEmptyStringZ,
  protectedBaseCompensation: MoneyZ,
  buyoutReduction: MoneyZ,
  playerPayment: MoneyZ,
  teamSalary: MoneyZ,
  setOffReduction: MoneyZ.nullable(),
  isTeamSalaryStretched: z.boolean(),
});

export const GovernedWaiverEventKindZ = z.enum([
  'waiver-request',
  'waiver-expiry',
  'contract-termination',
  'buyout-agreement',
  'team-salary-stretch-election',
  'set-off-authority',
]);

export const GovernedWaiverEventZ = z.strictObject({
  eventId: NonEmptyStringZ,
  eventVersion: z.number().int().min(1),
  eventKind: GovernedWaiverEventKindZ,
  effectiveAt: ZonedInstantZ,
  recordedAt: ZonedInstantZ,
  predecessorEventId: NonEmptyStringZ.nullable(),
  authoringIdentity: NonEmptyStringZ,
  canonLeafIds: z.array(NonEmptyStringZ).min(1),
});

export const GovernedWaiverLifecycleZ = z
  .strictObject({
    lifecycleVersion: z.literal(1),
    lifecycleId: NonEmptyStringZ,
    worldId: NonEmptyStringZ,
    teamId: NonEmptyStringZ,
    playerId: NonEmptyStringZ,
    playerName: NonEmptyStringZ,
    contractId: NonEmptyStringZ,
    path: GovernedWaiverPathZ,
    leagueReceivedAt: ZonedInstantZ,
    expiresAt: ZonedInstantZ,
    terminationAt: ZonedInstantZ,
    requestIrrevocable: z.literal(true),
    outcome: z.literal('ordinary-unclaimed'),
    events: z.array(GovernedWaiverEventZ).min(3),
    originalContractSeasons: z.array(NonEmptyStringZ).min(1),
    protectedBaseCompensation: MoneyZ,
    buyoutReduction: MoneyZ,
    buyoutAgreementAt: ZonedInstantZ.nullable(),
    playerSignatureRecorded: z.boolean(),
    teamSignatureRecorded: z.boolean(),
    stretchElectionAt: ZonedInstantZ.nullable(),
    stretchBranch: z.enum(['july-august', 'september-june']).nullable(),
    stretchYears: z.number().int().min(1).nullable(),
    salaryCapAtElection: MoneyZ.nullable(),
    formerPlayerCeilingAtElection: MoneyZ.nullable(),
    allocationsBeforeStretch: z.array(GovernedWaiverAllocationZ),
    allocations: z.array(GovernedWaiverAllocationZ),
    paymentAllocations: z.array(GovernedWaiverAllocationZ),
    setOffStatus: z.literal('needs-authenticated-earnings'),
    setOffFormula: NonEmptyStringZ,
    originalContractEndsAt: ZonedInstantZ,
    reacquisitionRestrictedUntil: ZonedInstantZ.nullable(),
    contractAuthority: z.strictObject({
      ledgerId: NonEmptyStringZ,
      ledgerVersion: z.number().int().min(1),
      stateDigest: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/),
    }),
    canonLeafIds: z.array(NonEmptyStringZ).min(1),
  })
  .superRefine((lifecycle, context) => {
    const receivedAt = parseStrictZonedInstant(lifecycle.leagueReceivedAt);
    const expiresAt = parseStrictZonedInstant(lifecycle.expiresAt);
    if (
      receivedAt !== null &&
      expiresAt !== null &&
      expiresAt - receivedAt !== 48 * 60 * 60 * 1_000
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiresAt'],
        message: 'must be exactly 48 hours after League receipt',
      });
    }
    if (lifecycle.terminationAt !== lifecycle.expiresAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['terminationAt'],
        message: 'must equal ordinary unclaimed waiver expiry',
      });
    }

    const eventIds = new Set<string>();
    let previousEffectiveAt: number | null = null;
    lifecycle.events.forEach((event, index) => {
      if (eventIds.has(event.eventId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['events', index, 'eventId'],
          message: 'must be unique within the lifecycle',
        });
      }
      eventIds.add(event.eventId);
      if (event.eventVersion !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['events', index, 'eventVersion'],
          message: 'must be consecutive and match event order',
        });
      }
      const expectedPredecessor =
        index === 0 ? null : (lifecycle.events[index - 1]?.eventId ?? null);
      if (event.predecessorEventId !== expectedPredecessor) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['events', index, 'predecessorEventId'],
          message: 'must connect to the immediately preceding event',
        });
      }
      const effectiveAt = parseStrictZonedInstant(event.effectiveAt);
      if (
        effectiveAt !== null &&
        previousEffectiveAt !== null &&
        effectiveAt < previousEffectiveAt
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['events', index, 'effectiveAt'],
          message: 'must not precede the prior lifecycle event',
        });
      }
      previousEffectiveAt = effectiveAt;
    });

    const requestEvent = lifecycle.events.find(
      (event) => event.eventKind === 'waiver-request'
    );
    const expiryEvent = lifecycle.events.find(
      (event) => event.eventKind === 'waiver-expiry'
    );
    const terminationEvent = lifecycle.events.find(
      (event) => event.eventKind === 'contract-termination'
    );
    if (requestEvent?.effectiveAt !== lifecycle.leagueReceivedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['events'],
        message: 'must include a waiver request at League receipt',
      });
    }
    if (expiryEvent?.effectiveAt !== lifecycle.expiresAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['events'],
        message: 'must include the exact waiver-expiry event',
      });
    }
    if (terminationEvent?.effectiveAt !== lifecycle.terminationAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['events'],
        message: 'must include the exact contract-termination event',
      });
    }
  });

export type GovernedWaiverPath = z.infer<typeof GovernedWaiverPathZ>;
export type GovernedWaiverProposal = z.infer<typeof GovernedWaiverProposalZ>;
export type GovernedWaiverAllocation = z.infer<
  typeof GovernedWaiverAllocationZ
>;
export type GovernedWaiverEvent = z.infer<typeof GovernedWaiverEventZ>;
export type GovernedWaiverLifecycle = z.infer<typeof GovernedWaiverLifecycleZ>;
