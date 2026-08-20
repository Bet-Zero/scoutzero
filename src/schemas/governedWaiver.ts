/** Canonical persisted contract for the governed ordinary-waiver lifecycle. */

import { z } from 'zod';

const NonEmptyStringZ = z.string().refine((value) => value.trim().length > 0, {
  message: 'must contain at least one non-whitespace character',
});
const MoneyZ = z.number().finite().int().nonnegative();
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

function isStrictEasternInstant(value: string): boolean {
  if (parseStrictZonedInstant(value) === null || value.endsWith('Z')) return false;
  const timeZoneName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'longOffset',
  })
    .formatToParts(new Date(value))
    .find((part) => part.type === 'timeZoneName')?.value;
  return timeZoneName?.replace('GMT', '') === value.slice(-6);
}

const EasternInstantZ = NonEmptyStringZ.refine(isStrictEasternInstant, {
  message: 'must be an exact, unambiguous Eastern-time instant',
});

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
  leagueReceivedAt: EasternInstantZ,
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
    leagueReceivedAt: EasternInstantZ,
    expiresAt: EasternInstantZ,
    terminationAt: EasternInstantZ,
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
    const addPathIssue = (path: (string | number)[], message: string) =>
      context.addIssue({ code: z.ZodIssueCode.custom, path, message });
    const buyoutEvents = lifecycle.events.filter(
      (event) => event.eventKind === 'buyout-agreement'
    );
    const stretchEvents = lifecycle.events.filter(
      (event) => event.eventKind === 'team-salary-stretch-election'
    );
    const hasStretchedAllocation = lifecycle.allocations.some(
      (allocation) => allocation.isTeamSalaryStretched
    );
    const hasStretchedPaymentAllocation = [
      ...lifecycle.allocationsBeforeStretch,
      ...lifecycle.paymentAllocations,
    ].some((allocation) => allocation.isTeamSalaryStretched);
    const sumAllocationField = (
      allocations: typeof lifecycle.allocations,
      field:
        | 'protectedBaseCompensation'
        | 'buyoutReduction'
        | 'playerPayment'
        | 'teamSalary'
    ) => allocations.reduce((sum, allocation) => sum + allocation[field], 0);
    const originalAllocationsMatch =
      lifecycle.paymentAllocations.length ===
        lifecycle.allocationsBeforeStretch.length &&
      lifecycle.paymentAllocations.every((allocation, index) => {
        const original = lifecycle.allocationsBeforeStretch[index];
        return (
          original !== undefined &&
          allocation.season === original.season &&
          allocation.protectedBaseCompensation ===
            original.protectedBaseCompensation &&
          allocation.buyoutReduction === original.buyoutReduction &&
          allocation.playerPayment === original.playerPayment &&
          allocation.teamSalary === original.teamSalary &&
          allocation.setOffReduction === original.setOffReduction &&
          allocation.isTeamSalaryStretched === original.isTeamSalaryStretched
        );
      });
    const originalRowsReconcile = lifecycle.allocationsBeforeStretch.every(
      (allocation) =>
        allocation.playerPayment ===
          allocation.protectedBaseCompensation - allocation.buyoutReduction &&
        allocation.teamSalary === allocation.playerPayment
    );
    const protectedTotal = sumAllocationField(
      lifecycle.allocationsBeforeStretch,
      'protectedBaseCompensation'
    );
    const allocatedBuyoutReduction = sumAllocationField(
      lifecycle.allocationsBeforeStretch,
      'buyoutReduction'
    );
    const postBuyoutTotal =
      lifecycle.protectedBaseCompensation - lifecycle.buyoutReduction;
    const originalPlayerPaymentTotal = sumAllocationField(
      lifecycle.allocationsBeforeStretch,
      'playerPayment'
    );
    const originalTeamSalaryTotal = sumAllocationField(
      lifecycle.allocationsBeforeStretch,
      'teamSalary'
    );
    const allocatedTeamSalaryTotal = sumAllocationField(
      lifecycle.allocations,
      'teamSalary'
    );

    if (hasStretchedPaymentAllocation) {
      addPathIssue(
        ['paymentAllocations'],
        'player-payment allocations must remain on the original schedule'
      );
    }
    if (!originalAllocationsMatch) {
      addPathIssue(
        ['paymentAllocations'],
        'must exactly match the original allocations before Team Salary stretch'
      );
    }
    if (protectedTotal !== lifecycle.protectedBaseCompensation) {
      addPathIssue(
        ['protectedBaseCompensation'],
        'must equal protected compensation across the original allocations'
      );
    }
    if (allocatedBuyoutReduction !== lifecycle.buyoutReduction) {
      addPathIssue(
        ['buyoutReduction'],
        'must equal the reduction allocated across the original Contract Seasons'
      );
    }
    if (
      postBuyoutTotal < 0 ||
      !originalRowsReconcile ||
      originalPlayerPaymentTotal !== postBuyoutTotal ||
      originalTeamSalaryTotal !== postBuyoutTotal
    ) {
      addPathIssue(
        ['allocationsBeforeStretch'],
        'must reconcile player payment and Team Salary to protected compensation after buyout'
      );
    }
    if (allocatedTeamSalaryTotal !== postBuyoutTotal) {
      addPathIssue(
        ['allocations'],
        'must preserve total Team Salary after the buyout reduction'
      );
    }

    if (lifecycle.path === 'buyout') {
      if (
        lifecycle.buyoutAgreementAt === null ||
        !lifecycle.playerSignatureRecorded ||
        !lifecycle.teamSignatureRecorded ||
        buyoutEvents.length !== 1
      ) {
        addPathIssue(
          ['path'],
          'buyout requires one written agreement event and both signatures'
        );
      }
    } else if (
      lifecycle.buyoutReduction !== 0 ||
      lifecycle.buyoutAgreementAt !== null ||
      lifecycle.playerSignatureRecorded ||
      lifecycle.teamSignatureRecorded ||
      buyoutEvents.length !== 0
    ) {
      addPathIssue(
        ['path'],
        'buyout fields and events are only valid on the buyout path'
      );
    }

    if (lifecycle.path === 'waive-and-stretch') {
      if (
        lifecycle.stretchElectionAt === null ||
        lifecycle.stretchBranch === null ||
        lifecycle.stretchYears === null ||
        lifecycle.salaryCapAtElection === null ||
        lifecycle.formerPlayerCeilingAtElection === null ||
        stretchEvents.length !== 1 ||
        !hasStretchedAllocation ||
        lifecycle.reacquisitionRestrictedUntil === null
      ) {
        addPathIssue(
          ['path'],
          'waive-and-stretch requires its election, cap snapshot, stretched allocation, event, and reacquisition bar'
        );
      }
    } else if (
      lifecycle.stretchElectionAt !== null ||
      lifecycle.stretchBranch !== null ||
      lifecycle.stretchYears !== null ||
      lifecycle.salaryCapAtElection !== null ||
      lifecycle.formerPlayerCeilingAtElection !== null ||
      stretchEvents.length !== 0 ||
      hasStretchedAllocation
    ) {
      addPathIssue(
        ['path'],
        'stretch fields, events, and allocations are only valid on the waive-and-stretch path'
      );
    }

    if (
      lifecycle.path === 'standard' &&
      lifecycle.reacquisitionRestrictedUntil !== null
    ) {
      addPathIssue(
        ['reacquisitionRestrictedUntil'],
        'must be null on the standard waiver path'
      );
    }
    if (
      lifecycle.path === 'buyout' &&
      lifecycle.reacquisitionRestrictedUntil === null
    ) {
      addPathIssue(
        ['reacquisitionRestrictedUntil'],
        'must be recorded on the buyout path'
      );
    }

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
