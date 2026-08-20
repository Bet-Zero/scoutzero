/** Canonical persisted contract for the governed ordinary-waiver lifecycle. */

import { z } from 'zod';

const NonEmptyStringZ = z.string().refine((value) => value.trim().length > 0, {
  message: 'must contain at least one non-whitespace character',
});
const MoneyZ = z.number().finite().nonnegative();

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
  leagueReceivedAt: NonEmptyStringZ,
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
  effectiveAt: NonEmptyStringZ,
  recordedAt: NonEmptyStringZ,
  predecessorEventId: NonEmptyStringZ.nullable(),
  authoringIdentity: NonEmptyStringZ,
  canonLeafIds: z.array(NonEmptyStringZ).min(1),
});

export const GovernedWaiverLifecycleZ = z.strictObject({
  lifecycleVersion: z.literal(1),
  lifecycleId: NonEmptyStringZ,
  worldId: NonEmptyStringZ,
  teamId: NonEmptyStringZ,
  playerId: NonEmptyStringZ,
  playerName: NonEmptyStringZ,
  contractId: NonEmptyStringZ,
  path: GovernedWaiverPathZ,
  leagueReceivedAt: NonEmptyStringZ,
  expiresAt: NonEmptyStringZ,
  terminationAt: NonEmptyStringZ,
  requestIrrevocable: z.literal(true),
  outcome: z.literal('ordinary-unclaimed'),
  events: z.array(GovernedWaiverEventZ).min(3),
  originalContractSeasons: z.array(NonEmptyStringZ).min(1),
  protectedBaseCompensation: MoneyZ,
  buyoutReduction: MoneyZ,
  buyoutAgreementAt: NonEmptyStringZ.nullable(),
  playerSignatureRecorded: z.boolean(),
  teamSignatureRecorded: z.boolean(),
  stretchElectionAt: NonEmptyStringZ.nullable(),
  stretchBranch: z.enum(['july-august', 'september-june']).nullable(),
  stretchYears: z.number().int().min(1).nullable(),
  salaryCapAtElection: MoneyZ.nullable(),
  formerPlayerCeilingAtElection: MoneyZ.nullable(),
  allocationsBeforeStretch: z.array(GovernedWaiverAllocationZ),
  allocations: z.array(GovernedWaiverAllocationZ),
  paymentAllocations: z.array(GovernedWaiverAllocationZ),
  setOffStatus: z.literal('needs-authenticated-earnings'),
  setOffFormula: NonEmptyStringZ,
  originalContractEndsAt: NonEmptyStringZ,
  reacquisitionRestrictedUntil: NonEmptyStringZ.nullable(),
  contractAuthority: z.strictObject({
    ledgerId: NonEmptyStringZ,
    ledgerVersion: z.number().int().min(1),
    stateDigest: z.string().regex(/^fnv1a64:[0-9a-f]{16}$/),
  }),
  canonLeafIds: z.array(NonEmptyStringZ).min(1),
});

export type GovernedWaiverPath = z.infer<typeof GovernedWaiverPathZ>;
export type GovernedWaiverProposal = z.infer<typeof GovernedWaiverProposalZ>;
export type GovernedWaiverAllocation = z.infer<
  typeof GovernedWaiverAllocationZ
>;
export type GovernedWaiverEvent = z.infer<typeof GovernedWaiverEventZ>;
export type GovernedWaiverLifecycle = z.infer<
  typeof GovernedWaiverLifecycleZ
>;
